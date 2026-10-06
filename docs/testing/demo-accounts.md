# Populated demo accounts

Run `npm run prisma:seed:demo` with `ALLOW_DEV_SEED=true` against the configured non-production `server/.env` database. This adds fixtures without deleting existing data. It refuses production mode and conflicting identities and preserves existing fixture passwords and edits on rerun. This is separate from the original four-user search-test seed.

| Administrator | Seven member accounts | Shared workspaces |
| --- | --- | --- |
| `demo.admin1@loft.test` | `demo.member01@loft.test` through `demo.member07@loft.test` | Demo Team 1 - Product; Demo Team 1 - Operations |
| `demo.admin2@loft.test` | `demo.member08@loft.test` through `demo.member14@loft.test` | Demo Team 2 - Product; Demo Team 2 - Operations |
| `demo.admin3@loft.test` | `demo.member15@loft.test` through `demo.member21@loft.test` | Demo Team 3 - Product; Demo Team 3 - Operations |
| `demo.admin4@loft.test` | `demo.member22@loft.test` through `demo.member28@loft.test` | Demo Team 4 - Product; Demo Team 4 - Operations |

LOFT has `ADMIN` and `MEMBER` roles; the four administrators use `ADMIN` in their own two workspaces. Each group has only its administrator and seven members, with no memberships in the other demo teams.

Each workspace contains three tasks per person (including active and completed tasks), two channels with eight messages each, and a shared reference folder. Totals: 32 accounts, 8 workspaces, 64 memberships, 192 tasks, 16 channels and 128 messages. Dates are relative to the initial seed run; rerunning preserves existing records.

Each login has a separate randomly generated password. The seed exports all 32 emails/passwords and group assignments to `server/.seed-accounts/accounts.csv`; `accounts.json` in the same directory preserves credentials for resumable runs. Both are gitignored. Keep this directory private and retain it for reruns; no real-user passwords are reset.

`npm run prisma:seed:demo -- --prepare` prepares credentials and sample files locally without connecting to the database. These logins become usable only after the normal seed run succeeds.

The seed generates 24 real text/CSV files under `server/.seed-accounts/<workspace-id>/`. If object storage is configured, it uploads each file using LOFT's existing S3 adapter before creating the corresponding asset/version records. If storage is absent, files remain staged locally without broken file entries in the app. Configure `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and an endpoint if needed in `server/.env`, then rerun the same command to finish uploads. Interrupted uploads reuse the fixture object keys.

Verify the offline fixture structure with `node --test server/test/demo-accounts.test.js`. The live seed prints database counts and uploaded-file counts without credentials or connection strings.
