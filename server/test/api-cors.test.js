import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { clientOrigins } from "../src/config/clientOrigins.js";

const appOrigin = "https://app.loft-client.site";
const legacyOrigin = "https://www.loft-client.site";
const extraOrigin = "https://preview.loft.test";
const localOrigin = "http://localhost:5173";
const envKeys = ["JWT_SECRET", "CLIENT_URL", "CLIENT_ALLOWED_ORIGINS"];
const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let server, baseUrl, token, fake, clearPrismaClient;

before(async () => {
  process.env.JWT_SECRET = "api-cors-test-secret";
  // Reproduce a deployment that still uses the previous www origin.
  process.env.CLIENT_URL = legacyOrigin;
  process.env.CLIENT_ALLOWED_ORIGINS = `${extraOrigin}/, ${localOrigin}`;
  const { createApp } = await import("../src/app.js");
  const prismaModule = await import("../src/db/prisma.js");
  clearPrismaClient = prismaModule.clearPrismaClient;
  const { signToken } = await import("../src/utils/jwt.js");
  token = signToken({ sub: "u-existing" });
  fake = { workspace: { findMany: async ({ where }) => {
    assert.equal(where.members.some.userId, "u-existing");
    return [{ id: "ws-existing", name: "Existing team", members: [{ role: "ADMIN", permissions: "" }], _count: { members: 2 } }];
  } } };
  prismaModule.setPrismaClient(fake);
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (fake) clearPrismaClient(fake);
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function request(path, origin = appOrigin, options = {}) {
  const { headers, ...rest } = options;
  return fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: { Origin: origin, Authorization: `Bearer ${token}`, ...headers },
  });
}

function assertReadable(res, origin) {
  assert.equal(res.headers.get("access-control-allow-origin"), origin);
  assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  assert.match(res.headers.get("vary"), /(?:^|,\s*)Origin(?:,|$)/);
  assert.match(res.headers.get("cache-control"), /no-store/);
}

test("the app can retrieve existing workspaces even with the previous CLIENT_URL", async () => {
  const res = await request("/workspaces");
  assert.equal(res.status, 200);
  assertReadable(res, appOrigin);
  assert.equal(res.headers.get("etag"), null);
  const body = await res.json();
  assert.equal(body.workspaces[0].name, "Existing team");
  assert.equal(body.workspaces[0].myRole, "ADMIN");
});

test("workspace and assistant reads ignore old cache validators instead of returning 304", async () => {
  for (const path of ["/workspaces", "/assistant/status"]) {
    for (const headers of [
      { "If-None-Match": 'W/"cached-before-domain-change"' },
      { "If-None-Match": "*" },
      { "If-Modified-Since": "Wed, 01 Jan 2030 00:00:00 GMT" },
    ]) {
      const res = await request(path, appOrigin, { headers });
      assert.equal(res.status, 200);
      assertReadable(res, appOrigin);
      assert.equal(res.headers.get("etag"), null);
      const body = await res.json();
      if (path === "/workspaces") assert.equal(body.workspaces[0].id, "ws-existing");
      else assert.equal(typeof body.configured, "boolean");
    }
  }
});

test("each configured browser origin receives its own matching CORS header", async () => {
  for (const origin of [appOrigin, legacyOrigin, extraOrigin, localOrigin]) {
    const res = await request("/workspaces", origin);
    assert.equal(res.status, 200);
    assertReadable(res, origin);
    await res.arrayBuffer();
  }
});

test("preflight permits authorization headers from the app and configured origins", async () => {
  for (const origin of [appOrigin, legacyOrigin, extraOrigin, localOrigin]) {
    const res = await request("/workspaces", origin, {
      method: "OPTIONS",
      headers: { "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" },
    });
    assert.equal(res.status, 204);
    assertReadable(res, origin);
    assert.equal(res.headers.get("access-control-allow-headers"), "authorization");
  }
});

test("unrelated origins and lookalike domains are not granted browser access", async () => {
  for (const origin of ["https://evil.test", `${appOrigin}.evil.test`, "http://app.loft-client.site", "null"]) {
    const res = await request("/workspaces", origin);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    await res.arrayBuffer();
  }
});

test("authentication errors keep matching CORS and no-store headers", async () => {
  const res = await request("/workspaces", appOrigin, { headers: { Authorization: "Bearer invalid" } });
  assert.equal(res.status, 401);
  assertReadable(res, appOrigin);
  assert.match((await res.json()).error, /Invalid or expired token/);
});

test("origin configuration normalizes URLs, removes duplicates and excludes wildcards", () => {
  assert.deepEqual(clientOrigins({
    CLIENT_URL: `${appOrigin}/`,
    CLIENT_ALLOWED_ORIGINS: `${appOrigin}, ${legacyOrigin}/, *, ftp://example.test, invalid`,
  }), [appOrigin, legacyOrigin]);
});
