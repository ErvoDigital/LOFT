# LOFT Assistant with OpenClaw and OpenRouter

This guide documents the currently implemented integration. For the combined V1 vision, architecture decisions, remaining work, and demo acceptance tests, see the [consolidated AI integration plan](AI-Workspace-Assistant-Integration-OpenClaw.md). The [V1 update](LOFT_V1_AI_Integration_Update.md) is now a decision summary pointing to that plan.

The assistant uses this path:

`LOFT browser → authenticated LOFT API → private OpenClaw gateway → OpenRouter`

LOFT executes the tool calls. OpenClaw receives only scoped task/event data and conversation text, not database credentials or LOFT login tokens. The OpenRouter key stays in the gateway environment. This integration uses the official [OpenResponses HTTP API](https://docs.openclaw.ai/gateway/openresponses-http-api) and [OpenRouter provider](https://docs.openclaw.ai/providers/openrouter).

## Local setup

Docker Desktop with its Linux engine running and the existing LOFT database/server configuration are prerequisites. From the repository root:

1. Run `npm run ai:setup`. This preserves existing server settings, creates a random gateway token if missing, and adds the AI settings to `server/.env`. It never prints secrets.
2. Add your key to `OPENROUTER_API_KEY="..."` in `server/.env`. This is the only external AI credential you need to supply. Your OpenRouter account needs access/credits for the chosen model.
3. Run `npm run ai:start`. It downloads the pinned official OpenClaw Docker image and starts the gateway on host loopback port 18789.
4. Start or restart LOFT using `npm run dev` so the server loads the gateway token.
5. Run `npm run ai:check` to check gateway authentication, then open the assistant in LOFT and ask about your tasks to verify inference.

`npm run ai:logs` shows gateway logs. `npm run ai:stop` stops the container without deleting state. Do not share unredacted logs. If there was no server `.env`, setup creates one from the example; the existing database and login configuration must still be filled in.

## First-version capabilities

- List accessible workspaces and workspace member names/IDs.
- Read up to 100 unfinished tasks assigned to the signed-in user and up to 100 events over the next 14 days.
- Explain conflicts computed by LOFT's existing conflict detector, within those returned records. Deadline comparisons currently use the API host's time zone, as the existing detector does.
- Prepare task and meeting proposals. A user must click **Confirm** to save. **Dismiss** makes no changes.

Proposals expire after ten minutes. The server rechecks membership and attendees/assignees on confirmation. It creates through existing controllers so normal notifications and realtime events still run. Signed proposal UUIDs become record primary keys, preventing duplicate records from concurrent confirmations and retries. Authentication tokens cannot be used as confirmation tokens. No schema migration is needed. If notifications fail after a record was committed, a retry recognizes the saved record; it does not replay failed notifications.

The workspace context restricts reads and proposals to that workspace. The global dashboard context allows all caller memberships. The browser clears conversation on workspace/account changes and reload; each message uses an isolated gateway session, with private continuations only during its tool loop. OpenClaw retains its own session transcripts in the Docker volume; browser clearing does not erase gateway transcripts. Configure gateway retention/backups to suit your deployment.

Task editing, deletion, message access, transcripts/summaries, free/busy scheduling and persistent LOFT conversation history are outside this first version. A meeting request needs a workspace, explicit times/duration and attendees; the assistant can ask for missing details. Confirmations show dates in the browser's time zone.

## Model and gateway configuration

The gateway config is `infra/openclaw/openclaw.json`. It defaults to the officially documented `openrouter/auto`; you can replace `agents.defaults.model.primary` with an OpenRouter model reference that supports tool calling, then restart the gateway. Automatic routing can vary price and model choice. The consolidated V1 plan calls for a single verified GPT-5.6 model target instead of automatic routing; that selection and live verification remain pending, and this documentation update does not change the runtime config. Host filesystem, shell, messaging, memory and other built-in agent tools are disabled; only LOFT's supplied client tools are available. No Docker socket or LOFT source/database is mounted in the container.

The official image is pinned by digest in `infra/openclaw/compose.yml` for reproducibility. Upgrade deliberately and repeat gateway contract tests. Startup copies the read-only config template into the private writable state volume, then invokes the official image activation (including Doctor) before running the gateway. Edit the repository template for persistent config changes; startup replaces the runtime copy.

## Deployment

For a Docker gateway on AWS Lightsail, use the [Lightsail setup guide](LIGHTSAIL.md). It includes a separate gateway secrets file, an HTTPS Compose overlay, host prerequisites, firewall settings and the two backend variables needed to connect the existing website. Start with `npm run ai:lightsail:setup` on the VPS.

The Docker setup is for an API running on the same host. A serverless API deployment cannot run this container itself. Host the gateway as a separate persistent service and set `OPENCLAW_GATEWAY_URL` and the same `OPENCLAW_GATEWAY_TOKEN` on the deployed LOFT backend. Set `OPENROUTER_API_KEY` on that gateway. Keep its endpoint private or protect it with TLS and network restrictions; its bearer token grants gateway operator access. Do not expose it to browsers.

The API bounds each message to six gateway rounds, eight calls per round, a 90-second gateway budget, three proposals, and a small conversation history. Paid requests are limited to ten per minute and one active request per user per process. Replicated deployments need a shared proxy/gateway limiter and an API request timeout compatible with this budget. `/api/assistant/status` reports whether a token is configured, not gateway health or OpenRouter credit availability.

## Verification

Run `node --test server/test/assistant.test.js` and `npm run build`. The tests use mock gateways/databases: they do not spend OpenRouter credits or modify live data. A real gateway/model check requires Docker, an OpenRouter key and a configured LOFT database. Confirm both task and meeting proposals in a test workspace and verify notification delivery, reload persistence and workspace isolation before deployment.
