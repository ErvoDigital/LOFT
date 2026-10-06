# Lofty — LOFT Assistant with OpenClaw and OpenRouter

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
- Existing voice plumbing: short microphone clips are transcribed server-side, and assistant text replies can be played back as audio. The intended product is a separate premium voice mode; a session-scoped Voice mode toggle is available for testing, while backend subscription checks and voice allowances are not implemented yet. See the consolidated plan before enabling premium access.

The assistant must follow the user's explicit request, clarify missing or ambiguous details before proposing, and avoid unsolicited actions or inferred follow-ups. Task proposals require a resolved assignee and priority; the backend supplies neither default. Advice and summaries do not authorize changes. Every save still requires confirmation of the exact preview; conversational approval cannot save records.

Tools execute as the authenticated member, never through a master admin key or shared LOFT admin account. The server supplies workspace-specific roles and effective grants, reloads membership at every active-context tool call, and scopes global reads to current memberships. Workspace discovery returns current roles/grants per team; authority never carries over between teams. Gateway/provider keys authenticate infrastructure and confer no LOFT permissions. Future tools must enforce the same role, delegated-ability and resource checks as normal routes, including middleware checks that direct controller calls would otherwise skip.

Clarification and intent interpretation rely on model instructions. Strict schemas, authorization and explicit confirmation enforce the persistence boundary; live model testing is still required to validate conversation behavior.

Proposals expire after ten minutes. The server rechecks membership and attendees/assignees on confirmation. It creates through existing controllers so normal notifications and realtime events still run. Signed proposal UUIDs become record primary keys, preventing duplicate records from concurrent confirmations and retries. Authentication tokens cannot be used as confirmation tokens. No schema migration is needed. If notifications fail after a record was committed, a retry recognizes the saved record; it does not replay failed notifications.

The workspace context restricts reads and proposals to that workspace. The global dashboard context allows all caller memberships. The browser clears conversation on workspace/account changes and reload; each message uses an isolated gateway session, with private continuations only during its tool loop. OpenClaw retains its own session transcripts in the Docker volume; browser clearing does not erase gateway transcripts. Configure gateway retention/backups to suit your deployment.

Task editing, deletion, message access, transcripts/summaries, free/busy scheduling and persistent LOFT conversation history are outside this first version. A meeting request needs a workspace, explicit times/duration and attendees; the assistant can ask for missing details. Confirmations show dates in the browser's time zone.

## Model and gateway configuration

The gateway config is `infra/openclaw/openclaw.json`. It now uses `OPENCLAW_PRIMARY_MODEL` instead of automatic routing so tool behavior and token usage are predictable across runs. `npm run ai:setup` writes a pinned default (`openrouter/openai/gpt-4o-mini`), and you can replace that environment value with another tool-capable OpenRouter model reference before restarting the gateway.

