import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/api/assistant.js", import.meta.url), "utf8");
const { code } = await transform(source, { format: "cjs" });

function speechApi(post) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, Blob, require: () => ({ api: { post } }) });
  return module.exports.speakAssistantReply;
}

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
