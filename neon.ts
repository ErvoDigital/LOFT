import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      "loft-assets": {}, // private — workspace file storage, served via presigned URLs
    },
    functions: {
      realtime: {
        name: "loft realtime",
        source: "realtime/src/index.js",
        env: {
          JWT_SECRET: process.env.JWT_SECRET,
          CLIENT_URL: process.env.CLIENT_URL ?? "https://app.loft-client.site",
          REALTIME_ALLOWED_ORIGINS: process.env.REALTIME_ALLOWED_ORIGINS
            ?? "https://app.loft-client.site,https://www.loft-client.site,https://loft-client.site,https://loft-client.vercel.app",
        },
      },
    },
  },
});
