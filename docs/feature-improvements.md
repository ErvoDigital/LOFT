# Existing feature improvements

Implementation checklist for the improvements requested on October 17, 2026.

- [x] Reliable scheduled reminders, document save retries, partial event validation
- [x] Account-backed personal planning, working days and meeting-aware capacity
- [x] Timezone-aware conflicts, workload context and rescheduling previews
- [x] Global search UI, document/event/direct-message results
- [x] Task subtasks, dependencies, comments and history
- [x] Calendar recurrence, attendance responses and save-time conflict warnings
- [x] Notification controls, quiet hours, reminder offsets and snoozing
- [x] Document save status, offline recovery and version restoration
- [x] Meeting TURN configuration, connection feedback and recovery
- [x] Chat replies, pins, editing and task creation from a message
- [x] File recycle bin, version restoration and resumable uploads
- [x] Confirmed assistant updates and permission-aware summaries with sources
- [x] Regression tests, production build and deployment/configuration notes

Database migrations are prepared locally in `server/prisma/migrations/20261017000000_feature_improvements/migration.sql`. Existing development or production data is not seeded or reset.

## Deployment & Configuration Requirements

1. **Database Migration**
   - Apply the prepared migration (`server/prisma/migrations/20261017000000_feature_improvements/migration.sql`) using `npx prisma migrate deploy` (with `DIRECT_URL` and `DATABASE_URL` configured) and regenerate the Prisma client (`npm run prisma:generate`).
   - Do not run seed or reset commands against existing development or production databases (`ALLOW_DEV_SEED` remains guarded).

2. **Scheduled Reminders Cron (`CRON_SECRET`)**
   - `server/vercel.json` schedules `GET /api/cron/reminders` every minute (`* * * * *`).
   - Set `CRON_SECRET` in the server deployment environment; Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to cron routes, and external schedulers must supply the same header.

3. **WebRTC TURN Relay (`TURN_URLS`, `TURN_SHARED_SECRET`)**
   - Set `TURN_URLS` (comma-separated `turn:` / `turns:` URIs) and `TURN_SHARED_SECRET` (HMAC-SHA1 shared secret for ephemeral credentials) in the server environment to enable relay fallback for `GET /api/meetings/ice`.
   - When omitted, meetings fall back to STUN (`stun:stun.l.google.com:19302`) and surface connection/relay status in the meeting UI.

4. **Resumable Multipart Uploads (>5 MiB)**
   - Files above 5 MiB use S3 multipart upload sessions (`/api/workspaces/:workspaceId/uploads/sessions`) with presigned part `PUT` URLs and SHA-256 verification.
   - Ensure the S3-compatible bucket CORS policy allows `PUT` from the client origin and exposes the `ETag` response header (`ExposeHeaders: ["ETag"]`).
