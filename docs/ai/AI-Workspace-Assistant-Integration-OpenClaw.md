# LOFT V1 AI Workspace Assistant — Consolidated Integration Plan

Updated: October 5, 2026. This canonical plan combines the engineering blueprint and `LOFT_V1_AI_Integration_Update.md` against the current repository. See [AI setup](README.md) for operational commands, [Lightsail deployment](LIGHTSAIL.md) for gateway hosting, and the [roadmap](../ROADMAP.md) for project sequencing.

## 1. Product intent

The assistant's name is **Lofty**. Use this name in the interface and when the assistant introduces or identifies itself, in both text and voice modes.

> LOFT AI is a workspace agent that lets users naturally ask, plan, create, communicate, summarize, and reprioritize across their permitted teams, while LOFT remains responsible for the actual data, permissions, workflow logic, and final actions.

The assistant belongs in the normal LOFT experience. Users should be able to say “What's on my schedule today?”, “Add a task to finish the presentation tomorrow”, “Move the development meeting to 3 PM”, or “What should I work on first?” without learning command syntax or constructing detailed prompts.

Preserve the original differentiator: independent teams share a user's limited time, so My Plan helps that user understand conflicts and the effects of changing priorities across permitted workspaces. The assistant explains and operates that workflow; LOFT computes the plan and enforces its rules.

V1 aims for a reliable, repeatable end-to-end demonstration. Natural conversation, task/meeting creation and supported updates, message drafts, summaries, cross-team agenda queries, deterministic Auto-Reprioritization, and accurate priority explanations are core. Voice interaction is a separate premium feature with its own release criteria; it does not block core text acceptance.

## 2. Comparison and resolved decisions

Both source documents agree on OpenClaw orchestration, narrow backend tools, efficient context, deterministic priorities, and approval of meeting action items. The current product decision supersedes the original single-model restriction: use a mixed-model setup through OpenRouter and offer voice interaction separately to premium users. The update adds workstreams, stress testing, and a presentation exit test. This plan retains those requirements and resolves differences with the implementation:

| Topic | Source proposal | Consolidated decision |
| --- | --- | --- |
| Model | GPT-5.6 as the sole V1 reasoning model | Superseded by a mixed-model setup with explicit, verified model IDs per role: tool-capable reasoning, speech recognition, and speech synthesis. The gateway uses `OPENCLAW_PRIMARY_MODEL`; additional reasoning routes require a tested backend policy. |
| Provider | No multiple providers; update mentions OpenRouter usage | Use the existing OpenRouter API key and credit balance for the selected models, including supported speech models. Model vendors may differ behind OpenRouter; no direct Gemini credential is required for this path. |
| Database | Supabase Postgres + RLS | Current schema uses Prisma + PostgreSQL (Neon). Keep this data path and backend authorization. Supabase migration/RLS are neither V1 prerequisites nor existing guarantees. |
| Priority | Implement Smart Priority; suggested new factors | Extend the existing engine and My Plan. Explain implemented factors first; dependency scoring requires a represented relationship before it can be promised. |
| Tools | `create_task`, `create_meeting`, other target names | Preserve current proposal/confirmation tools. Target names describe capabilities backed by existing controllers, not immediate-write permission. |
| Confirmation | Selected writes require confirmation; task demo implies immediate creation | Keep V1 confirmation for every persisted assistant mutation, including task creation and updates. Reads, drafts, and derived ranking calculations need no approval. |
| Context | Server envelope containing `client_current_timestamp` | Use server UTC time plus a validated user time zone. Browser preferences never establish identity or permission. |
| Retrieval/voice | Optional `pgvector` and speech | Defer advanced semantic retrieval. Voice is a separate premium mode with backend entitlement enforcement and usage limits; core text remains independently usable. |
| Phase numbering | Update calls this Phase 5 | Keep repository Phase 3 (AI), using workstreams A–E below. The referenced separate development-plan file is superseded by this plan and the roadmap. |

## 3. Current implementation baseline

“Implemented” means present in the repository, not proven through live inference or production deployment.

