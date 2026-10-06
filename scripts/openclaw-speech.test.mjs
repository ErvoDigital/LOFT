import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Readable } from "node:stream";
import plugin, { createSpeechHandler, gatewaySpeechConfig, pcmToWav } from "../infra/openclaw/plugins/loft-speech/index.js";
import { speechConfig, transcribeAssistantAudio, synthesizeAssistantSpeech } from "../server/src/services/speech.service.js";

async function host(t, action, options) {
  const server = http.createServer(createSpeechHandler(action, options));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test("Speech uses the same gateway settings as text and registers gateway-authenticated exact routes", () => {
  const env = { OPENCLAW_GATEWAY_URL: "https://gateway.example/", OPENCLAW_GATEWAY_TOKEN: "gateway-token", OPENROUTER_API_KEY: "unused-backend-key" };
  assert.deepEqual(speechConfig(env), { baseUrl: "https://gateway.example", token: "gateway-token" });
  assert.equal(gatewaySpeechConfig(env).apiKey, "unused-backend-key");
  const routes = [];
  plugin.register({ registerHttpRoute: (route) => routes.push(route) });
  assert.deepEqual(routes.map(({ path, auth, match }) => ({ path, auth, match })), [
    { path: "/v1/audio/transcriptions", auth: "gateway", match: "exact" },
    { path: "/v1/audio/speech", auth: "gateway", match: "exact" },
  ]);
});

test("Browser capture formats reach STT correctly even when the upload filename is webm", async (t) => {
  let expectedFormat;
  const url = await host(t, "transcribe", {
    config: { apiKey: "gateway-only-key", baseUrl: "https://provider.example", sttModel: "configured-stt" },
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.Authorization, "Bearer gateway-only-key");
      const body = JSON.parse(init.body);
      assert.equal(body.model, "configured-stt");
      assert.equal(body.input_audio.format, expectedFormat);
      return Response.json({ text: "A short question" });
    },
  });
  for (const [mimeType, format] of [["audio/webm;codecs=opus", "webm"], ["audio/mp4", "m4a"], ["audio/ogg;codecs=opus", "ogg"]]) {
    expectedFormat = format;
    const form = new FormData();
    form.set("file", new Blob(["audio bytes"], { type: mimeType }), "voice.webm");
    const response = await fetch(url, { method: "POST", body: form });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, "A short question");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("Invalid uploads and speech model overrides are rejected before any paid call", async (t) => {
  const options = { fetchImpl: () => assert.fail("Invalid requests must not reach the provider") };
  const audioUrl = await host(t, "transcribe", options);
  for (const [mimeType, bytes] of [["text/plain", "hello"], ["audio/webm", ""]]) {
    const form = new FormData();
    form.set("file", new Blob([bytes], { type: mimeType }), "voice.webm");
    assert.equal((await fetch(audioUrl, { method: "POST", body: form })).status, 400);
  }
  const speechUrl = await host(t, "speak", options);
  for (const body of [{ input: "hello", model: "caller-model" }, { input: "x".repeat(2401) }, { input: "hello", voice: {} }]) {
    assert.equal((await fetch(speechUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 400);
  }
  assert.equal((await fetch(speechUrl)).status, 405);
});

test("Gemini speech requests PCM and returns browser-playable WAV with intact samples", async (t) => {
  const pcm = Buffer.from([0, 0, 255, 127, 0, 128]);
  const url = await host(t, "speak", {
    config: { apiKey: "gateway-key", baseUrl: "https://provider.example", ttsModel: "google/gemini-3.1-flash-tts-preview", ttsVoice: "Kore" },
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.response_format, "pcm");
      assert.equal(body.voice, "Kore");
      return new Response(pcm, { headers: { "Content-Type": "audio/pcm" } });
    },
  });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: "Hello." }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "audio/wav");
  const wav = Buffer.from(await res.arrayBuffer());
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 16), "WAVEfmt ");
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt32LE(28), 48000);
  assert.equal(wav.readUInt16LE(32), 2);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString("ascii", 36, 40), "data");
  assert.equal(wav.readUInt32LE(40), pcm.length);
  assert.deepEqual(wav.subarray(44), pcm);
});

test("Invalid PCM and non-audio gateway responses cannot be served as playable speech", async () => {
  assert.throws(() => pcmToWav(Buffer.alloc(0)), /invalid PCM/);
  assert.throws(() => pcmToWav(Buffer.from([1])), /invalid PCM/);
  await assert.rejects(synthesizeAssistantSpeech({ text: "Hello." }, {
    config: { token: "gateway-token", baseUrl: "https://gateway.example" },
    fetchImpl: async () => Response.json({ error: "not audio" }),
  }), /invalid audio response/);
});

test("Audio upload limits apply even without a content-length header", async () => {
  const req = Readable.from([Buffer.alloc(8 * 1024 * 1024), Buffer.alloc(65537)]);
  req.method = "POST";
  req.headers = { "content-type": "multipart/form-data; boundary=test" };
  const res = new http.ServerResponse({ method: "POST" });
  let result;
  res.end = (body) => { result = JSON.parse(body); };
  await createSpeechHandler("transcribe", { fetchImpl: () => assert.fail("Oversize upload must not reach the provider") })(req, res);
  assert.equal(res.statusCode, 413);
  assert.match(result.error, /too large/);
});

test("Provider failures keep credit status while hiding provider secrets", async (t) => {
  let providerStatus = 402;
  const url = await host(t, "speak", {
    config: { apiKey: "gateway-key", baseUrl: "https://provider.example", ttsModel: "tts", ttsVoice: "Kore" },
    fetchImpl: async () => Response.json({ error: "private-provider-secret" }, { status: providerStatus }),
  });
  for (const [upstreamStatus, expectedStatus] of [[402, 402], [401, 502], [429, 429], [500, 502]]) {
    providerStatus = upstreamStatus;
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: "hello" }) });
    assert.equal(response.status, expectedStatus);
    assert.ok(!(await response.text()).includes("private-provider-secret"));
  }
});

test("LOFT reports missing gateway audio without falling back to its own OpenRouter key", async () => {
  const options = { config: { token: "gateway-token", baseUrl: "https://gateway.example" }, fetchImpl: async () => new Response("private gateway details", { status: 404 }) };
  for (const call of [() => transcribeAssistantAudio({ audioBuffer: Buffer.from("voice"), mimeType: "audio/webm" }, options), () => synthesizeAssistantSpeech({ text: "hello" }, options)]) {
    await assert.rejects(call(), (err) => err.statusCode === 503 && /Deploy the LOFT speech plugin/.test(err.message) && !err.message.includes("private gateway details"));
  }
});
