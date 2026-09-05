# LOFT

A unified productivity and collaboration platform for people juggling multiple independent teams — school, work, orgs, church — in one synchronized workspace. LOFT's core differentiator: it actively surfaces **cross-workspace conflicts** (two deadlines from unrelated groups landing on the same day, overlapping meetings) instead of leaving you to notice them yourself.

## Tech stack

- **Frontend:** React 18 + Vite + Tailwind CSS, React Router, Socket.io client
- **Backend:** Node.js + Express, Socket.io, JWT auth, Zod validation
- **Database:** Prisma ORM. Ships on **SQLite** (zero setup, file-based) — schema uses only cross-compatible types, so switching to **PostgreSQL** for production is a two-line change (see below).

## Project structure

```
Loft/
  server/           Express API + Socket.io
    prisma/         schema.prisma, migrations, dev.db
    src/
      controllers/   route handlers
      routes/        Express routers
      services/      notification, conflict-detection, reminder job
      sockets/       Socket.io chat server
      middleware/     auth, error handling
  client/           React app (Vite)
    src/
      pages/          route-level screens
      components/     layout, dashboard, calendar, tasks, chat, notifications, common
      context/        Auth, Socket, Workspace, Notifications providers
      api/            typed fetch wrappers per domain
```

## Running it

```bash
npm install                 # installs both workspaces
npm run prisma:migrate      # creates the SQLite database (first run only)
npm run dev                 # runs API on :4000 and client on :5173 concurrently
```

Visit http://localhost:5173. The Vite dev server proxies `/api` and `/socket.io` to the backend, so no CORS setup is needed locally.

### Switching to PostgreSQL for production

1. In `server/prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set `DATABASE_URL` in `server/.env` to your Postgres connection string.
3. Run `npm run prisma:migrate` again to apply the schema.

No application code changes needed — the schema deliberately avoids SQLite-incompatible features it wouldn't otherwise need (native enums, arrays, `Json` columns), so it's portable as-is.

### Password recovery in dev

There's no email service wired up. `/api/auth/forgot-password` returns the reset token directly in the JSON response when `NODE_ENV !== "production"`, and the Forgot Password page surfaces it as a clickable link so the full flow is testable without SMTP.

## Feature status

### MVP — built and verified end-to-end
1. **Accounts** — register/login (JWT), password recovery, profile editing, password change, workspace-scoped roles (Admin/Manager/Member)
2. **Workspaces** — create, join via invite code, member management, role changes
3. **Shared calendar** — per-workspace month view, create/edit/cancel events, attendees, merged personal view via the dashboard, 15-minute reminder job
4. **Tasks** — per-workspace kanban (To Do / In Progress / Completed) with native drag-and-drop reordering and cross-column moves (fractional `order` field, no library), priority, due dates, assignment, 24-hour due-soon reminders
5. **Real-time chat** — one group chat per workspace + 1:1 direct messages, typing indicators, all over Socket.io
6. **Dashboard** — aggregated upcoming events, pending tasks, recent activity and notifications across *every* workspace at once
7. **Cross-workspace conflict detection** — flags overlapping events and same-day deadlines across unrelated workspaces, surfaced prominently on the dashboard with links straight to the colliding items
8. **Notifications** — in-app bell with live Socket.io push for assignments, new events, deadline/meeting reminders, meeting starts, and workspace joins
9. **Meetings** — per-workspace video calls over native WebRTC (mesh topology), signaled through the existing Socket.io server — no third-party video SDK or API keys. Mic/camera toggles, live participant tiles, "meeting is live" notifications to workspace members. STUN-only (Google's public server), no TURN — works on typical networks but may fail across strict/symmetric NATs.
10. **Storage** — Frame.io-style file storage per workspace: upload any file/video, drag a new take onto an existing card to merge it in as the next version (shows a "V2" badge), version history per entry, authenticated download (membership-checked, not publicly served), drag-and-drop upload zone.

Verified via direct API and Socket.io testing: registration, workspace creation, a cross-workspace deadline clash correctly detected, event creation, invite-code join, password reset token issuance, task drag-reorder (`order` field updates correctly), file upload → second upload → merge → correctly collapses to one entry at V2 → authenticated download returns the right bytes and rejects unauthenticated requests, and a two-client meeting signaling test (status query, join ack with peer list, peer-joined/left broadcasts, offer/answer relay) all behaved correctly. `npm run build` passes with no errors. I did **not** verify actual camera/video rendering between two real browsers — that needs live camera permissions in two separate browser sessions, which isn't something I can automate here; the signaling plumbing underneath it is confirmed working.

### Phase 2 & Phase 3 — not built yet
Shared docs, global search, billing, admin panel, and the AI assistant layer (scheduling, meeting summarization, action-item extraction, task reprioritization) are still open — several need external services (Stripe, an LLM provider) that need account/key decisions before wiring in. Happy to scope and build any of these next — just say which to prioritize.

## Design

Flat, professional UI in the ClickUp/Linear vein: a neutral slate (`ink`) base with a single indigo (`brand`) accent and an amber (`accent`) tone reserved for semantic states (priority, warnings). Solid white cards with thin borders and subtle shadows — no glassmorphism, translucency, or blur. Navigation is a dark icon rail plus a light contextual workspace panel, with `lucide-react` for all iconography (no emoji). Avoids directional arrow iconography in navigation — the calendar month-switcher uses a native `<input type="month">` instead of prev/next arrows.
