const APP_ORIGINS = ["https://client.synctayo.online", "https://app.loft-client.site"];

export function isAllowedOrigin(origin, { clientUrl, allowedOrigins = "" } = {}) {
  // Requests without an Origin header are still authenticated by JWT.
  if (!origin) return true;
  // Keep the current app reachable when a deployed function still has the
  // previous domain in its environment, just like the REST API's allowlist.
  const configured = [...APP_ORIGINS, clientUrl, ...allowedOrigins.split(",")].filter(Boolean);
  return configured.some((value) => {
    try {
      const url = new URL(value.trim());
      return ["http:", "https:"].includes(url.protocol) && url.origin === origin;
    } catch {
      return false;
    }
  });
}
