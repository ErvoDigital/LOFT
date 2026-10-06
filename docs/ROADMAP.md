# LOFT — Roadmap

Status snapshot and a detailed plan for what's left. See the [README](../README.md) for setup and a summary of what's already built and verified.

## Current state (for context)

**MVP — complete.** Accounts/auth/roles, multi-workspace membership, shared calendar, kanban tasks with drag-and-drop, workspace-isolated chat (default channel + admin-created channels), the cross-workspace dashboard, and live in-app notifications.

**Phase 2 — nearly done.** File storage with Frame.io-style version merging is built, now with folders and folder-level view/download restriction. WebRTC video meetings are built, including screen sharing, a live annotation tool, and a persistent mini-player that keeps a call running (as a small floating widget) while browsing other pages. Shared documents (real-time collaborative rich text, Yjs + Tiptap) are built. Global search, billing, and a platform-wide admin panel are not.

**Phase 3 (AI) — first integration implemented; live verification pending.** The assistant now connects through a private OpenClaw gateway using OpenRouter, with scoped task/event reads and confirmed task/meeting creation. Smart Priority and My Plan also exist. The V1 target is one reasoning model, deterministic Auto-Reprioritization, supported updates, drafts, and summaries. See the [consolidated AI plan](ai/AI-Workspace-Assistant-Integration-OpenClaw.md) for implemented versus remaining work and [AI setup](ai/README.md) for operations.

---

## Phase 2 — remaining work

### 1. Storage: folders + granular permissions — ✅ done
Folders (with nesting via `parentId`) now organize files per workspace, and a folder's `visibility` (`WORKSPACE` / `RESTRICTED` + a `FolderMember` allow-list) gates who can see or act on everything inside it, enforced server-side in both the folders and assets controllers — never client-side-only. `WorkspaceStorage.jsx` got breadcrumb navigation, folder tiles, a "New folder" modal (name + visibility + member picker), and a "Move to folder" action on `AssetCard`. Restriction is folder-level only, by design — no independent per-file visibility, to keep the model to one new concept. Along the way, `deleteAsset` also picked up a server-side authorization check (`ADMIN` or uploader) it was previously missing entirely — the UI already hid the button, but the API itself didn't enforce it.

### 2. Online document collaboration — ✅ done
Real-time collaborative rich-text documents per workspace, Notion/Google-Docs-style. A new `Document` model (`workspaceId`, `title`, `content Bytes?` — a periodic Yjs state snapshot, not per-keystroke) backs it, with `server/src/sockets/documents.socket.js` acting as the sync layer: rather than a separate `y-websocket` server, it's a custom Yjs provider riding the app's existing single Socket.io instance (`client/src/lib/yjsSocketProvider.js` on the client side), keeping an in-memory `Map<documentId, Y.Doc>` as the authoritative merge point so late joiners sync via one full-state message instead of replayed history. Persistence is debounced (10s after the last edit, 30s max-wait ceiling) plus an immediate flush when a document's room empties. Presence/cursor awareness is a pure byte relay (server never decodes it), with a join-time `awareness-request` nudge so newly-joined clients see already-present peers' cursors immediately instead of waiting for their next move.

Editing is **Tiptap** (StarterKit + task lists, text align, color/highlight, sub/superscript, links) with Yjs's `Collaboration`/`CollaborationCaret` extensions — `StarterKit.configure({ undoRedo: false })` is required since Yjs's own `UndoManager`-backed undo/redo (already built into `@tiptap/extension-collaboration`, no extra wiring needed) replaces it. `WorkspaceDocuments.jsx` is the list page; `DocumentEditor.jsx` is the editor, with a full toolbar, a full-screen toggle (a `fixed inset-0` overlay, not the native Fullscreen API), a Google-Docs-style "paper" page card (fixed letter-width, centered, shadowed — stripped back to plain content via `@media print` for export), and export to PDF (via `window.print()`), Markdown (a hand-rolled ProseMirror-JSON→Markdown serializer scoped to exactly this editor's node/mark set), and standalone HTML.

Access is `requireWorkspaceMember()` plus an optional per-document restriction: `Document.visibility` (`WORKSPACE` / `ASSIGNED`) with a `DocumentAssignee` allow-list, the same shape as `Folder.visibility`/`FolderMember`. `WORKSPACE` (the default) is the original everyone-can-open behavior; `ASSIGNED` restricts opening (both REST fetch and the `document:join` socket handshake) to the creator, workspace ADMINs, and whoever's listed as an assignee (any number of people) — enforced server-side via `services/documentAccess.js`'s `isDocumentVisible`/`canManageDocument`, the same two-predicate shape as `folderAccess.js`. Changing a document's access (`PATCH .../documents/:id/access`) is creator-or-ADMIN only; delete is creator-or-ADMIN only; rename is still open to any member.

Along the way, a real pre-existing bug surfaced and got fixed: `chat.socket.js`'s connection handler was `async` and awaited a workspace-membership query *before* registering any of its (or the meeting/documents modules') event listeners — a client emitting an event immediately after "connect" (exactly what a reconnect-triggered resync does) could arrive before its listener existed and be silently dropped. Listener registration is now synchronous and up front, with the membership lookup as a non-blocking side effect after.

