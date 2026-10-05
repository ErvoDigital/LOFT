const AUDIO_LIMIT = 8 * 1024 * 1024;
const SPEECH_LIMIT = 2400;
const AUDIO_FORMATS = {
  "audio/webm": "webm", "audio/wav": "wav", "audio/x-wav": "wav",
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a",
  "audio/x-m4a": "m4a", "audio/ogg": "ogg", "audio/flac": "flac",
  "audio/x-flac": "flac", "audio/aac": "aac",
};

export function gatewaySpeechConfig(env = process.env) {
  return {
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: (env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
    sttModel: env.OPENROUTER_STT_MODEL || "openai/gpt-4o-mini-transcribe",
    ttsModel: env.OPENROUTER_TTS_MODEL || "google/gemini-3.1-flash-tts-preview",
    ttsVoice: env.OPENROUTER_TTS_VOICE || "Kore",
  };
}

function failure(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function json(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readBody(req, limit) {
  if (Number(req.headers["content-length"]) > limit) {
    req.resume();
    throw failure(413, "Speech request is too large.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      req.resume();
      throw failure(413, "Speech request is too large.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function providerRequest(path, body, config, fetchImpl, signal) {
  if (!config.apiKey) throw failure(503, "Configure OPENROUTER_API_KEY on the OpenClaw host for speech.");
  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}${path}`, {
      method: "POST", redirect: "error", signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw failure(503, "The speech provider is unavailable or timed out.");
  }
  if (!response.ok) {
    const status = response.status === 402 ? 402 : response.status === 429 ? 429 : 502;
    // Provider bodies can contain credentials or internal details. Never relay them.
    await response.body?.cancel().catch(() => {});
    throw failure(status, status === 402 ? "Insufficient OpenRouter credits on the OpenClaw host." : "The speech provider rejected the request. Check gateway speech models, credentials and credits.");
  }
  return response;
}

export function createSpeechHandler(action, { config = gatewaySpeechConfig(), fetchImpl = fetch } = {}) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      json(res, 405, { error: "Use POST for speech requests." });
      return true;
    }
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on("close", cancel);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]);
    try {
      if (action === "transcribe") {
        if (!req.headers["content-type"]?.startsWith("multipart/form-data")) throw failure(400, "Upload one multipart audio file.");
        const body = await readBody(req, AUDIO_LIMIT + 65536);
        let form;
        try { form = await new Response(body, { headers: { "Content-Type": req.headers["content-type"] } }).formData(); }
        catch { throw failure(400, "Invalid audio upload."); }
        const file = form.get("file");
        if (!file || typeof file.arrayBuffer !== "function" || form.getAll("file").length !== 1 || !file.size) throw failure(400, "Attach one nonempty audio file as 'file'.");
        if (file.size > AUDIO_LIMIT) throw failure(413, "Audio exceeds the 8 MiB limit.");
        const format = AUDIO_FORMATS[file.type.split(";")[0].trim().toLowerCase()];
        if (!format) throw failure(400, "Unsupported audio format.");
        const response = await providerRequest("/audio/transcriptions", {
          model: config.sttModel,
          input_audio: { data: Buffer.from(await file.arrayBuffer()).toString("base64"), format },
          response_format: "json",
        }, config, fetchImpl, signal);
        let data;
        try { data = await response.json(); } catch { throw failure(502, "The speech provider returned an invalid transcript."); }
        if (typeof data?.text !== "string") throw failure(502, "The speech provider returned an invalid transcript.");
        json(res, 200, { text: data.text, confidence: typeof data.confidence === "number" ? data.confidence : null, model: config.sttModel });
      } else {
        if (!req.headers["content-type"]?.startsWith("application/json")) throw failure(400, "Send speech text as JSON.");
        const body = await readBody(req, 16384);
        let data;
        try { data = JSON.parse(body.toString("utf8")); } catch { throw failure(400, "Invalid speech JSON."); }
        if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some((key) => !["input", "voice"].includes(key))) throw failure(400, "Invalid speech request fields.");
        if (typeof data.input !== "string" || !data.input.trim() || data.input.length > SPEECH_LIMIT) throw failure(400, "Speech text must contain 1 to 2400 characters.");
        if (data.voice !== undefined && (typeof data.voice !== "string" || !data.voice.trim() || data.voice.length > 60)) throw failure(400, "Invalid speech voice.");
        const response = await providerRequest("/audio/speech", {
          model: config.ttsModel, input: data.input.trim(), voice: data.voice || config.ttsVoice, response_format: "mp3",
        }, config, fetchImpl, signal);
        const contentType = response.headers.get("content-type") || "audio/mpeg";
        if (!contentType.startsWith("audio/")) throw failure(502, "The speech provider returned an invalid audio response.");
        let bytes;
        try { bytes = Buffer.from(await response.arrayBuffer()); } catch { throw failure(502, "The speech provider returned invalid audio."); }
        if (!bytes.length) throw failure(502, "The speech provider returned empty audio.");
        res.setHeader("Content-Type", contentType);
        res.setHeader("X-Loft-Speech-Model", config.ttsModel);
        res.end(bytes);
      }
    } catch (err) {
      if (!res.destroyed) json(res, err.statusCode || 503, { error: err.statusCode ? err.message : "OpenClaw speech is unavailable." });
    } finally {
      res.off("close", cancel);
    }
    return true;
  };
}

export default {
  id: "loft-speech",
  name: "LOFT speech",
  register(api) {
    api.registerHttpRoute({ path: "/v1/audio/transcriptions", auth: "gateway", match: "exact", handler: createSpeechHandler("transcribe") });
    api.registerHttpRoute({ path: "/v1/audio/speech", auth: "gateway", match: "exact", handler: createSpeechHandler("speak") });
  },
};
