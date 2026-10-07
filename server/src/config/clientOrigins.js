const APP_ORIGIN = "https://app.loft-client.site";

export function clientOrigins(env = process.env) {
  const configured = [APP_ORIGIN, env.CLIENT_URL, ...(env.CLIENT_ALLOWED_ORIGINS || "").split(",")];
  const origins = configured.flatMap((value) => {
    if (!value) return [];
    try {
      const url = new URL(value.trim());
      return ["http:", "https:"].includes(url.protocol) ? [url.origin] : [];
    } catch {
      return [];
    }
  });
  return [...new Set(origins)];
}