| Capability | Repository evidence | Remaining work |
| --- | --- | --- |
| Authenticated assistant API | `server/src/routes/assistant.routes.js` | Verify live gateway/model and deployment timeouts. |
| Private OpenClaw + OpenRouter | `server/src/services/openclaw.service.js`, `infra/openclaw/openclaw.json` | Verify explicit reasoning model IDs and routing policy. Responses are currently buffered JSON, not streamed. |
| Scoped reads and conflicts | `server/src/services/assistant.service.js` | Date-range agenda, workload/priority retrieval, and explicit completeness. Reads currently cap tasks/events at 100; events cover 14 days. |
| Confirmed task/meeting creation | Same service and existing task/event controllers | Add supported updates; verify persistence, notifications, realtime refresh, and retries end to end. |
| Embedded assistant UI | `client/src/components/assistant/AssistantWidget.jsx` | Streaming, tool progress, preview editing/retry states, and refresh after confirmed changes. |
| Deterministic priority and My Plan | `priority.service.js`, `plan.service.js`, `controllers/plan.controller.js` | Expose grounded reasons and scoped plan data to the assistant; verify recalculation and membership filtering. |
| Local/Lightsail gateway helpers | `infra/openclaw/`, `scripts/openclaw.mjs` | Real hosting and backend connectivity. Helpers do not provision AWS. |
| Updates, content search/summaries, message drafts, meeting action items | Not exposed by current assistant tools | Implement and verify before declaring V1 complete. |

Conversations currently clear on reload and workspace/account changes. Gateway transcripts can remain in the Docker state volume; browser clearing does not erase them. Persistent LOFT conversation history is deferred.

## 4. Architecture and responsibility boundaries

```text
User -> LOFT Assistant UI -> authenticated LOFT API
                                |
                         private OpenClaw gateway
                                |
                    OpenRouter -> selected reasoning model
                                |
                      structured tool requests
                                |
                 LOFT validates and executes allowed tools
                     |                         |
             existing controllers       Smart Priority / My Plan
                     |                         |
                     +------ Prisma -----------+
                                |
                        PostgreSQL (Neon)
                                |
                  scoped results -> assistant response
```

- **Model:** interpret intent, extract arguments, request approved tools, summarize authorized sources, and explain calculated priority factors. Never invent IDs, records, rankings, or successful actions.
- **OpenClaw:** orchestrate sessions and model/tool continuation. Only LOFT-supplied tools are available; built-in shell, filesystem, messaging, memory, and other agent tools stay disabled.
- **LOFT backend:** authenticate, authorize, validate inputs/results, retrieve data, compute priorities/conflicts, prepare confirmations, and execute final changes through existing workflows.
- **LOFT UI:** show context and progress, clarify ambiguity, preview actions, collect approval, and refresh affected views after backend success.

### Separate premium voice interaction

Default text chat and premium voice are distinct user modes. Entering voice mode is explicit; it enables microphone input and spoken assistant replies for that session. Text chat must not invoke transcription or speech synthesis. Users can stop voice mode and continue typing, and voice displays the transcript, answer text, and normal confirmation previews.

```text
Premium voice UI -> authenticated LOFT API -> entitlement + usage check
    -> OpenClaw speech plugin -> OpenRouter speech recognition -> transcript
    -> shared assistant / OpenClaw reasoning and LOFT tools
    -> final user-facing response -> OpenClaw speech plugin -> OpenRouter TTS -> audio playback
```

Speech recognition and synthesis run through authenticated routes in the OpenClaw `loft-speech` plugin, outside the agent's tool loop. The plugin uses the same gateway-side OpenRouter key as text reasoning. A premium subscription grants access to voice, not extra workspace permissions. Spoken approval cannot bypass the exact preview and Confirm control. Every model uses the same backend authorization, deterministic planning, validation, and persistence rules.

Current repository speech routes (`/api/assistant/transcribe`, `/api/assistant/speak`) and a session-scoped Voice mode toggle exist for pre-paywall testing, but premium entitlement enforcement and voice allowances are remaining work. Before premium release, check trusted server-side subscription state before accepting audio uploads or making any paid speech request, and enforce it on every speech endpoint and cached-audio retrieval. A browser toggle or hidden button is not enforcement. Define the entitlement source and subscription expiry behavior before implementation.

Use explicit OpenRouter STT/TTS model IDs. Gemini TTS is a candidate through OpenRouter's [speech API](https://openrouter.ai/docs/guides/overview/multimodal/tts); verify its exact supported slug, voice, format, price, and account access with live requests. Direct Google API prices do not establish OpenRouter charges. Keep `OPENROUTER_API_KEY` private and use the existing OpenRouter balance.

