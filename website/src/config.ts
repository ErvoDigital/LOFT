// The marketing site and the authenticated SyncTayo app are separate deployments.
// Override this at build time to use a local or staging app.
const appUrl =
  import.meta.env.VITE_LOFT_APP_URL?.trim() || "https://client.synctayo.online";

export const LOGIN_URL = `${appUrl.replace(/\/+$/, "")}/login`;
export const REGISTER_URL = `${appUrl.replace(/\/+$/, "")}/register`;