The architecture mixes explicit models by role through one OpenRouter key on the OpenClaw host: reasoning, speech recognition, and speech synthesis. The gateway currently selects one reasoning model; additional reasoning routing remains work. LOFT sends voice to the gateway's `loft-speech` plugin using the same URL and token as text. The plugin registers authenticated `POST /v1/audio/transcriptions` and `POST /v1/audio/speech` routes and calls OpenRouter with the gateway's key; speech stays outside the agent's tool loop. Voice is planned as a separate premium feature. Current LOFT speech routes enforce authentication and supplied workspace membership, but do not enforce premium entitlement or the message route's rate limits. Configure these values on the **OpenClaw host** (`server/.env` for local Docker, or the VPS's `infra/openclaw/.env.lightsail`):

- `OPENROUTER_API_KEY` (required for both assistant inference and voice)
- `OPENROUTER_STT_MODEL` (default `openai/gpt-4o-mini-transcribe`)
- `OPENROUTER_TTS_MODEL` (default `google/gemini-3.1-flash-tts-preview`)
- `OPENROUTER_TTS_VOICE` (default `Kore`)

A remote LOFT backend needs only `OPENCLAW_GATEWAY_URL` and `OPENCLAW_GATEWAY_TOKEN` for text and audio. Its `OPENROUTER_*` settings are not used for speech. Local Docker shares `server/.env` with the gateway, so keep the provider key there for that deployment. The checked-in Compose configuration mounts and enables the speech plugin automatically. Existing remote gateways need the updated plugin, OpenClaw config, Compose file and Caddy routes deployed; see [Lightsail deployment](LIGHTSAIL.md#upgrade-an-existing-gateway-for-audio). A missing speech route produces an installation error, with no direct-provider fallback.

Voice replies are audio cards with automatic playback and play/stop controls, rather than written answer bubbles. Speech failures show an error and a retry control on the audio card; they do not switch the response to text. Users can send a typed message to switch back to text interaction. Confirmation previews remain visible in both modes. Host filesystem, shell, messaging, memory and other built-in agent tools are disabled; only LOFT's supplied client tools are available. No Docker socket or LOFT source/database is mounted in the container.

Gemini TTS requires PCM output through OpenRouter. The speech plugin requests PCM and wraps the 24 kHz mono 16-bit samples in a WAV header for browser playback; other configured speech models continue to request MP3. An older plugin that requests MP3 for Gemini will fail with a provider rejection. Deploy the updated `infra/openclaw/plugins/loft-speech/index.js` and restart the gateway to apply this fix; see [gateway upgrades](LIGHTSAIL.md#upgrade-an-existing-gateway-for-audio).

If voice reports insufficient OpenRouter credits (HTTP 402), top up the OpenRouter account used by the **gateway's** `OPENROUTER_API_KEY` at [OpenRouter credits](https://openrouter.ai/settings/credits). Audio requests can require a minimum available balance even for a short clip; a diagnostic request on October 5, 2026 required at least $0.50. Retry recording after adding credits. The assistant setup status only checks gateway configuration, so it can appear configured while speech is blocked by billing.

The official image is pinned by digest in `infra/openclaw/compose.yml` for reproducibility. Upgrade deliberately and repeat gateway contract tests. Startup copies the read-only config template into the private writable state volume and applies its plugin settings through `openclaw config set`, then invokes the official image activation (including Doctor) before running the gateway. Existing installations keep authored settings in SQLite, so copying a JSON seed alone does not update their active configuration. Startup applies the template's plugin settings to that store; use the OpenClaw configuration CLI for other changes to an existing gateway.

## Brief local voice test

Testing is available before the premium paywall is implemented. Use localhost or HTTPS in a browser that supports microphone recording. Voice mode starts off and resets when the assistant closes or the account/workspace changes.

1. Run `npm run ai:setup`, then fill in `OPENROUTER_API_KEY` in `server/.env` without sharing it in chat.
2. The speech defaults are `OPENROUTER_TTS_MODEL="google/gemini-3.1-flash-tts-preview"` and `OPENROUTER_TTS_VOICE="Kore"`. These appear in OpenRouter's speech model catalog; account access and live synthesis still require verification. Keep the existing STT model for a mixed-model test. Restart the gateway after changing speech models or credentials.
3. With Docker running, run `npm run ai:start`, then `npm run ai:check`. Start/restart LOFT with `npm run dev`.
4. Sign in, open the assistant, enable **Voice mode**, click the microphone, and allow microphone access. Say a short read-only question such as "What should I work on first?", then click Stop. Clips stop automatically after 30 seconds.
5. The recording is transcribed and submitted automatically. The assistant shows **Generating audio…**, then plays its generated voice reply without displaying the answer text. Use **Play** to replay the cached audio or when the browser blocks autoplay; use **Retry audio** if generation failed. Confirm controls are still required for persisted changes.
6. Switch Voice mode off or close the assistant to stop capture/playback. Default text mode makes no speech calls. The test uses paid STT, reasoning, and TTS requests; no live provider calls are made by the automated tests.

## Deployment

For a Docker gateway on AWS Lightsail, use the [Lightsail setup guide](LIGHTSAIL.md). It includes a separate gateway secrets file, an HTTPS Compose overlay, host prerequisites, firewall settings and the two backend variables needed to connect the existing website. Start with `npm run ai:lightsail:setup` on the VPS.

The Docker setup is for an API running on the same host. A serverless API deployment cannot run this container itself. Host the gateway as a separate persistent service and set `OPENCLAW_GATEWAY_URL` and the same `OPENCLAW_GATEWAY_TOKEN` on the deployed LOFT backend. Set `OPENROUTER_API_KEY` on that gateway. Keep its endpoint private or protect it with TLS and network restrictions; its bearer token grants gateway operator access. Do not expose it to browsers.

The API bounds each message to six gateway rounds, eight calls per round, a 90-second gateway budget, three proposals, and a small conversation history. Paid requests are limited to ten per minute and one active request per user per process. Replicated deployments need a shared proxy/gateway limiter and an API request timeout compatible with this budget. `/api/assistant/status` reports whether a token is configured, not gateway health or OpenRouter credit availability.

## Verification

Run `node --test server/test/assistant.test.js` and `npm run build`. The tests use mock gateways/databases: they do not spend OpenRouter credits or modify live data. A real gateway/model check requires Docker, an OpenRouter key and a configured LOFT database. Confirm both task and meeting proposals in a test workspace and verify notification delivery, reload persistence and workspace isolation before deployment.