Control cost with push-to-talk or bounded utterances, an idle timeout, per-user voice allowances, shared rate/concurrency limits, and a global spend ceiling. Account for STT, reasoning, and TTS separately within the total budget; the current message limiter does not cover speech routes. Reserve usage atomically before provider calls so concurrent requests cannot exceed the allowance. Deduplicate retries, limit fallback attempts, and reuse generated audio for replay with user-scoped cache keys that include exact text, model, voice, and language. Clear browser audio on account/context changes and apply a short retention policy.

Speak concise, complete answers while preserving names, dates, deadlines, and proposal state; keep the full written answer available. Do not silently truncate important content to save tokens. Generate audio only during an explicitly active voice session or a premium playback request. Cancellation stops capture and playback; already generated provider output can still be billed. Measure turn latency and actual OpenRouter usage before enabling streaming or selecting a premium allowance.

Premium release checks: non-premium callers cannot reach paid speech APIs, expired subscriptions and exhausted allowances are denied server-side, default text makes no speech calls, replay causes no new synthesis charge, account changes cannot expose cached audio, and voice proposals preserve the normal confirmation roundtrip. Existing voice plumbing is not proof that these checks pass.

### Explicit intent and caller authority

The assistant is request-driven. Act only on what the interacting user explicitly asks, and ask a focused clarification before preparing an action when intent or material details are missing or ambiguous. Advice, a conflict report, a summary, an inferred next step, or a prior assistant suggestion does not authorize a new action. No autonomous follow-ups, background actions, or unsolicited task/meeting proposals are allowed. Relevant authorized reads may support the requested answer.

Resolve workspace, target, assignee, priority, requested deadline, meeting times/duration and attendees from explicit instructions or unambiguous active context. "Me" resolves to the authenticated caller; a clearly selected workspace resolves workspace context. Do not silently choose an assignee, priority, duration or recipients. Optional descriptions and unrequested deadlines may be omitted. If a requested date lacks a needed time, ask. A conversational "yes" cannot bypass the exact preview and Confirm control.

The assistant acts **as the interacting member**, using their verified session identity and current workspace membership, role, delegated abilities and resource access. Never use a master admin key, admin impersonation or a shared privileged LOFT account for tool execution. An admin role in one team never grants access in another. Gateway/provider credentials authenticate infrastructure only; they grant no LOFT data authority. Database access remains inside LOFT's backend with caller-scoped authorization on every operation.

The runtime supplies a server-generated context envelope with active workspace role and effective permissions. Workspace discovery returns current roles/abilities for each team. Each active-context tool call reloads membership; global reads use live membership predicates; proposals and confirmation revalidate the caller and affected people. Current task/event creation is available to any member, matching normal routes. Future tools must reproduce all route middleware permission and resource checks before calling controllers, and repeat them at confirmation. Model claims, browser fields, history or an old signed proposal cannot establish current authority.

Intent interpretation and clarification are model instructions, not a deterministic proof that every proposed field was requested. Required task assignee/priority, strict schemas, scoped queries, backend authorization and explicit confirmation enforce the runtime boundary. Verify clarification and resistance to unsolicited proposals with live adversarial tests before release.

The browser talks only to LOFT. The OpenRouter key stays on the OpenClaw host for reasoning, transcription and speech synthesis. The LOFT backend uses the gateway URL and token for all three operations. The gateway token stays server-side. Neither the model nor gateway receives database credentials or LOFT login tokens. Keep existing local Docker and separate Lightsail deployment options described in the operational guides.

## 5. V1 tool contract

These are target capabilities, not claims that all tools already exist. Preserve workspace/member discovery and conflict tools for resolving real record IDs. Avoid generic database and arbitrary SQL tools.

