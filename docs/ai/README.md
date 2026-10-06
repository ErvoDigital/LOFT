# LOFT AI — OpenClaw integration

The two documents in this folder are the reference for LOFT's V1 AI layer:

- [openclaw-blueprint.md](openclaw-blueprint.md) covers the architecture, the approved tools, token efficiency, the confirmation policy, the security boundary and the demo flow.
- [v1-integration-update.md](v1-integration-update.md) covers the V1 decisions, the Phase 5 checklist (5A–5E), the exit test, the deferred list and the stress-testing guidance.

They decide **what** V1 does: OpenClaw + GPT-5.6 + LOFT backend tools, a deterministic Smart Priority engine, and confirmation before writes that other people see. This page maps their terms onto LOFT's actual code, and lists what the code already has, what's missing and what the reference leaves open. Where the reference and [ROADMAP.md](../ROADMAP.md) Phase 3 disagree, the reference wins.

The update doc says its decisions belong in `LOFT_Development_Plan_Integrated_OpenClaw.md`. That file isn't in this repo, so this folder and the roadmap record them instead.

## Reference terms → LOFT code

| Reference says | In LOFT |
|---|---|
| Team, `team_id` | `Workspace`, `workspaceId`. Membership is `WorkspaceMember`. |
| Supabase Postgres + RLS | Neon Postgres through Prisma. **There is no RLS**: Prisma connects as one database role. Authorization lives in Express: `requireAuth` sets `req.userId`, `requireWorkspaceMember()` checks membership, and `services/folderAccess.js` and `services/documentAccess.js` handle per-item access. Read every "RLS" step in the reference as "these server-side checks". |
| `urgency: low\|normal\|high\|urgent` | `Task.tier`: `TIER_1` (critical) to `TIER_4` (backlog), which replaced the old LOW–URGENT priority. Tools should take `tier`, or map urgency onto it in one place. |
| Meeting (`create_meeting`, `update_meeting`) | A calendar `Event` with `EventAttendee` rows. LOFT's "Meetings" page is a live WebRTC call that isn't persisted, so the thing you schedule is an Event. |
| `attendee_group: team` | `createEvent` with no `attendeeIds` already invites every member. |
| `duration_minutes` | Events store `startTime`/`endTime`; derive `endTime`. |
| Smart Priority engine | Already exists: `services/priority.service.js` (`calculatePriorityScore`) and `services/plan.service.js` (`buildPlan`), served by `GET /api/plan`. |
| `search_workspace_content` | `GET /api/search` (`search.controller.js`): a membership-scoped search over tasks, messages, files and people. |
| `send_message` | `POST /api/messages/conversations/:id/messages` (`sendMessageRest`), which checks that the caller is a participant. |
| Phase 5 | The roadmap calls the AI layer Phase 3. |

## Where the code stands against the Phase 5 checklist

### 5A Smart Priority: mostly built

- **Deterministic scoring and the My Plan ranking already exist.** The score is the tier weight (1000/500/200/50) plus a deadline decay of `1000 / (hoursUntilDue + 1)` inside a 7-day window. Overdue tasks add 500, pinned tasks get +10000 and snoozed tasks score −5000.
- **"Recalculate after meaningful changes" needs no new work.** The score is computed on every read of `/api/plan`, so it is never stale.
- **Missing: human-readable reasons.** `calculatePriorityScore` returns a bare number. The assistant's explanation ("due tomorrow, Tier 1") must be grounded in the score's components, so the engine needs a variant that returns them.
- **Missing: configurable weights.** The weights are module constants.
- **Missing: tests.** `server/test/` covers safety guards and search only.
- **Factors the reference suggests that the data doesn't support yet:**
  - *Dependency/blocking*: there is no task-dependency model, and the reference's example explanation ("…blocks deployment") depends on one.
  - *Status*: an in-progress task scores the same as a to-do task.
  - *Effort*: `estimatedMinutes` drives scheduling but not the score.

### 5B–5D OpenClaw, assistant UI, tools: not started

The one exception is a front-end placeholder for 5C: `client/src/components/assistant/AssistantWidget.jsx`, mounted in `AppShell`, provides the floating button, the panel and the active-workspace indicator. It sends nothing to the server and gives every message a fixed "not connected yet" reply.

No tool exists yet, but every one of them maps onto an operation that does:

