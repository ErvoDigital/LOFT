import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:4000",
        "/socket.io": { target: "http://localhost:4000", ws: true },
        // Realtime (chat, meetings, live docs, notifications) is served by a
        // separate Neon Function (see /realtime), not by this repo's Express
        // server — proxied to whatever VITE_REALTIME_PROXY_TARGET points at
        // (see client/.env) rather than requiring `neon dev` for local dev.
        // Routed through this proxy (rather than pointing the client at it
        // directly via VITE_REALTIME_URL) specifically so the Origin header
        // can be rewritten here: the function only accepts its configured
        // CLIENT_URL, which is the production client's origin, not
        // localhost — a direct browser connection would fail its CORS check.
        ...(env.VITE_REALTIME_PROXY_TARGET
          ? {
              "/ws": {
                target: env.VITE_REALTIME_PROXY_TARGET,
                ws: true,
                changeOrigin: true,
                headers: env.VITE_REALTIME_PROXY_ORIGIN ? { origin: env.VITE_REALTIME_PROXY_ORIGIN } : {},
              },
            }
          : {}),
      },
    },
  };
});