| Target capability | Contract and implementation direction |
| --- | --- |
| `get_my_agenda` | Validated date/range and `single_workspace` or `all_workspaces` scope. Return caller tasks, relevant meetings, and requested workload/conflict/priority information. Extend current list tools with filters; disclose truncation and paginate where needed. |
| `create_task` | Reuse `propose_task` plus confirmation. Require resolved `workspaceId`, `title`, `assigneeId`, and `tier` (`TIER_1`–`TIER_4`); optional `description` and offset-aware `dueDate`. Clarify missing assignee/priority instead of silently defaulting them. |
| `update_task` | Prepare a record-specific patch for approval: title, description, deadline, tier, valid workspace status, assignee, estimated effort, pin/snooze. Implement an explicit allowlist and existing controller permissions. |
| `create_meeting` | Reuse `propose_event` plus confirmation: `workspaceId`, title, offset-aware `startTime`/`endTime`, explicit `attendeeIds`. Resolve duration and “the team” into validated times/member IDs. |
| `update_meeting` | Prepare supported title/time/duration/attendee changes against a specific calendar event. Recheck permissions and the current record before applying. |
| `search_workspace_content` | Retrieve bounded permitted messages, documents, tasks, or supplied notes. Apply resource restrictions as well as workspace membership. Start with scoped database queries. |
| `summarize_content` | Summarize authorized retrieved sources, with source references and structured meeting output where relevant. Use a verified model from the configured OpenRouter allowlist with the same source and access contract; no specialist agent. |
| `draft_message` | Produce an editable draft for a permitted workspace/channel. No delivery side effect. |
| `send_message` (optional) | Separate explicit confirmation, channel/recipient authorization, and idempotent delivery. Drafting remains complete without sending. |

Expose plan retrieval through `get_my_agenda` or a narrow `get_my_plan` adapter using the same deterministic services as My Plan. “Reprioritize” recomputes the derived plan; it does not authorize changing stored tiers, deadlines, or assignments.

Map natural urgency wording to existing tiers using a documented mapping or clarification; do not introduce a parallel `low|normal|high|urgent` field. Distinguish calendar events from WebRTC calls: scheduling a meeting does not record or transcribe a call.

## 6. Context, scope, and efficiency

Implemented server-generated envelope (global context uses a null role and empty grants; discover roles separately for each team):

```json
{
  "authenticated_user_id": "from-verified-session",
  "active_workspace_id": "validated-workspace-or-null",
  "scope": "single_workspace",
  "current_timestamp_utc": "server-generated-ISO-8601",
  "user_time_zone": "Asia/Manila",
  "workspace_role": "MEMBER",
  "workspace_permissions": ["events.manage"]
}
```

The current instructions include this envelope with identity, workspace, role/abilities, server UTC time, and validated browser time zone. Never trust user-supplied identity or dates. Resolve “today”, “tomorrow”, and “next Friday” using local calendar boundaries converted to UTC; clarify ambiguous times. Existing conflict detection and plan day grouping use host-local dates, so time-zone consistency remains work.

Workspace context restricts reads and mutations to that workspace. Global context aggregates caller memberships. A request about another team while scoped to one should prompt a context switch, not silently widen access. An active workspace never proves authorization. Check membership at every tool execution and confirmation.

Let the backend do the expensive data work: filter by date/workspace/resource, compute deterministic values locally, and return concise results with source IDs and completeness metadata. Do not preload the entire workspace or all history for simple requests. Bound history, retrieval, tool rounds, outputs, and paid requests. Add compact history summaries only when needed; summaries never establish permissions or authoritative facts.

Preserve current bounds: six gateway rounds, eight calls per round, three proposals, a 90-second gateway budget, up to twelve history messages, ten paid requests per minute and one active request per user per API process. Replicas need shared rate limiting. Streaming must retain these bounds and support cancellation.

## 7. Smart Priority and Auto-Reprioritization

Reuse `calculatePriorityScore()` and `buildPlan()` instead of asking the model to determine task order.

Current scoring uses tier weights (1000/500/200/50), deadline proximity within seven days, a 500-point overdue surge, and pin/snooze overrides. My Plan allocates estimated effort into daily capacity and exposes at-risk work; completed statuses are filtered before planning. Effort affects allocation, not the current score. Dependency/blocking impact is not currently a supported factor.

```text
Authorized active tasks + server time + capacity
    -> deterministic scores -> My Plan allocation
    -> ranked results + factual factor breakdown
    -> model explanation -> UI refresh
```

Return score components and reason codes from the backend. Preserve manual pin/snooze intent, make weights configurable/testable, and define deterministic tie handling. Document and test new factors before including them in explanations. Do not claim “blocks deployment” unless LOFT actually represents and scores that relationship.

