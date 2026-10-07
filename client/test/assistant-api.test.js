import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import http from "node:http";
import axios from "axios";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/api/assistant.js", import.meta.url), "utf8");
const { code } = await transform(source, { format: "cjs" });

function speechApi(post) {
  return assistantApi(post).speakAssistantReply;
}

function assistantApi(post) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, Blob, Response, TextDecoder, require: () => ({ api: { post } }) });
  return module.exports;
}

test("Chat delivers partial text before completion and handles split UTF-8 and frames", async () => {
  let source;
  const stream = new ReadableStream({ start(controller) { source = controller; } });
  const encoder = new TextEncoder();
  let firstDelta;
  const receivedDelta = new Promise((resolve) => { firstDelta = resolve; });
  const events = [];
  const signal = new AbortController().signal;
  const { sendAssistantMessage } = assistantApi(async (path, body, config) => {
    assert.equal(path, "/assistant/message");
    assert.equal(body.message, "Hi");
    assert.equal(config.adapter, "fetch");
    assert.equal(config.responseType, "stream");
    assert.equal(config.signal, signal);
    assert.equal(config.headers.Accept, "application/x-ndjson");
    return { data: stream, headers: { "content-type": "application/x-ndjson" } };
  });
  const result = sendAssistantMessage({ message: "Hi" }, signal, (event) => { events.push(event); firstDelta(); });
  for (const byte of encoder.encode(JSON.stringify({ type: "delta", text: "Hello 👋" }) + "\n")) source.enqueue(Uint8Array.of(byte));
  await receivedDelta;
  assert.equal(events[0].text, "Hello 👋");
  source.enqueue(encoder.encode(JSON.stringify({ type: "reset" }) + "\n" + JSON.stringify({ type: "delta", text: "Final reply" }) + "\n" + JSON.stringify({ type: "result", reply: "Final reply", actions: [] })));
  source.close();
  const completed = await result;
  assert.equal(completed.reply, "Final reply");
  assert.equal(completed.actions.length, 0);
  assert.equal(events[1].type, "reset");
});

test("Interrupted or failed chat streams cannot become completed replies", async () => {
  const { readAssistantReply } = assistantApi();
  for (const payload of [
    JSON.stringify({ type: "delta", text: "Partial reply" }) + "\n",
    JSON.stringify({ type: "error", status: 503, error: "Gateway unavailable" }) + "\n",
    "invalid-json\n",
    JSON.stringify({ type: "result", reply: "No action list" }) + "\n",
  ]) {
    await assert.rejects(readAssistantReply(new Response(payload).body, () => {}), (err) => typeof err.response.data.error === "string");
  }
});

test("Streaming chat preserves HTTP error details and supports a JSON-only backend", async () => {
  const failure = Object.assign(new Error("Forbidden"), { response: { status: 403, data: Response.json({ error: "You are not a member of this workspace" }).body } });
  const failing = assistantApi(async () => { throw failure; });
  await assert.rejects(failing.sendAssistantMessage({ message: "Hi" }, undefined, () => {}), (err) => err.response.status === 403 && err.response.data.error.includes("not a member"));
  const legacy = assistantApi(async () => ({ data: Response.json({ reply: "Legacy reply", actions: [] }).body, headers: { "content-type": "application/json" } }));
  const result = await legacy.sendAssistantMessage({ message: "Hi" }, undefined, () => assert.fail("JSON-only replies have no deltas"));
  assert.equal(result.reply, "Legacy reply");
});

test("Real Axios streams reply text early and preserves request authentication", async (t) => {
  let finish;
  const readyToFinish = new Promise((resolve) => { finish = resolve; });
  const server = http.createServer(async (req, res) => {
    assert.equal(req.headers.authorization, "Bearer browser-test-token");
    assert.equal(req.headers.accept, "application/x-ndjson");
    req.resume();
    res.setHeader("Content-Type", "application/x-ndjson");
    res.write(JSON.stringify({ type: "delta", text: "Early text" }) + "\n");
    await readyToFinish;
    res.end(JSON.stringify({ type: "result", reply: "Early text, finished.", actions: [] }) + "\n");
  });
  t.after(async () => { finish(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const api = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}` });
  api.interceptors.request.use((config) => { config.headers.Authorization = "Bearer browser-test-token"; return config; });
  const { sendAssistantMessage } = assistantApi(api.post.bind(api));
  let receiveDelta;
  const receivedDelta = new Promise((resolve) => { receiveDelta = resolve; });
  let completed = false;
  const result = sendAssistantMessage({ message: "Hi" }, undefined, receiveDelta).then((reply) => { completed = true; return reply; });
  assert.equal((await receivedDelta).text, "Early text");
  assert.equal(completed, false);
  finish();
  assert.equal((await result).reply, "Early text, finished.");
});

test("Speech API returns generated audio without converting it to text", async () => {
  const audio = new Blob(["RIFF"], { type: "audio/wav" });
  const speak = speechApi(async (path, body, config) => {
    assert.equal(path, "/assistant/speak");
    assert.equal(body.text, "Hello.");
    assert.equal(config.responseType, "blob");
    return { data: audio };
  });
  assert.equal(await speak("Hello."), audio);
});

test("Speech API decodes JSON error blobs so the real failure can be displayed", async () => {
  const err = new Error("HTTP 502");
  err.response = { status: 502, data: new Blob([JSON.stringify({ error: "Voice playback failed. Check speech configuration." })], { type: "application/json" }) };
  const speak = speechApi(async () => { throw err; });
  await assert.rejects(speak("Hello."), (error) => {
    assert.equal(error, err);
    assert.equal(error.response.data.error, "Voice playback failed. Check speech configuration.");
    return true;
  });
});

test("Speech API preserves non-JSON errors and request cancellation", async () => {
  for (const err of [Object.assign(new Error("HTTP 502"), { response: { data: new Blob(["upstream failure"]) } }), Object.assign(new Error("Canceled"), { code: "ERR_CANCELED" })]) {
    const original = err.response?.data;
    const speak = speechApi(async () => { throw err; });
    await assert.rejects(speak("Hello."), (error) => error === err && error.response?.data === original);
  }
});
