const LOCAL_GATEWAY_URL = "http://127.0.0.1:18789";
const PRODUCTION_GATEWAY_URL = "https://ai.synctayo.online";

export function gatewayConfig(env = process.env) {
  const configuredUrl = (env.OPENCLAW_GATEWAY_URL || LOCAL_GATEWAY_URL).trim().replace(/\/+$/, "");
  // Production deployments can retain the hostname saved before the domain
  // move. Text, transcription, playback and connectivity checks share this.
  const url = /^https?:\/\/openclaw\.loft-client\.site(?::443)?$/i.test(configuredUrl)
    ? PRODUCTION_GATEWAY_URL : configuredUrl;
  return { url, token: env.OPENCLAW_GATEWAY_TOKEN };
}
