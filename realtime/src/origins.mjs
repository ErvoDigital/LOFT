export function isAllowedOrigin(origin, { clientUrl, allowedOrigins = "" } = {}) {
  // Requests without an Origin header are still authenticated by JWT.
  if (!origin) return true;
  const configured = [clientUrl, ...allowedOrigins.split(",")].filter(Boolean);
  return configured.some((value) => {
    try {
      const url = new URL(value.trim());
      return ["http:", "https:"].includes(url.protocol) && url.origin === origin;
    } catch {
      return false;
    }
  });
}
