# Custom domain storage and realtime access

The production client uses `https://www.loft-client.site`. Moving the client to a custom domain also requires updating the origins allowed by S3 and the realtime function.

## S3 preview and download

On 2026-10-06, a fresh signed GET for the PDF reported by the user returned HTTP 200 for both tested origins. S3 returned `Access-Control-Allow-Origin` for `https://loft-client.vercel.app`, but omitted it for `https://www.loft-client.site`. This prevents browser preview and download on the custom domain even though the object and read permission are valid.

In the AWS S3 console, open `ervodigital-loft-dev-assets-jpr` → Permissions → Cross-origin resource sharing (CORS) → Edit. Preserve any other origins/rules needed by other applications and add the LOFT origins from [storage-cors.json](../infra/aws/storage-cors.json). That file is JSON for the console editor, rather than the CLI's `CORSRules` wrapper.

Keep Block Public Access enabled. Uploads and deletes happen through the server; browsers only need GET (and optionally HEAD) access. See [AWS CORS configuration instructions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enabling-cors-examples.html).

The local server credential can read/write/delete objects but returned `AccessDenied` for `GetBucketCors`. Applying the change requires an AWS identity authorized to manage this bucket's CORS configuration.

## Realtime WebSocket

The deployed realtime endpoint returned HTTP 403 to a WebSocket upgrade with origin `https://www.loft-client.site`, while the same authenticated request with origin `https://loft-client.vercel.app` upgraded successfully (HTTP 101).

Rechecked on 2026-10-06: WebSocket upgrade requests from both `https://www.loft-client.site` and `https://loft-client.site` returned HTTP 403. The same request from `https://loft-client.vercel.app` without a token returned HTTP 401, showing that the old origin passes the origin check and reaches JWT authentication. This blocks chat sends, meeting starts, and other realtime features on the custom domain.

The updated `realtime/src/index.js` accepts `CLIENT_URL` plus the comma-separated `REALTIME_ALLOWED_ORIGINS` list, matched against exact HTTP/HTTPS origins. `neon.ts` supplies both custom-domain variants and the existing Vercel origin by default. Redeploy the **Neon realtime function** from this updated source; deploying the Vercel client alone does not apply the origin fix. The explicit production environment settings are:

```env
CLIENT_URL=https://www.loft-client.site
REALTIME_ALLOWED_ORIGINS=https://www.loft-client.site,https://loft-client.site,https://loft-client.vercel.app
```

Apply/redeploy the function so the running instance receives the new value. `neon.ts` sources this value from the deployment environment's `CLIENT_URL`. Keep the local Express server's `CLIENT_URL=http://localhost:5173` for local development. The production Vercel API's `CLIENT_URL` should also match the custom client origin.

Deploy the updated Vercel client for draft preservation, acknowledgement timeouts, reconnect recovery, and visible connection errors. The client now clears a draft only after a successful send acknowledgement. It does not replay uncertain requests automatically, since they may already have been saved. Meeting join failures return to the lobby; an interrupted call releases the camera/microphone and asks the user to rejoin.

As of 2026-10-06, this repository has no `.github/workflows` deployment definition. GitHub's latest `main` checks/deployments show automatic Vercel deployments for `loft-client` and `loft-server`, with no Neon realtime deployment listed. A push that redeploys those Vercel projects does not establish that Neon received the updated source or environment. Run the separate Neon deployment through its configured deployment provider/account and verify the upgrade afterward.

The local Vite realtime proxy must send the origin accepted by the deployed function; if the production function's accepted origin changes, set local `VITE_REALTIME_PROXY_ORIGIN=https://www.loft-client.site` and restart Vite.

## Verify

Refresh the client and request a new download link; links expire after five minutes. Confirm the S3 response includes `Access-Control-Allow-Origin: https://www.loft-client.site`, and the realtime connection returns HTTP 101. Do not copy signed URLs or authentication tokens into diagnostics that are published or committed.

The pasted upload HTTP 400 is a separate request. The deployed authenticated asset-list GET returned HTTP 200. Inspect the failed upload response body for its validation error before changing upload behavior.