| Tool | Existing operation | Gap |
|---|---|---|
| `get_my_agenda` | `listMyTasks` (`GET /api/tasks`), `listMyEvents` (`GET /api/events?from&to`) | Tasks have no date filter, and `scope: single_team` has no filter. |
| `create_task` | `createTask` | urgency → tier |
| `update_task` | `updateTask` | Any member can edit any task in the workspace, so limit the fields the tool accepts. |
| `create_meeting` | `createEvent` | Any member can create an event. |
| `update_meeting` | `updateEvent` | Editing an event is restricted **in the router**, not the controller (see the trap below). |
| `search_workspace_content` | `globalSearch` | None. |
| `summarize_content` | None needed | It runs on the model side, over results other tools already returned. |
| `draft_message` | None needed | The draft lives in the assistant UI until the user sends it. |
| `send_message` | `sendMessageRest` | Needs confirmation. |

**The trap:** LOFT's role and membership checks are Express middleware in `routes/*.routes.js`, not code inside the controllers. Workspace membership is router-level `requireWorkspaceMember()`, and editing or cancelling an event adds a route-level role check on top. A tool executor that calls controller functions directly therefore skips those checks. Move the operations into service functions that take `(userId, workspaceId, input)` and do their own checks, so the REST routes and the tools share one code path. The tool layer then inherits any later change to authorization without being edited.

**Name resolution gap:** the tools take `team_id` and `assignee_id`, but users say "Team B" and "Sarah". The reference's context envelope carries only `active_team_id`. Add the caller's workspaces (id and name) to the envelope, which keeps it small and bounded, and resolve member names inside the tool on the server.

### 5E Meeting AI: no source text yet

Meetings are peer-to-peer WebRTC, so the server never receives audio and no transcript exists (see ROADMAP item 9). The text available today is:

- the meeting's chat (`Conversation.isMeetingChat`)
- workspace documents
- notes the user pastes in

Approved action items become tasks through the existing `createTask`.

## Hosting and identity: what the reference doesn't cover

According to OpenClaw's [OpenAI-compatible HTTP API docs](https://docs.openclaw.ai/gateway/openai-http-api):

- A Gateway token grants **full operator access**, and the endpoint must stay on loopback, a tailnet or private ingress, never the public internet.
- One Gateway is **one trust domain**: OpenClaw's [multiplayer sessions aren't tenant isolation](https://www.implicator.ai/openclaw-2-multiplayer-not-security-boundary/).
- `POST /v1/chat/completions` accepts **client-supplied function tools**. It returns them as `finish_reason: "tool_calls"`, and the caller executes them and sends back `role: "tool"` messages.
- Requests are stateless unless a `user` field is sent.

That makes the shape below the one that keeps every rule in the reference true:

1. **The browser never talks to OpenClaw.** The client calls a new `POST /api/assistant/...` route behind `requireAuth`.
2. **loft-server is OpenClaw's only client.** It sends the bounded history, the context envelope and LOFT's tool definitions as client `tools`, with `stream: true` and no `user` field.
3. **LOFT executes each tool call as `req.userId`.** Each call runs through the shared service functions: allowlist, then Zod validation, then membership/role checks, then the narrow operation. The loop is capped at a few rounds. OpenClaw only ever sees tool names and arguments, never a credential or a user token.
4. **Confirmation-required tools aren't executed in the loop.** LOFT stores a pending action owned by that user, shows the confirmation card, and re-validates and executes only when the user confirms.
5. **Conversation history lives in LOFT, not in OpenClaw sessions.** Per-user history then never sits in a shared trust domain, and the "bound the history" rule from the reference stays under LOFT's control.
6. **The LOFT agent in OpenClaw should have its built-in tools turned off** (shell, browser, files, session tools). Otherwise the tool allowlist isn't the whole surface. Check OpenClaw's agent tool-policy config for how to do this.

loft-server runs as a Vercel serverless function, while the OpenClaw Gateway is a long-running process. The Gateway therefore needs its own always-on host, reachable from loft-server but not from the internet. Vercel functions also cap how long a streamed response can run.

## Open decisions

1. **Where the Gateway runs**, and the private network path from Vercel to it.
2. **How GPT-5.6 is reached:** directly through OpenAI, or through OpenRouter (the update doc measures OpenRouter usage). The key lives in OpenClaw's config and never reaches LOFT's client.
3. **What "Reprioritize my tasks" writes.** The ranking is already live, so re-running it changes nothing. Recommended: the assistant proposes tier/pin/snooze changes as one bulk change, which the reference already says needs confirmation.
4. **Whether V1 adds task dependencies**, or drops "dependency/blocking" from the V1 factors.
5. **Meeting AI source text for V1:** meeting chat, pasted notes, or both.
