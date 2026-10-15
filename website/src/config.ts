// The marketing site and the authenticated SyncTayo app are separate deployments.
// Override this at build time to use a local or staging app.
const defaultAppUrl = "https://client.synctayo.online";
const configuredAppUrl = import.meta.env.VITE_LOFT_APP_URL?.trim().replace(/\/+$/, "");

// Hosting settings may still contain the retired production origin.
const appUrl =
  !configuredAppUrl ||
  /^https?:\/\/app\.loft-client\.site(?::\d+)?(?:\/|$)/i.test(configuredAppUrl)
    ? defaultAppUrl
    : configuredAppUrl;

export const LOGIN_URL = `${appUrl}/login`;
export const REGISTER_URL = `${appUrl}/register`;
