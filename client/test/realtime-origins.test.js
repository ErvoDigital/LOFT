import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../../realtime/src/origins.mjs";

const config = {
  clientUrl: "https://loft-client.vercel.app",
  allowedOrigins: "https://www.loft-client.site, https://loft-client.site",
};

test("realtime accepts both custom domains and the configured legacy client", () => {
  for (const origin of ["https://www.loft-client.site", "https://loft-client.site", config.clientUrl]) {
    assert.equal(isAllowedOrigin(origin, config), true);
  }
});

test("origin matching rejects unrelated domains, subdomain suffixes and HTTP downgrades", () => {
  for (const origin of ["https://evil.example", "https://loft-client.site.evil.example", "http://loft-client.site", "null"]) {
    assert.equal(isAllowedOrigin(origin, config), false);
  }
});

test("origins remain closed when no valid configuration is provided", () => {
  assert.equal(isAllowedOrigin("https://evil.example"), false);
  assert.equal(isAllowedOrigin("https://evil.example", { allowedOrigins: "*,bad-url" }), false);
  assert.equal(isAllowedOrigin(null, config), true);
});
