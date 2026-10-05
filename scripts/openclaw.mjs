import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import dotenv from "dotenv";

const root = fileURLToPath(new URL("../", import.meta.url));
for (let index = 3; index < process.argv.length; index++) {
  const option = process.argv[index];
  if (option === "--lightsail") continue;
  if (option === "--settings-file") {
    if (!process.argv[index + 1] || process.argv[index + 1].startsWith("--")) throw new Error("--settings-file requires a path.");
    index++;
    continue;
  }
  throw new Error("Unknown option. Use --lightsail or --settings-file PATH.");
}
const lightsail = process.argv.includes("--lightsail");
const envFileIndex = process.argv.indexOf("--settings-file");
const envPath = envFileIndex === -1
  ? fileURLToPath(new URL(lightsail ? "../infra/openclaw/.env.lightsail" : "../server/.env", import.meta.url))
  : resolve(process.cwd(), process.argv[envFileIndex + 1]);
const command = process.argv[2] || "setup";
if (!["setup", "start", "stop", "logs", "check", "config"].includes(command)) throw new Error("Use setup, start, stop, logs, check or config; optionally --lightsail and --settings-file PATH.");

async function setup() {
  let source;
  try { source = await readFile(envPath, "utf8"); }
  catch (err) {
    if (err.code !== "ENOENT") throw err;
    source = await readFile(new URL(lightsail ? "../infra/openclaw/.env.lightsail.example" : "../server/.env.example", import.meta.url), "utf8");
    await writeFile(envPath, source, { mode: 0o600, flag: "wx" });
  }
  const env = dotenv.parse(source);
  const defaults = {
    ...(!lightsail && { OPENCLAW_GATEWAY_URL: "http://127.0.0.1:18789" }),
    OPENCLAW_GATEWAY_TOKEN: randomBytes(32).toString("hex"),
    OPENCLAW_PRIMARY_MODEL: "openrouter/openai/gpt-4o-mini",
    OPENROUTER_API_KEY: "",
    OPENROUTER_STT_MODEL: "openai/gpt-4o-mini-transcribe",
    OPENROUTER_TTS_MODEL: "openai/gpt-4o-mini-tts",
    OPENROUTER_TTS_VOICE: "alloy",
  };
  for (const [name, value] of Object.entries(defaults)) {
    if (env[name]) continue;
    // Replace an existing blank entry instead of creating duplicate env keys.
    const line = `${name}="${value}"`;
    const pattern = new RegExp(`^${name}=.*$`, "m");
    if (pattern.test(source)) source = source.replace(pattern, () => line);
    else source += `\n${line}\n`;
  }
  await writeFile(envPath, source, { mode: 0o600 });
  console.log(lightsail
    ? "Lightsail gateway settings prepared. Set OPENCLAW_DOMAIN and OPENROUTER_API_KEY in the gateway env file, then run npm run ai:lightsail:config and npm run ai:lightsail:start. See docs/ai/LIGHTSAIL.md for backend settings."
    : "Assistant settings prepared. Add your OPENROUTER_API_KEY to the env file, start Docker, then run npm run ai:start. Restart the LOFT server afterward.");
  return dotenv.parse(source);
}

if (command === "setup") await setup();
else {
  let fileEnv = {};
  try { fileEnv = dotenv.parse(await readFile(envPath, "utf8")); }
  catch (err) { if (err.code !== "ENOENT" || command !== "check") throw err; }
  // Deployed backend settings take precedence, including for connectivity checks.
  const env = { ...fileEnv, ...process.env };
  if (command === "check") {
    if (!env.OPENCLAW_GATEWAY_TOKEN) throw new Error("Configure OPENCLAW_GATEWAY_TOKEN or run the appropriate ai:setup command first.");
    const url = (env.OPENCLAW_GATEWAY_URL || (lightsail && env.OPENCLAW_DOMAIN ? `https://${env.OPENCLAW_DOMAIN}` : "http://127.0.0.1:18789")).replace(/\/+$/, "");
    const response = await fetch(`${url}/v1/models`, { headers: { Authorization: `Bearer ${env.OPENCLAW_GATEWAY_TOKEN}` }, redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Gateway check failed (HTTP ${response.status}). Check the gateway URL, token and logs.`);
    const data = await response.json();
    if (!Array.isArray(data.data) || !data.data.some((model) => model.id === "openclaw" || model.id === "openclaw/default")) throw new Error("Gateway check returned an unexpected model list. Check the gateway URL and reverse proxy.");
    console.log("OpenClaw gateway is reachable and authenticated. This does not test paid inference; send a message in LOFT to test OpenRouter.");
  } else {
    if (["start", "config"].includes(command)) {
      if (!env.OPENROUTER_API_KEY || !env.OPENCLAW_GATEWAY_TOKEN) throw new Error("Run the appropriate ai:setup command and add OPENROUTER_API_KEY to its env file first.");
      if (lightsail && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(env.OPENCLAW_DOMAIN || "")) throw new Error("Set OPENCLAW_DOMAIN to a DNS hostname (without a scheme, port or path).");
    }
    const args = ["compose", "--env-file", envPath, "-f", "infra/openclaw/compose.yml", ...(lightsail ? ["-f", "infra/openclaw/compose.lightsail.yml"] : []), ...(command === "start" ? ["up", "-d"] : command === "stop" ? ["stop"] : command === "config" ? ["config", "--quiet"] : ["logs", "--tail", "100", "-f"])];
    const result = spawnSync("docker", args, { cwd: root, env, stdio: "inherit", shell: false });
    if (result.error) throw new Error("Docker was not found. Install Docker Engine with the Compose plugin (or Docker Desktop locally).");
    process.exitCode = result.status ?? 1;
  }
}
