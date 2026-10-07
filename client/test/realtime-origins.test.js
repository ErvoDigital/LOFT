import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../../realtime/src/origins.mjs";

const config = {
  clientUrl: "https://app.loft-client.site",
  allowedOrigins: "https://app.loft-client.site, https://www.loft-client.site, https://loft-client.site, https://loft-client.vercel.app",
};

test("realtime accepts the app subdomain and existing client origins", () => {
  for (const origin of [config.clientUrl, "https://www.loft-client.site", "https://loft-client.site", "https://loft-client.vercel.app"]) {
    assert.equal(isAllowedOrigin(origin, config), true);
  }
});

test("origin matching rejects unrelated domains, subdomain suffixes and HTTP downgrades", () => {
  for (const origin of ["https://evil.example", "https://app.loft-client.site.evil.example", "https://loft-client.site.evil.example", "http://app.loft-client.site", "http://loft-client.site", "null"]) {
    assert.equal(isAllowedOrigin(origin, config), false);
  }
});

test("origins remain closed when no valid configuration is provided", () => {
  assert.equal(isAllowedOrigin("https://evil.example"), false);
  assert.equal(isAllowedOrigin("https://evil.example", { allowedOrigins: "*,bad-url" }), false);
  assert.equal(isAllowedOrigin(null, config), true);
});
