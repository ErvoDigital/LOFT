import { ApiError } from "../utils/ApiError.js";
import { gatewayConfig } from "./openclaw.service.js";

const TRANSCRIPT_LIMIT = 4000;
const SPEECH_LIMIT = 2400;

export function speechConfig(env = process.env) {
  const gateway = gatewayConfig(env);
  return {
    token: gateway.token,
    baseUrl: gateway.url.replace(/\/+$/, ""),
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

function authHeaders(config) {
  return { Authorization: "Bearer " + config.token };
}

function speechProviderError(response, action) {
  if (response.status === 402) {
    return new ApiError(402, `Voice ${action} is blocked by insufficient OpenRouter credits. Add credits to the account used by the OpenClaw gateway's API key and try again.`);
  }
  if (response.status === 404) return new ApiError(503, "OpenClaw audio is not installed. Deploy the LOFT speech plugin and restart the gateway.");
  return new ApiError(502, `Voice ${action} failed. Check the OpenClaw speech configuration, model access and credits.`);
}

export async function transcribeAssistantAudio({ audioBuffer, mimeType, fileName }, { fetchImpl = fetch, config = speechConfig() } = {}) {
  if (!config.token) throw new ApiError(503, "OpenClaw voice transcription is not configured.");
  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType || "audio/webm" });
  form.set("file", blob, fileName || "assistant-voice.webm");
  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: authHeaders(config),
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError(503, "Voice transcription is unavailable right now.");
  }
  if (!response.ok) throw speechProviderError(response, "transcription");
  let data;
  try { data = await response.json(); } catch { throw new ApiError(502, "Voice transcription returned an invalid response."); }
  const transcript = normalizeTranscript(data?.text);
  if (!transcript) throw new ApiError(502, "No speech was detected. Please try again.");
  return {
    transcript,
    confidence: typeof data?.confidence === "number" ? data.confidence : null,
    provider: "openclaw",
    model: data?.model || null,
  };
}

export async function synthesizeAssistantSpeech({ text, voice }, { fetchImpl = fetch, config = speechConfig() } = {}) {
  if (!config.token) throw new ApiError(503, "OpenClaw voice playback is not configured.");
  const input = normalizeSpeechInput(text);
  if (!input) throw new ApiError(400, "Text is required for speech playback.");
  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}/v1/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(config),
      },
      body: JSON.stringify({ input, ...(voice ? { voice } : {}) }),
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new ApiError(503, "Voice playback is unavailable right now.");
  }
  if (!response.ok) throw speechProviderError(response, "playback");
  let bytes;
  try { bytes = Buffer.from(await response.arrayBuffer()); } catch { throw new ApiError(502, "Voice playback returned an invalid response."); }
  if (!bytes.length) throw new ApiError(502, "Voice playback returned empty audio.");
  return { bytes, contentType: response.headers.get("content-type") || "audio/mpeg", model: response.headers.get("x-loft-speech-model") || null };
}
