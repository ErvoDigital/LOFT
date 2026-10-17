import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../../realtime/src/origins.mjs";

const config = {
  clientUrl: "https://app.loft-client.site",
  allowedOrigins: "https://app.loft-client.site, https://www.loft-client.site, https://loft-client.site, https://loft-client.vercel.app",
};

test("realtime accepts the current production app and existing client origins", () => {
  for (const origin of ["https://client.synctayo.online", config.clientUrl, "https://www.loft-client.site", "https://loft-client.site", "https://loft-client.vercel.app"]) {
    assert.equal(isAllowedOrigin(origin, config), true);
  }
});

test("the current app remains allowed with missing or stale deployment settings", () => {
  for (const settings of [undefined, {}, { clientUrl: "https://app.loft-client.site" }, { allowedOrigins: "https://loft-client.vercel.app" }]) {
    assert.equal(isAllowedOrigin("https://client.synctayo.online", settings), true);
    assert.equal(isAllowedOrigin("https://app.loft-client.site", settings), true);
    assert.equal(isAllowedOrigin("https://unrelated.example", settings), false);
  }
});

test("origin matching rejects unrelated domains, subdomain suffixes and HTTP downgrades", () => {
  for (const origin of ["https://evil.example", "https://client.synctayo.online.evil.example", "https://app.loft-client.site.evil.example", "https://loft-client.site.evil.example", "http://client.synctayo.online", "http://app.loft-client.site", "http://loft-client.site", "null"]) {
    assert.equal(isAllowedOrigin(origin, config), false);
  }
});

test("origins remain closed when no valid configuration is provided", () => {
  assert.equal(isAllowedOrigin("https://evil.example"), false);
  assert.equal(isAllowedOrigin("https://evil.example", { allowedOrigins: "*,bad-url" }), false);
  assert.equal(isAllowedOrigin(null, config), true);
});
