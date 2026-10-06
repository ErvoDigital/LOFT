// A context resumed during the talk-key gesture can play the completed reply
// even after transcription, reasoning and synthesis have used that gesture up.
export async function createAssistantAudio(blob, context) {
  if (context) {
    try {
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      let source = null;
      let startedAt = 0;
      let stoppedAt = 0;
      let ended = false;
      const audio = {
        onended: null,
        onerror: null,
        get duration() { return buffer.duration; },
        get currentTime() {
          return source ? Math.min(buffer.duration, Math.max(0, context.currentTime - startedAt)) : stoppedAt;
        },
        get ended() { return ended; },
        async play() {
          if (context.state !== "running") {
            throw Object.assign(new Error("Audio playback needs a user gesture."), { name: "NotAllowedError" });
          }
          audio.pause();
          const next = context.createBufferSource();
          next.buffer = buffer;
          next.connect(context.destination);
          next.onended = () => {
            next.disconnect();
            if (source !== next) return;
            source = null;
            stoppedAt = buffer.duration;
            ended = true;
            audio.onended?.();
          };
          startedAt = context.currentTime;
          stoppedAt = 0;
          ended = false;
          source = next;
          next.start();
        },
        pause() {
          if (!source) return;
          const previous = source;
          stoppedAt = audio.currentTime;
          source = null;
          previous.stop();
          previous.disconnect();
        },
      };
      return { audio, url: null };
    } catch {
      // Keep playback available if Web Audio cannot decode the provider format.
    }
  }
  const url = URL.createObjectURL(blob);
  return { audio: new Audio(url), url };
}
