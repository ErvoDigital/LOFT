import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import http from "node:http";
import dotenv from "dotenv";

const exec = promisify(execFile);
const cli = fileURLToPath(new URL("./openclaw.mjs", import.meta.url));
const root = fileURLToPath(new URL("../", import.meta.url));

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "loft-gateway-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("OPENCLAW_") || key === "OPENROUTER_API_KEY") delete env[key];
  const path = join(dir, "gateway.env");
  return { path, run: (args, overrides = {}) => exec(process.execPath, [cli, ...args, "--settings-file", path], { cwd: root, env: { ...env, ...overrides } }) };
}

test("Lightsail setup isolates credentials and preserves the token on repeat runs", async (t) => {
  const f = await fixture(t);
  const first = await f.run(["setup", "--lightsail"]);
  const initial = dotenv.parse(await readFile(f.path, "utf8"));
  assert.match(initial.OPENCLAW_GATEWAY_TOKEN, /^[a-f0-9]{64}$/);
  assert.equal(initial.DATABASE_URL, undefined);
  assert.equal(initial.JWT_SECRET, undefined);
  assert.ok(!first.stdout.includes(initial.OPENCLAW_GATEWAY_TOKEN));
  await writeFile(f.path, `${await readFile(f.path, "utf8")}\nOPENCLAW_DOMAIN="ai.example.com"\nOPENROUTER_API_KEY="test-provider-secret"\n`);
  await f.run(["setup", "--lightsail"]);
  const updated = dotenv.parse(await readFile(f.path, "utf8"));
  assert.equal(updated.OPENCLAW_GATEWAY_TOKEN, initial.OPENCLAW_GATEWAY_TOKEN);
  assert.equal(updated.OPENCLAW_DOMAIN, "ai.example.com");
  assert.equal(updated.OPENROUTER_API_KEY, "test-provider-secret");
});

test("Local setup preserves a configured remote gateway and existing backend settings", async (t) => {
  const f = await fixture(t);
  await writeFile(f.path, 'DATABASE_URL="test-db"\nOPENCLAW_GATEWAY_URL="https://ai.example.com"\nOPENCLAW_GATEWAY_TOKEN="existing-token"\n');
  await f.run(["setup"]);
  const env = dotenv.parse(await readFile(f.path, "utf8"));
  assert.equal(env.DATABASE_URL, "test-db");
  assert.equal(env.OPENCLAW_GATEWAY_URL, "https://ai.example.com");
  assert.equal(env.OPENCLAW_GATEWAY_TOKEN, "existing-token");
});

test("Connectivity check uses deployed environment settings without an env file", async (t) => {
  const f = await fixture(t);
  let requests = 0;
  const server = http.createServer((req, res) => {
    requests++;
    assert.equal(req.url, "/v1/models");
    assert.equal(req.headers.authorization, "Bearer test-connectivity-token");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ id: "openclaw" }] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const overrides = { OPENCLAW_GATEWAY_URL: `http://127.0.0.1:${server.address().port}/`, OPENCLAW_GATEWAY_TOKEN: "test-connectivity-token" };
  const result = await f.run(["check"], overrides);
  assert.match(result.stdout, /reachable and authenticated/);
  // Stale file settings must not silently test a different gateway/token.
  await writeFile(f.path, 'OPENCLAW_GATEWAY_URL="http://127.0.0.1:1"\nOPENCLAW_GATEWAY_TOKEN="stale-token"\n');
  await f.run(["check"], overrides);
  assert.equal(requests, 2);
});

test("Connectivity check rejects wrong endpoints and redirects without inference", async (t) => {
  const f = await fixture(t);
  let redirect = false;
  let responseStatus = 200;
  let body = { data: [{ id: "unrelated-model" }] };
  const server = http.createServer((_req, res) => {
    res.statusCode = redirect ? 302 : responseStatus;
    if (redirect) res.setHeader("Location", "/different-service");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await writeFile(f.path, `OPENCLAW_GATEWAY_URL="http://127.0.0.1:${server.address().port}"\nOPENCLAW_GATEWAY_TOKEN="test-token"\n`);
  await assert.rejects(f.run(["check"]), (err) => /unexpected model list/.test(err.stderr));
  responseStatus = 401;
  body = { error: "private-upstream-error" };
  await assert.rejects(f.run(["check"]), (err) => /HTTP 401/.test(err.stderr) && !err.stderr.includes("private-upstream-error"));
  redirect = true;
  await assert.rejects(f.run(["check"]), (err) => !err.stderr.includes("test-token"));
});

test("Lightsail preflight rejects a URL used as the domain before invoking Docker", async (t) => {
  const f = await fixture(t);
  await writeFile(f.path, 'OPENCLAW_DOMAIN="https://ai.example.com/path"\nOPENCLAW_GATEWAY_TOKEN="test-token"\nOPENROUTER_API_KEY="test-provider-key"\n');
  await assert.rejects(f.run(["config", "--lightsail"]), (err) => /DNS hostname/.test(err.stderr) && !err.stderr.includes("test-provider-key"));
});
