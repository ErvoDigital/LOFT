import { ApiError } from "../utils/ApiError.js";

const TRANSCRIPT_LIMIT = 4000;
const SPEECH_LIMIT = 2400;

export function speechConfig(env = process.env) {
  return {
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: (env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, ""),
    sttModel: env.OPENROUTER_STT_MODEL || "openai/gpt-4o-mini-transcribe",
    ttsModel: env.OPENROUTER_TTS_MODEL || "openai/gpt-4o-mini-tts",
    ttsVoice: env.OPENROUTER_TTS_VOICE || "alloy",
  };
}

export function normalizeTranscript(raw) {
  if (!raw) return "";
  return String(raw).replace(/\s+/g, " ").replace(/[ \t]+([,.!?;:])/g, "$1").trim().slice(0, TRANSCRIPT_LIMIT);
}

function normalizeSpeechInput(raw) {
  if (!raw) return "";
  return String(raw).replace(/\s+/g, " ").trim().slice(0, SPEECH_LIMIT);
}

export async function transcribeAssistantAudio({ audioBuffer, mimeType, fileName }, { fetchImpl = fetch, config = speechConfig() } = {}) {
  if (!config.apiKey) throw new ApiError(503, "Voice transcription is not configured.");
  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType || "audio/webm" });
  form.set("file", blob, fileName || "assistant-voice.webm");
  form.set("model", config.sttModel);
  form.set("response_format", "verbose_json");
  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `****** },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError(503, "Voice transcription is unavailable right now.");
  }
  if (!response.ok) throw new ApiError(502, "Voice transcription failed. Check speech model access and credits.");
  let data;
  try { data = await response.json(); } catch { throw new ApiError(502, "Voice transcription returned an invalid response."); }
  const transcript = normalizeTranscript(data?.text);
  if (!transcript) throw new ApiError(502, "No speech was detected. Please try again.");
  return {
    transcript,
    confidence: typeof data?.confidence === "number" ? data.confidence : null,
    provider: "openrouter",
    model: config.sttModel,
  };
}

export async function synthesizeAssistantSpeech({ text, voice }, { fetchImpl = fetch, config = speechConfig() } = {}) {
  if (!config.apiKey) throw new ApiError(503, "Voice playback is not configured.");
  const input = normalizeSpeechInput(text);
  if (!input) throw new ApiError(400, "Text is required for speech playback.");
  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `******`,
      },
      body: JSON.stringify({ model: config.ttsModel, input, voice: voice || config.ttsVoice, format: "mp3" }),
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError(503, "Voice playback is unavailable right now.");
  }
  if (!response.ok) throw new ApiError(502, "Voice playback failed. Check speech model access and credits.");
  let bytes;
  try { bytes = Buffer.from(await response.arrayBuffer()); } catch { throw new ApiError(502, "Voice playback returned an invalid response."); }
  if (!bytes.length) throw new ApiError(502, "Voice playback returned empty audio.");
  return { bytes, contentType: response.headers.get("content-type") || "audio/mpeg", model: config.ttsModel };
}
