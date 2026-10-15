# SyncTayo marketing website

The public SaaS marketing site for SyncTayo. This is separate from the authenticated React app in `client/` and does not require an API server or an AI key.

## Run locally

From the repository root:

```powershell
npm --prefix website install
npm run dev:website
```

Open http://localhost:3000. To link to a local SyncTayo app, copy `website/.env.example` to `website/.env.local`, set `VITE_LOFT_APP_URL=http://localhost:5173`, and run the client separately with `npm run dev:client`.

## Verify and build

```powershell
npm run check:website
npm run build:website
```

Deploy the generated `website/dist/` directory to your static hosting provider. The site uses hash routes (`#/features`, `#/pricing`, and `#/about`) so navigation, refresh, and browser history work without server rewrite rules.

## App links

“Log in” opens `https://client.synctayo.online/login`. Get Started, “Try for free”, and account-creation links open `https://client.synctayo.online/register`.

To use a local or staging app, set `VITE_LOFT_APP_URL` to its origin. For the production `loft-website` deployment, set `VITE_LOFT_APP_URL=https://client.synctayo.online` or leave it unset to use the default. A saved setting pointing to the retired `app.loft-client.site` origin is automatically replaced with the current production origin. Vite embeds this setting in the generated JavaScript, so rebuild and redeploy the website for changes to reach the live site.

## Product content

Shared feature descriptions, frequently asked questions, and page metadata live in `src/data/product.ts`. The homepage sandbox follows the app's emerald palette, personal navigation rail, contextual workspace menus, and light/dark themes. Its shared sample data supports task creation and editing, drag-and-drop status changes, cross-workspace conflict review, event scheduling, channel and direct messages, document editing, and local file uploads with version history. Task and event changes also update the dashboard and My Plan. Meetings simulate joining, camera/microphone controls, and screen sharing without requesting device access.

Sandbox changes and uploaded files exist only in memory for the current page session. Reset demo restores the sample workspaces. The sandbox never reads or writes real workspace data and needs no backend. Its implementation lives in `src/components/ProductPreview.tsx` and `src/components/sandbox/`.

Copy describes implemented SyncTayo features. Assistant and speech features are described as conditional on deployment configuration. The pricing page describes current free access, since billing and paid-tier limits have not been implemented.
