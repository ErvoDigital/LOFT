import { copyFileSync, mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";

// OpenClaw's official activation runs Doctor, which may persist provider
// migrations. Seed a writable private config from the read-only repo template.
const target = process.env.OPENCLAW_CONFIG_PATH;
if (!target) throw new Error("OPENCLAW_CONFIG_PATH is required");
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
copyFileSync("/etc/loft/openclaw.json", target);
chmodSync(target, 0o600);
process.execve(process.execPath, [process.execPath, "/app/docker-entrypoint.mjs", "node", "/app/dist/index.js", "gateway", "--bind", "lan", "--port", "18789"], process.env);