### 3. Global search
**Goal:** one search box that finds messages, files, tasks, and people across every workspace the user belongs to.

**Approach:**
- Start simple: a single `GET /api/search?q=` endpoint that runs scoped queries in parallel against Task, Message, Asset, User (workspace-filtered by membership) using SQL `LIKE`/`contains`. This is enough for MVP search quality.
- The current database is PostgreSQL (Neon); when needed, upgrade to `tsvector`/`to_tsquery` full-text search on the same tables — cheap upgrade, no schema redesign needed.
- UI: a search box in the Topbar (⌘K-style command palette is a nice touch — a `Modal` triggered by a keyboard shortcut, grouped results by type, click-through to the right workspace page).

**Effort:** low-medium for the SQL-`LIKE` version; the command-palette UI is the larger half of the work.

### 4. Screen sharing — ✅ done
`WorkspaceMeeting.jsx` supports screen sharing via `getDisplayMedia()`, added as a second track (not a camera replacement) so presenter and camera can both be seen — a repositionable PiP dock (top/bottom/left/right) shows everyone's camera strip alongside whoever's presenting. Renegotiation (a follow-up SDP offer) handles both starting a share mid-call and a peer joining while one is already in progress. Auto-stops on the browser's native "stop sharing" control (`track.onended`).

As part of the same pass, the call itself was also made to survive navigation: the WebRTC/media state lives in an app-level `MeetingContext` (`client/src/context/MeetingContext.jsx`, mounted in `main.jsx` next to `SocketProvider`/`NotificationsProvider`) instead of inside the page component, so leaving the Meeting page for Storage/Calendar/etc. no longer disconnects the call. A `MiniCallPlayer` (rendered in `AppShell.jsx`) shows a small floating tile bottom-left with mic/cam/leave controls whenever a call is active and the user isn't on the meeting page itself; clicking it returns to the full view. Only one active call at a time is supported — navigating to a different workspace's meeting page while already in a call prompts to leave-and-join-here rather than opening a second call.

### 5. Subscription/billing
**Goal:** freemium tier + ₱100–300/month paid tier for orgs/leaders.

