// The marketing site and the authenticated LOFT app are separate deployments.
// Override this at build time to use a local or staging app.
const appUrl =
  import.meta.env.VITE_LOFT_APP_URL?.trim() || "https://app.loft-client.site";

export const LOGIN_URL = `${appUrl.replace(/\/+$/, "")}/login`;
