# LOFT — Roadmap

Status snapshot and a detailed plan for what's left. See the [README](../README.md) for setup and a summary of what's already built and verified.

## Current state (for context)

**MVP — complete.** Accounts/auth/roles, multi-workspace membership, shared calendar, kanban tasks with drag-and-drop, workspace-isolated chat (default channel + admin-created channels), the cross-workspace dashboard, and live in-app notifications.

**Phase 2 — nearly done.** File storage with Frame.io-style version merging is built, now with folders and folder-level view/download restriction. WebRTC video meetings are built, including screen sharing, a live annotation tool, and a persistent mini-player that keeps a call running (as a small floating widget) while browsing other pages. Shared documents (real-time collaborative rich text, Yjs + Tiptap) are built. Global search, billing, and a platform-wide admin panel are not.

**Phase 3 (AI) — not started.** Blocked on an LLM provider decision (see [Open decisions](#open-decisions) below).

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
- If/when moving to Postgres for production, swap to `tsvector`/`to_tsquery` full-text search on the same tables — cheap upgrade, no schema redesign needed.
- UI: a search box in the Topbar (⌘K-style command palette is a nice touch — a `Modal` triggered by a keyboard shortcut, grouped results by type, click-through to the right workspace page).

**Effort:** low-medium for the SQL-`LIKE` version; the command-palette UI is the larger half of the work.

### 4. Screen sharing — ✅ done
`WorkspaceMeeting.jsx` supports screen sharing via `getDisplayMedia()`, added as a second track (not a camera replacement) so presenter and camera can both be seen — a repositionable PiP dock (top/bottom/left/right) shows everyone's camera strip alongside whoever's presenting. Renegotiation (a follow-up SDP offer) handles both starting a share mid-call and a peer joining while one is already in progress. Auto-stops on the browser's native "stop sharing" control (`track.onended`).

As part of the same pass, the call itself was also made to survive navigation: the WebRTC/media state lives in an app-level `MeetingContext` (`client/src/context/MeetingContext.jsx`, mounted in `main.jsx` next to `SocketProvider`/`NotificationsProvider`) instead of inside the page component, so leaving the Meeting page for Storage/Calendar/etc. no longer disconnects the call. A `MiniCallPlayer` (rendered in `AppShell.jsx`) shows a small floating tile bottom-left with mic/cam/leave controls whenever a call is active and the user isn't on the meeting page itself; clicking it returns to the full view. Only one active call at a time is supported — navigating to a different workspace's meeting page while already in a call prompts to leave-and-join-here rather than opening a second call.

### 5. Subscription/billing
**Goal:** freemium tier + ₱100–300/month paid tier for orgs/leaders.

**Approach:**
- Needs a payment provider decision first (see [Open decisions](#open-decisions)) — Stripe is the default recommendation (best Node SDK, well-documented webhooks) but doesn't natively settle in PHP; **PayMongo** or **Xendit** are the common choices for PHP-denominated billing if that matters for the target users.
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

## Phase 3 — AI layer

Every item here needs an LLM provider + API key before any code is written (see [Open decisions](#open-decisions)). Assuming that's resolved, suggested build order and approach:

### 7. AI Assistant (build this first — the other four build on it)
**Goal:** natural-language assistant in the dashboard that can answer questions and take action across the user's workspaces.

**Approach:**
- A chat-style panel (reuse a lot of `ChatThread.jsx`'s visual language) that sends the user's message plus relevant context to the LLM.
- Use **tool calling**, not a bare chat completion: define tools like `list_my_tasks`, `create_task`, `list_upcoming_events`, `find_conflicts` that map directly onto the existing REST controllers. The model decides when to call them; your server executes them against the *real* DB scoped to `req.userId`, same auth as everything else — the AI layer is a new client of the existing API surface, not a parallel data path.
- New `POST /api/assistant/message` endpoint, streaming the response back (SSE or a chunked Socket.io event) so it feels responsive.
- No new DB tables strictly required — optionally a `AssistantMessage` table if you want conversation history persisted across sessions.

### 8. AI meeting scheduling
**Goal:** suggest/auto-schedule meeting times based on participant availability across all their workspaces.

**Approach:**
- This is mostly **not** an LLM problem — it's a scheduling/constraint problem. Compute free/busy windows per participant from `Event` rows across every workspace they're in (the data's already unified thanks to the dashboard's merged-calendar query), find overlapping free windows, rank candidates (soonest, avoids edges of the day, etc.).
- The LLM's role is thin: turn a natural-language request ("find 30 min with Sarah and the design team next week") into a structured query (participants, duration, date range) via tool calling into the AI Assistant, then present the computed candidate slots back conversationally.
- Reuses the AI Assistant's tool-calling infrastructure — build item 7 first.

### 9. Meeting summarization
**Goal:** auto-generate summaries from meeting transcripts/notes.

**Approach:**
- Needs a transcript source first. The built WebRTC meetings don't currently capture audio server-side (correctly so — it's peer-to-peer, the server never sees the media). Two paths:
  - (a) Client-side: use the browser's `SpeechRecognition`/`MediaRecorder` API to capture a rough transcript locally, upload the text (not audio) to the server for summarization — cheapest, no new infra, imperfect accuracy.
  - (b) Server-side: route meeting audio through an SFU or recording service and transcribe with a provider (e.g. Whisper), then summarize — much bigger lift, changes the meeting architecture from pure mesh to something with a server media component.
- Recommend (a) for a first version given the existing architecture. Store the transcript + generated summary on a new `MeetingNote` model linked to the workspace (meetings themselves aren't persisted today — this would be the first record of a meeting having happened).

### 10. Action item extraction
**Goal:** detect tasks mentioned in chats/meetings and suggest them as trackable tasks.

**Approach:**
- Feed recent messages in a channel (or a meeting summary from item 9) to the LLM with a tool-calling schema that returns candidate action items (`title`, `suggestedAssignee`, `suggestedDueDate`).
- Don't auto-create tasks — surface suggestions in the UI (a small "3 action items found" prompt in `ChatThread.jsx` or the dashboard) that the user accepts/edits/dismisses individually, calling the existing `POST /workspaces/:id/tasks` endpoint on accept. Keeps the AI from silently cluttering someone's task list.

### 11. AI task reprioritization
**Goal:** recommend or auto-adjust task priority when deadlines conflict across workspaces — this is the direct AI-powered answer to the "chain reaction" problem in the original pitch, and builds directly on `conflict.service.js`.

**Approach:**
- The conflict detection already exists and is deterministic (`server/src/services/conflict.service.js`). This item is about turning a detected `DEADLINE_CLASH` into a *recommendation*, not building conflict detection again.
- When `detectConflicts()` finds a same-day clash, pass the two (or more) colliding tasks' context (priority, workspace, how far off the due date, any explicit urgency in the title/description) to the LLM and ask it to recommend which should be bumped and to what priority/date, with a one-line rationale.
- Surface as a suggestion attached to the existing `ConflictsPanel.jsx` card ("LOFT suggests: move 'Draft report' to High and reschedule to Thursday — reason: ...") with one-click accept that calls the existing task update endpoint. Same accept/dismiss pattern as item 10 — never auto-apply silently.

---

## Suggested sequencing

1. ~~**Storage folders + permissions**~~ — done.
2. ~~**Screen sharing**~~ — done (bundled with a persistent mini-player and a live annotation tool as related additions).
3. ~~**Online document collaboration**~~ — done. Phase 2's last remaining item is global search.
4. **Global search** (SQL-`LIKE` version) — no blocking decisions, moderate value, moderate effort. Good next pick.
5. **AI Assistant** (item 7) — once an LLM provider is chosen, this unlocks items 8, 10, and 11 cheaply since they all ride on the same tool-calling infrastructure.
6. **AI task reprioritization** (item 11) — highest-leverage AI feature given it directly extends the product's stated differentiator; cheap once item 7 exists.
7. **AI meeting scheduling** (item 8) and **action item extraction** (item 10) — similarly cheap once item 7 exists.
8. **Meeting summarization** (item 9) — do last among the AI items; needs the transcript-capture decision resolved.
9. **Billing** — do whenever the business actually needs to charge someone; no reason to build it before there's a paying user, and pricing/gating rules should be settled by then anyway.
10. **Platform admin panel** — do when there are enough real users/workspaces that moderation tooling is actually needed.

## Open decisions

Things I can't move forward on without a call from you:

- **LLM provider + API key** for all of Phase 3 (item 7 onward). Recommend Claude given the existing ecosystem here, but needs your account/key.
- **Payment provider** for billing (item 5) — Stripe vs. PayMongo/Xendit for PHP settlement, plus what actually gets gated behind the paid tier.
- **Production database** — currently SQLite for zero-setup local dev; the schema was deliberately kept portable (see `server/prisma/schema.prisma` header comment), so moving to PostgreSQL is a provider/URL change plus `prisma migrate dev`, not a rewrite. Worth doing before any real deployment — SQLite is fine for one process on one machine but won't hold up multi-instance.
- **Hosting/deployment target** — not yet chosen. Affects the meeting feature specifically (TURN server needed for reliable WebRTC across restrictive networks — currently STUN-only) and the file storage feature (local disk today; a real deployment should move `server/src/utils/uploads.js` to object storage such as S3-compatible storage rather than the server's local filesystem).