Auto-Reprioritization means the derived order/plan updates after meaningful approved task changes or time changes. It does not silently rewrite deadlines, tiers, or assignments; those require separate approved proposals. Recompute through the same services for normal UI and assistant changes, refresh My Plan, and show accurate before/after reasons.

Audit existing plan queries before exposing them as tools: assignment/event attendance alone must not replace current workspace membership. Apply the assistant's membership and resource-access boundary to plan retrieval too.

## 8. Confirmation and security

Permitted agenda/search queries, summaries, drafts, priority explanations, and derived-plan recalculation need no confirmation. **Every persisted V1 assistant mutation requires an explicit preview and confirmation**: task creation/updates, meeting creation/updates, action-item conversion, and optional message delivery. Deletion and bulk mutation are outside the core V1 tool set.

Reuse existing signed, user-bound, ten-minute proposals and backend-generated action IDs. Keep confirmation tokens out of model context. Creation already uses action IDs as record primary keys to prevent duplicates; updates/sending need their own idempotency and stale-record handling. Revalidate inputs, membership/roles, and recipients at confirmation, then execute through existing controllers/services. Editing a preview requires a newly validated proposal.

Distinguish draft, awaiting approval, saving, saved, dismissed, expired, failed, and retryable UI states. Never claim success before backend persistence. Verify notifications/realtime separately; a record committed before notification failure must not be duplicated by retries.

Treat retrieved content, names, documents, and history as untrusted data, not instructions. Reuse channel, document, and folder/file restrictions, not only workspace membership. Neither raw results nor summaries may expose private information from unauthorized teams/resources. Backend authorization is the current enforcement boundary; do not describe Supabase RLS as implemented.

## 9. Meeting summaries and action items

Reuse the same OpenClaw/model foundation:

```text
Permitted notes or approved transcript
    -> summary + decisions + draft action items
    -> Zod validation + source references
    -> review / edit / reject / approve
    -> confirmed LOFT task creation
```

Start V1 with user-supplied notes or an approved text transcript. Live WebRTC calls currently provide no transcript to the assistant; capture/transcription is optional and does not block the demo. If storing notes/results, define a workspace-scoped record and access rules, optionally linked to an existing calendar event. Do not claim live-call history exists.

Validate a narrow schema: summary, decisions, action-item drafts with title, optional proposed assignee/deadline, and source references. Missing facts stay missing or require clarification. Approving a summary does not approve every extracted task. Users accept/edit/reject individual items; approved items use normal task validation/confirmation without redundant approval screens for the same final payload.

## 10. Implementation workstreams and order

Checked items indicate repository implementation only. Live verification is separate.

### A — Extend Smart Priority and My Plan

- [x] Deterministic scoring, effort/capacity planning, and cross-workspace My Plan exist.
- [ ] Audit membership filtering and unify user-time-zone boundaries.
- [ ] Add backend reason breakdowns, configurable weights, and stable tie handling.
- [ ] Expose scoped plan/priority data through assistant tools.
- [ ] Refresh/recompute after meaningful changes; show before/after reasons.
- [ ] Test score factors, overrides, time boundaries, allocation, completed statuses, and multi-workspace isolation.

### B — Complete OpenClaw and the mixed-model foundation

- [x] Authenticated API, gateway adapter, allowlisted tools, server-only credentials, bounded tool loop, and Docker/Lightsail helpers exist.
- [ ] Verify explicit OpenRouter model IDs, availability, capabilities, and cost for each role. Benchmark all reasoning routes against the same tool schemas and confirmation tests; use an allowlist with bounded fallbacks, not unconstrained automatic routing. The current gateway selects one reasoning model through `OPENCLAW_PRIMARY_MODEL`; additional reasoning routing remains work.
- [ ] Formalize server context and filtered agenda queries.
- [ ] Add streaming, cancellation, connection/retry handling, and safe tool progress events.
- [ ] Verify real inference, confirmed persistence, notifications, and deployment timeouts.

### C — Complete assistant interaction states

- [x] Floating launcher, assistant panel, typed conversation, workspace context, loading/error states, and confirm/dismiss controls exist.
- [ ] Add streaming and per-tool progress.
- [ ] Add preview editing, expiry/retry clarity, and confirmed-update states.
- [ ] Refresh Calendar, task views, and My Plan after confirmed mutations.
- [ ] Verify context switches, cancellation, ambiguity, and recovery.