**Approach:**
- Needs a payment provider decision first (see [Open decisions](#open-decisions-and-verification-needs)) — Stripe is the default recommendation (best Node SDK, well-documented webhooks) but doesn't natively settle in PHP; **PayMongo** or **Xendit** are the common choices for PHP-denominated billing if that matters for the target users.
- Add `Subscription` model (`workspaceId`, `plan`, `status`, `providerCustomerId`, `providerSubscriptionId`, `currentPeriodEnd`).
- Gate paid features (workspace member cap, custom channels, storage quota, etc. — needs a product decision on what's actually gated) behind a `requirePlan()` middleware checking the workspace's active subscription.
- Webhook endpoint to sync subscription status from the provider (`POST /api/billing/webhook`) — must verify the provider's signature.
- UI: a billing tab in `WorkspaceSettings.jsx` (admin-only), a plan picker, provider-hosted checkout (never build a raw card form — use the provider's hosted checkout/Elements to stay out of PCI scope).

**Effort:** medium, but blocked entirely until the provider + pricing/gating rules are decided.

### 6. Platform-wide admin panel
**Goal:** a super-admin view across the whole system — every user, every workspace, activity monitoring — distinct from the per-workspace admin controls that already exist in `WorkspaceSettings.jsx`.

**Approach:**
- Needs a platform-level role, since `WorkspaceMember.role` only scopes to one workspace. Add `User.isPlatformAdmin Boolean @default(false)` (set manually via a script/seed for the first admin — no self-service path to this role).
- New route group `/api/admin/*` gated by a `requirePlatformAdmin` middleware: list all users, list all workspaces with member/activity counts, suspend a user, view system-wide activity feed.
- UI: a separate `/admin` route tree, only linked from the nav when `user.isPlatformAdmin` is true.

**Effort:** medium. Mostly plumbing since the underlying data already exists — this is a reporting/moderation layer over it.

---

## Phase 3 — V1 AI workspace agent + Auto-Reprioritization

The [consolidated AI integration plan](ai/AI-Workspace-Assistant-Integration-OpenClaw.md) is the source of truth for AI architecture, tool contracts, workstreams A–E, and acceptance tests. It combines both new AI documents with the current code. [AI setup](ai/README.md) describes the implemented integration; [Lightsail deployment](ai/LIGHTSAIL.md) describes gateway hosting.

Keep the product intent: ordinary language lets users understand and operate work across their permitted teams, while LOFT owns data, permissions, workflow logic, final actions, and deterministic priorities. The assistant is embedded in LOFT and uses its existing backend.

### 7. Assistant foundation and V1 tools

**Implemented:** authenticated assistant API, private OpenClaw/OpenRouter integration, bounded tool loop, workspace/member discovery, scoped task/event reads, conflict detection, signed task/meeting proposals, confirmation/dismiss UI, and Docker/Lightsail helpers. Live inference and deployment verification remain pending.

**Remaining:** verify and select the requested single GPT-5.6 model target (current config is `openrouter/auto`), add streaming/cancellation/tool progress, formalize server context, and finish date-range agenda access, supported task/meeting updates, permission-aware content retrieval/summarization, and message drafting. Sending remains optional. Use server UTC time plus validated user time zone, rather than trusting a client timestamp for relative dates.

All persisted V1 assistant mutations require preview and confirmation, including task creation and updates. Reads, drafts, and derived-plan recalculation require no approval. Reuse existing controllers, role checks, notification/realtime workflows, and idempotent confirmation. Backend authorization on Prisma/PostgreSQL (Neon) is the current boundary; Supabase/RLS is not an implemented dependency.

### 8. Meeting creation and supported changes

**V1 goal:** translate ordinary scheduling requests into specific calendar-event proposals, clarify missing workspace/time/duration/attendees, and create or update only after approval. Creation proposals already exist; supported updates and end-to-end verification remain work.

**Later:** automatic availability scheduling across teams. Compute free/busy candidates deterministically and let the model interpret/present them; do not make a constraint-solving project a V1 dependency or expose private event details from other teams.

### 9. Meeting and workspace summarization

**V1 goal:** summarize authorized retrieved content, user-supplied notes, or approved text transcripts using the same OpenClaw/model foundation. Return source references and validated summary/decision/action-item output.

Live WebRTC calls do not currently supply transcripts. Recording/transcription and voice are optional later work. If notes/results are persisted, define workspace/resource access rules and optionally link to an existing calendar event; calendar events already exist, while live-call history is a separate concern.

### 10. Action-item review

Extract draft tasks from permitted content or meeting notes. Users review, edit, approve, or reject individual items. Only approved items become tasks through the normal validated confirmation workflow. Approving a summary does not approve all extracted tasks.

### 11. Deterministic Auto-Reprioritization and explanations

Smart Priority and My Plan already exist in `priority.service.js` and `plan.service.js`. Reuse their tier/deadline/overdue/pin/snooze scoring and effort/capacity allocation. `conflict.service.js` supplies deterministic conflicts; the model explains backend results rather than inventing rankings or modifying stored priorities.

Add score reasons, configurable/tested weights, stable tie handling, scoped plan tools, user-time-zone consistency, and refresh after meaningful approved changes. Audit current membership filtering before exposing plan queries through assistant tools. Dependency impact is future work until modeled; estimated effort currently affects allocation, not the priority score.

Auto-Reprioritization updates the derived ranking/plan. Changing a stored deadline, tier, or assignment is a separate proposal requiring approval. Demonstrate a meaningful factor change and accurate before/after reasons across permitted workspaces.

---

## Suggested sequencing

1. Verify existing OpenClaw connectivity, the exact single-model target, live tool calling, confirmations, persistence, and notifications in a test workspace.
2. Extend Smart Priority/My Plan with grounded explanations, scoped agenda/plan access, and time-zone consistency. Audit authorization at the shared backend boundary.
3. Complete streaming, tool progress, preview/retry states, confirmed task/meeting updates, and affected-view refresh.
4. Add bounded permission-aware content retrieval, summaries, and message drafts. Platform-wide search can reuse retrieval work but does not block the assistant demo.
5. Add meeting action-item review and approved task conversion using supplied notes/transcripts.
6. Run isolation/failure/idempotency checks, several days of measured cost/latency stress testing, and repeated full-demo rehearsals with a presentation budget buffer.
7. Finish platform-wide search and revisit free/busy scheduling, live transcription, voice, and optional sending after core V1 acceptance.
8. Build billing and platform administration when business requirements justify them; choose payment/gating rules before implementation.

The detailed checklists and presentation exit tests live in the [consolidated AI plan](ai/AI-Workspace-Assistant-Integration-OpenClaw.md). Multiple providers/models/agents, routing, self-learning, autonomous background actions, custom training, and advanced semantic retrieval are deferred.

## Open decisions and verification needs

- **Single model and live access:** GPT-5.6 remains the requested V1 target. Verify the exact OpenRouter identifier, availability, tool support, credentials/credits, and measured budget before replacing `openrouter/auto`. Do not silently route if the target is unavailable.
- **Gateway deployment:** Lightsail configuration/helpers are available, but a running host, DNS/TLS/network configuration, backend connectivity, and timeout compatibility still require verification. See [deployment guide](ai/LIGHTSAIL.md).
- **Supported update fields and meeting-note storage:** finalize explicit allowlists and any notes/result persistence/access schema. Supplied notes avoid a live-transcription dependency.
- **Payment provider and paid-tier rules:** resolve billing item 5 before implementing subscriptions and feature gates.
- **Production readiness:** the current schema already uses PostgreSQL (Neon). Verify deployment-specific storage, backups, and TURN/network requirements separately from the AI plan; do not treat an SQLite-to-PostgreSQL migration as remaining AI work.
