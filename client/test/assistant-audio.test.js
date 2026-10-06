import test from "node:test";
import assert from "node:assert/strict";
import { createAssistantAudio } from "../src/utils/assistantAudio.js";

function context() {
  const sources = [];
  const buffer = { duration: 2 };
  return {
    state: "running",
    currentTime: 10,
    destination: {},
    sources,
    async decodeAudioData(bytes) { assert.ok(bytes.byteLength); return buffer; },
    createBufferSource() {
      const source = {
        started: false,
        stopped: false,
        connect(destination) { assert.equal(destination, this.context.destination); },
        context: this,
        disconnect() {},
        start() { this.started = true; },
        stop() { this.stopped = true; this.onended(); },
      };
      sources.push(source);
      return source;
    },
  };
}

test("Generated replies play through the gesture-unlocked context and replay from cached audio", async () => {
  const unlocked = context();
  const { audio, url } = await createAssistantAudio(new Blob(["audio"]), unlocked);
  assert.equal(url, null);
  assert.equal(unlocked.sources.length, 0);
  let ended = 0;
  audio.onended = () => ended++;
  await audio.play();
  assert.equal(unlocked.sources[0].started, true);
  assert.equal(audio.duration, 2);
  assert.equal(audio.currentTime, 0);
  unlocked.currentTime += 0.5;
  assert.equal(audio.currentTime, 0.5);
  assert.equal(audio.ended, false);
  unlocked.sources[0].onended();
  assert.equal(ended, 1);
  assert.equal(audio.currentTime, 2);
  assert.equal(audio.ended, true);
  await audio.play();
  assert.equal(unlocked.sources[1].started, true);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.ended, false);
  assert.equal(unlocked.sources[0].buffer, unlocked.sources[1].buffer);
  audio.pause();
  assert.equal(unlocked.sources[1].stopped, true);
  assert.equal(ended, 1);
});

test("Stopping reply playback freezes its clock even while the audio context keeps running", async () => {
  const unlocked = context();
  const { audio } = await createAssistantAudio(new Blob(["audio"]), unlocked);
  await audio.play();
  unlocked.currentTime += 0.75;
  audio.pause();
  unlocked.currentTime += 5;
  assert.equal(audio.currentTime, 0.75);
  assert.equal(audio.ended, false);
});

test("Suspended audio reports autoplay restrictions instead of silently pretending to play", async () => {
  const blocked = context();
  blocked.state = "suspended";
  const { audio } = await createAssistantAudio(new Blob(["audio"]), blocked);
  await assert.rejects(audio.play(), { name: "NotAllowedError" });
  assert.equal(blocked.sources.length, 0);
  blocked.state = "running";
  await audio.play();
  assert.equal(blocked.sources[0].started, true);
  audio.pause();
});

test("Unsupported Web Audio formats retain an audio element for browser playback", async (t) => {
  const originalAudio = globalThis.Audio;
  globalThis.Audio = class { constructor(url) { this.src = url; } };
  t.after(() => { globalThis.Audio = originalAudio; });
  const { audio, url } = await createAssistantAudio(new Blob(["audio"], { type: "audio/mpeg" }), {
    async decodeAudioData() { throw new Error("Unsupported format"); },
  });
  assert.match(url, /^blob:/);
  assert.equal(audio.src, url);
  URL.revokeObjectURL(url);
});
