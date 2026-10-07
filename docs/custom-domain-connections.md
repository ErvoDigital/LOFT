# Custom domain storage and realtime access

The production client uses `https://app.loft-client.site`. Moving the client to a custom domain also requires updating the origins allowed by S3 and the realtime function.

## Workspace and assistant API access

On 2026-10-08, the browser reported blocked `/api/workspaces` and `/api/assistant/status` requests from `https://app.loft-client.site`: their HTTP 304 responses carried `Access-Control-Allow-Origin: https://www.loft-client.site`. Fresh unauthenticated requests to both endpoints returned the app origin when checked afterward, so the stale responses must also be bypassed when verifying the fix.

In Vercel's **loft-server** project, set **Production** `CLIENT_URL=https://app.loft-client.site` and redeploy the server. Changing local `server/.env` does not update Vercel. To retain additional browser origins, configure the optional comma-separated `CLIENT_ALLOWED_ORIGINS`, for example:

```env
CLIENT_URL=https://app.loft-client.site
CLIENT_ALLOWED_ORIGINS=https://www.loft-client.site,https://loft-client.site,https://loft-client.vercel.app
```

The server now always includes the app origin and matches it, `CLIENT_URL`, and any additional configured origins exactly. An allowed request receives its own origin in the response, with `Vary: Origin`; unrelated domains receive no CORS allow header. See the [Express CORS configuration](https://expressjs.com/en/resources/middleware/cors/).

API responses use `Cache-Control: private, no-store`, disable generated ETags, and ignore GET/HEAD cache validators so a saved response from before the domain change cannot turn into another HTTP 304. See [HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching). Deploy the server changes, then open browser DevTools, enable **Disable cache** in Network, and reload the app. Confirm the authenticated workspace request returns HTTP 200 with `Access-Control-Allow-Origin: https://app.loft-client.site` and the existing workspace list. The client changes show an error and retry action if that request fails.

This repair changes HTTP origin and caching behavior; existing workspace memberships and data need no database migration.

## S3 preview and download

On 2026-10-06, a fresh signed GET for the PDF reported by the user returned HTTP 200 for both tested origins. S3 returned `Access-Control-Allow-Origin` for `https://loft-client.vercel.app`, but omitted it for `https://www.loft-client.site`. This prevents browser preview and download on the custom domain even though the object and read permission are valid.

In the AWS S3 console, open `ervodigital-loft-dev-assets-jpr` → Permissions → Cross-origin resource sharing (CORS) → Edit. Preserve any other origins/rules needed by other applications and add the LOFT origins from [storage-cors.json](../infra/aws/storage-cors.json). That file is JSON for the console editor, rather than the CLI's `CORSRules` wrapper.

Keep Block Public Access enabled. Uploads and deletes happen through the server; browsers only need GET (and optionally HEAD) access. See [AWS CORS configuration instructions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enabling-cors-examples.html).

The local server credential can read/write/delete objects but returned `AccessDenied` for `GetBucketCors`. Applying the change requires an AWS identity authorized to manage this bucket's CORS configuration.

## Realtime WebSocket

The deployed realtime endpoint returned HTTP 403 to a WebSocket upgrade with origin `https://www.loft-client.site`, while the same authenticated request with origin `https://loft-client.vercel.app` upgraded successfully (HTTP 101).

Rechecked on 2026-10-06: WebSocket upgrade requests from both `https://www.loft-client.site` and `https://loft-client.site` returned HTTP 403. The same request from `https://loft-client.vercel.app` without a token returned HTTP 401, showing that the old origin passes the origin check and reaches JWT authentication. This blocks chat sends, meeting starts, and other realtime features on the custom domain.

The updated `realtime/src/index.js` accepts `CLIENT_URL` plus the comma-separated `REALTIME_ALLOWED_ORIGINS` list, matched against exact HTTP/HTTPS origins. `neon.ts` defaults to the app subdomain and includes the existing custom-domain and Vercel origins. Redeploy the **Neon realtime function** from this updated source; deploying the Vercel client alone does not apply the origin fix. The explicit production environment settings are:

```env
CLIENT_URL=https://app.loft-client.site
REALTIME_ALLOWED_ORIGINS=https://app.loft-client.site,https://www.loft-client.site,https://loft-client.site,https://loft-client.vercel.app
```

Apply/redeploy the function so the running instance receives the new value. `neon.ts` sources this value from the deployment environment's `CLIENT_URL`. Keep the local Express server's `CLIENT_URL=http://localhost:5173` for local development. The production Vercel API's `CLIENT_URL` should also match the custom client origin.

On 2026-10-08, realtime was deployed to the Singapore LOFT project `summer-field-34192813`, production branch `br-rough-lab-aztdrmhw`. Deployment 3 completed successfully using the current Neon CLI bundler, resolving the previous bundle's `Dynamic require of "buffer" is not supported` failure. The running function accepts `https://app.loft-client.site`: an authenticated WebSocket connection returned HTTP 101, an unauthenticated connection returned HTTP 401, and an unrelated origin returned HTTP 403. The existing Vercel API also returned HTTP 200 for an authenticated read with `Access-Control-Allow-Origin: https://app.loft-client.site`.

The Singapore branch's own database has no users or workspaces. The function explicitly uses the existing API's `DATABASE_URL` and matching `JWT_SECRET`, preserving the application's current data in Ohio. `neon.ts` now declares this database override; load both values from the API's environment on subsequent deployments. Hosting realtime in Singapore does not migrate the database. The ignored local `.neon/project.json` links future Neon operations to the Singapore production branch, and `client/.env` points the development WebSocket proxy at Singapore.

The published client still pointed to the Ohio realtime endpoint when checked on 2026-10-08. The user will complete the frontend change in Vercel: open the **loft-client** project's environment variables, set the following value for **Production** (and for Preview if those builds should use production realtime), then redeploy the client. This Vite variable is read at build time:

```env
VITE_REALTIME_URL=https://br-rough-lab-aztdrmhw-realtime.compute.c-3.ap-southeast-1.aws.neon.tech
```

Deploy the updated Vercel client for draft preservation, acknowledgement timeouts, reconnect recovery, and visible connection errors. The client now clears a draft only after a successful send acknowledgement. It does not replay uncertain requests automatically, since they may already have been saved. Meeting join failures return to the lobby; an interrupted call releases the camera/microphone and asks the user to rejoin.

As of 2026-10-06, this repository has no `.github/workflows` deployment definition. GitHub's latest `main` checks/deployments show automatic Vercel deployments for `loft-client` and `loft-server`, with no Neon realtime deployment listed. A push that redeploys those Vercel projects does not establish that Neon received the updated source or environment. Run the separate Neon deployment through its configured deployment provider/account and verify the upgrade afterward.

The local Vite realtime proxy must send the origin accepted by the deployed function; if the production function's accepted origin changes, set local `VITE_REALTIME_PROXY_ORIGIN=https://app.loft-client.site` and restart Vite.

## Verify

Refresh the client and request a new download link; links expire after five minutes. Confirm the S3 response includes `Access-Control-Allow-Origin: https://app.loft-client.site`, and the realtime connection returns HTTP 101. Do not copy signed URLs or authentication tokens into diagnostics that are published or committed.

The pasted upload HTTP 400 is a separate request. The deployed authenticated asset-list GET returned HTTP 200. Inspect the failed upload response body for its validation error before changing upload behavior.
