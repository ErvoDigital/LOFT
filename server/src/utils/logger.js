function safeIdentifier(value, fallback) {
  if (typeof value !== "string" || value.length === 0) return fallback;
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120);
}

export function summarizeError(error) {
  return {
    name: safeIdentifier(error?.name, "Error"),
    code: safeIdentifier(error?.code, "UNKNOWN"),
  };
}

let errorSink = (entry) => console.error(JSON.stringify(entry));

export function logStructuredError(event, fields = {}) {
  errorSink({ level: "error", event, ...fields });
}

export function setErrorSinkForTests(sink) {
  if (typeof sink !== "function") throw new TypeError("A logging sink function is required");
  errorSink = sink;
}

export function resetErrorSinkForTests() {
  errorSink = (entry) => console.error(JSON.stringify(entry));
}
