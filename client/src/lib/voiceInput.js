// Push-to-talk capture for the voice assistant. Speech becomes text through
// the browser's own SpeechRecognition (Chrome and Edge send the audio to
// their speech service, Safari to Apple's), and a separate microphone stream
// feeds an analyser so the orb can follow how loudly the user is speaking.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// How long stop() waits for the recognizer's last words before giving up on
// them.
const FINAL_RESULT_TIMEOUT_MS = 2500;

const RECOGNITION_ERRORS = {
  "not-allowed": "blocked",
  "service-not-allowed": "blocked",
  "audio-capture": "no-mic",
  network: "network",
};

// Whether the site already holds microphone permission. When the user lets
// go before the microphone opened, this tells a press that was simply too
// short from one spent looking at the browser's permission prompt.
let micPermission = "prompt";
navigator.permissions?.query({ name: "microphone" }).then(
  (status) => {
    micPermission = status.state;
    status.onchange = () => (micPermission = status.state);
  },
  () => {}
);

export const hasMicPermission = () => micPermission === "granted";

// Opens the microphone and starts transcribing. `onTranscript` gets the full
// text heard so far each time it changes, `onReady` fires once the microphone
// is open, and `onError` gets one of: unsupported, blocked, no-mic, network,
// failed. stop() resolves with { transcript, error }, where error can also be
// "pending" (let go while the permission prompt was still up).
export function startVoiceSession({ onTranscript, onReady, onError }) {
  let stream = null;
  let audio = null;
  let analyser = null;
  let samples = null;
  let recognition = null;
  // Text from recognizer runs that already ended. Chrome sometimes ends a
  // run on its own mid-hold, and the next run starts from an empty result
  // list.
  let committed = "";
  let transcript = "";
  let error = null;
  let stopping = false;
  let cancelled = false;
  let ended = false;
  let onEnded = null;

  function releaseMic() {
    stream?.getTracks().forEach((t) => t.stop());
    audio?.close().catch(() => {});
    stream = audio = analyser = null;
  }

  function fail(code) {
    if (error || cancelled) return;
    error = code;
    releaseMic();
    recognition?.abort();
    if (!stopping) onError(code);
  }

  function startRecognition() {
    recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      let run = "";
      for (let i = 0; i < e.results.length; i++) run += e.results[i][0].transcript;
      transcript = `${committed} ${run}`.replace(/\s+/g, " ").trim();
      if (!cancelled) onTranscript(transcript);
    };
    // "no-speech" and "aborted" only mean nothing was said, which stop()
    // reports as an empty transcript.
    recognition.onerror = (e) => RECOGNITION_ERRORS[e.error] && fail(RECOGNITION_ERRORS[e.error]);
    recognition.onend = () => {
      if (!stopping && !cancelled && !error) {
        committed = transcript;
        try {
          recognition.start();
          return;
        } catch {
          // Fall through and treat the run as over.
        }
      }
      ended = true;
      onEnded?.();
    };
    try {
      recognition.start();
    } catch {
      fail("failed");
    }
  }

  if (!Recognition || !navigator.mediaDevices?.getUserMedia) {
    Promise.resolve().then(() => fail("unsupported"));
  } else {
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(
      (s) => {
        micPermission = "granted";
        if (stopping || cancelled || error) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        audio = new (window.AudioContext || window.webkitAudioContext)();
        audio.resume().catch(() => {});
        analyser = audio.createAnalyser();
        analyser.fftSize = 1024;
        samples = new Float32Array(analyser.fftSize);
        audio.createMediaStreamSource(stream).connect(analyser);
        startRecognition();
        onReady?.();
      },
      (err) => fail(err?.name === "NotAllowedError" || err?.name === "SecurityError" ? "blocked" : "no-mic")
    );
  }

  return {
    // Loudness right now, 0 to 1. Room noise sits under about 0.01 RMS and
    // ordinary speech peaks around 0.1 to 0.2.
    readLevel() {
      if (!analyser) return 0;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / samples.length);
      return Math.min(1, Math.max(0, (rms - 0.01) * 7));
    },

    stop() {
      stopping = true;
      releaseMic();
      if (error) return Promise.resolve({ transcript, error });
      if (!recognition) {
        return Promise.resolve({ transcript: "", error: hasMicPermission() ? null : "pending" });
      }
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          recognition.onend = null;
          recognition.abort();
          onEnded();
        }, FINAL_RESULT_TIMEOUT_MS);
        onEnded = () => {
          clearTimeout(timer);
          onEnded = null;
          resolve({ transcript, error });
        };
        if (ended) onEnded();
        else recognition.stop();
      });
    },

    cancel() {
      cancelled = true;
      releaseMic();
      if (recognition) {
        recognition.onresult = recognition.onerror = recognition.onend = null;
        recognition.abort();
      }
      onEnded?.();
    },
  };
}