### D — Finish V1 tools

- [x] Workspace/member discovery, scoped task/event reads, conflicts, and task/meeting proposals exist.
- [ ] Add date/range and scope-aware `get_my_agenda`, with plan reasons/workload.
- [ ] Complete confirmed task/meeting creation demo verification.
- [ ] Add confirmed `update_task` and `update_meeting` with supported-field allowlists.
- [ ] Add permission-aware content search and summarization.
- [ ] Add message drafting; keep sending optional.

### E — Meeting AI and demonstration

- [ ] Accept authorized notes/approved transcripts without requiring live recording.
- [ ] Generate validated summaries, decisions, and action-item drafts.
- [ ] Add review/edit/reject/approve and conversion of approved items only.
- [ ] Run correctness, isolation, failure/retry, efficiency, and presentation rehearsals.

Build order: verify the existing gateway/model first; finish Smart Priority explanations and agenda access; complete UI progress/confirmation and update tools; add scoped retrieval, summaries, and drafts; then action-item review and final rehearsals. Workstreams share the backend contract across configured models. Platform-wide search and advanced availability scheduling do not block V1.

## 11. V1 acceptance and presentation exit tests

- [ ] Ask for today's agenda naturally; show only permitted date-scoped records in the user's time zone.
- [ ] Create a task for tomorrow, confirm it, reload, and verify persistence.
- [ ] Update a supported task field after review; verify status/assignee permissions.
- [ ] Ask what to do first; match actual backend scores and My Plan order.
- [ ] Change a meaningful factor, confirm it, and show recalculated order with accurate before/after reasons.
- [ ] Prepare a meeting, clarify missing details, confirm, and show Calendar/notifications.
- [ ] Move/update that meeting after confirmation; verify times and attendee permissions.
- [ ] Search/summarize permitted content with source references; do not fabricate a live transcript.
- [ ] Produce an editable message draft without sending.
- [ ] Show meeting summary/action-item drafts; approve one and reject another, creating only the approved task.
- [ ] Query across permitted teams in global context; deny unauthorized workspaces/restricted content, including after membership changes.
- [ ] Exercise ambiguous names/dates, injected instructions in retrieved text, unavailable gateway, failed tools, expired/stale proposals, duplicate confirmations, and cancellation.
- [ ] Ask for advice or a summary; verify no unsolicited proposals or writes. Clarify vague requests and missing assignee, priority, times and recipients before proposals.
- [ ] Compare a member, delegated member and admin across teams; verify no cross-team privilege inheritance, forged roles or master-account fallback. Revoke membership during inference and before confirmation; deny further access.
- [ ] Repeat the full demo without manual database repair or duplicate writes.

Run existing contracts with `npm run ai:test`, and `npm run build` for UI changes. Add focused tests for new score/reason logic, access checks, date filtering, updates/idempotency, and structured summary validation. Mock tests do not prove live model behavior; rehearse against a real gateway/model in a test workspace.

During several days of stress testing, measure OpenRouter spend, input/output tokens, tool rounds, retrieved records, and response time. Verify simple prompts retrieve only relevant data within limits. Set a demo budget and keep a presentation-day buffer. Tune against measured usage rather than assuming pricing or model availability.

## 12. Deferred scope and readiness decisions

Defer direct provider integrations outside OpenRouter, specialist agents, self-learning, autonomous background actions, custom training, advanced semantic retrieval/`pgvector`, enterprise automation, persistent conversation history, deletion/bulk edits, and automatic free/busy scheduling. Mixed-model selection through OpenRouter is the intended architecture. Premium assistant voice ships separately after its entitlement, usage, and speech quality checks pass. Live meeting transcription and controlled message sending remain optional after core acceptance passes.

Remaining readiness decisions are verified per-role model identifiers/access and routing policy, actual gateway hosting/credentials, measured budget, premium entitlement source and voice allowance, exact update allowlists, and any meeting-note storage model. These do not require redesigning the assistant or migrating databases.

V1 is complete when the core behaviors work through the normal LOFT UI, preserve permissions, and can be demonstrated repeatedly. Preserve simple natural requests, cross-team awareness, backend-owned actions/priorities, and visible human control.
