import { copyFileSync, mkdirSync, chmodSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

// OpenClaw's official activation runs Doctor, which may persist provider
// migrations. Seed a writable private config from the read-only repo template.
const target = process.env.OPENCLAW_CONFIG_PATH;
if (!target) throw new Error("OPENCLAW_CONFIG_PATH is required");
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
copyFileSync("/etc/loft/openclaw.json", target);
chmodSync(target, 0o600);

// Existing installations read authored settings from SQLite. Copying the JSON
// seed alone cannot enable a newly mounted plugin in that active config store.
const template = JSON.parse(readFileSync("/etc/loft/openclaw.json", "utf8"));
if (template.plugins) {
  const configured = spawnSync(process.execPath, ["/app/dist/index.js", "config", "set", "plugins", JSON.stringify(template.plugins), "--strict-json", "--merge"], {
    env: process.env,
    stdio: "inherit",
  });
  if (configured.error || configured.status !== 0) throw new Error("Could not apply LOFT's OpenClaw plugin settings.");
}
process.execve(process.execPath, [process.execPath, "/app/docker-entrypoint.mjs", "node", "/app/dist/index.js", "gateway", "--bind", "lan", "--port", "18789"], process.env);
