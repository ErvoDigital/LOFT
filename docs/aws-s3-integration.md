# AWS S3 integration

## Evidence and verification scope

This document describes the implementation present in the LOFT repository as inspected on 2026-10-04. Its primary code sources are:

- `server/src/utils/uploads.js`, `server/src/utils/uploadValidation.js`, and `server/src/middleware/storageUpload.js`
- `server/src/controllers/assets.controller.js`, `server/src/services/uploadCompensation.js`, `server/src/services/assetStorage.js`, and `server/src/services/conversationPurge.js`
- `server/src/routes/assets.routes.js` and `server/src/routes/tasks.routes.js`
- `client/src/api/assets.js`, `client/src/lib/uploads.js`, and `client/src/components/storage/PreviewModal.jsx`
- `server/prisma/schema.prisma` and `server/.env.example`
- `server/test/storage-safety.test.js`, `server/test/download-contract.test.js`, and `server/test/upload-compensation.test.js`

No AWS or Vercel console was accessed for this review. The bucket, region, service URLs, private-access setting, and approved CORS origins below are team-provided configuration and each **requires cloud-console confirmation**. Code presence and offline test success do not establish that a production deployment is configured or working.

## 1. Overview

LOFT uses object storage for file bytes. The browser sends uploads to the LOFT server, the server stores the bytes in S3, and PostgreSQL stores the logical asset and version metadata. The currently implemented object-storage use cases are:

- workspace assets in the Storage UI;
- additional versions of an existing asset;
- task attachments; and
- chat attachments, including meeting-chat attachments.

Rich-text document image uploads are not part of this integration: `client/src/lib/documentImageUpload.js` states that those images are embedded in document content rather than uploaded to workspace Storage.

## 2. Connected services

| Service | Role | Configuration status |
| --- | --- | --- |
| LOFT client — `https://loft-client.vercel.app` | Upload UI; requests download authorization; fetches an authorized object directly from S3 for preview or download | Team-provided URL; **requires cloud-console confirmation** |
| LOFT server — `https://loft-server-delta.vercel.app` | Authenticates and authorizes users, validates uploads, performs S3 writes/deletes, and creates presigned reads | Team-provided URL; **requires cloud-console confirmation** |
| Neon PostgreSQL | Stores `Asset`, `AssetVersion`, `Folder`, task, conversation, and message relationships; file bytes are not stored here | The code uses Prisma/PostgreSQL via `DATABASE_URL`, and the repository identifies Neon for its database workflow; the deployed connection **requires cloud-console confirmation** |
| AWS S3 | Stores physical file objects | Team-provided service and bucket settings; **requires cloud-console confirmation** |

The client API base is `${VITE_API_URL}/api` (or same-origin `/api` when unset). The client and server deployments must therefore agree on the server base URL and the routes and response shapes described below.

## 3. AWS resource configuration

| Setting | Intended value | Evidence/status |
| --- | --- | --- |
| AWS Region | `ap-southeast-2` | Team-provided; **requires cloud-console confirmation**. Note that `server/.env.example` currently contains `ap-southeast-1`, so the example and intended deployment value differ. |
| S3 bucket | `ervodigital-loft-dev-assets-jpr` | Team-provided; **requires cloud-console confirmation** |
| Bucket access | Private | Team-provided; **requires cloud-console confirmation**. The application design is consistent with private objects because reads require a server-created presigned URL and uploads/deletes use server credentials, but the repository has no bucket-policy or public-access-block definition that proves the cloud setting. |
| S3 endpoint | Native AWS S3 | `AWS_ENDPOINT_URL_S3` should normally be blank. The server uses it only as an override for a local or S3-compatible service and enables path-style addressing when it is set. |

The repository does not contain infrastructure-as-code that defines this bucket, its public-access block, IAM policy, or CORS rules. Those settings cannot be verified from source alone.

## 4. Architecture and request flows

### Responsibilities

| Component | Responsibility |
| --- | --- |
| Client | Sends `multipart/form-data` uploads to the server; asks the server for download authorization; validates that the returned URL uses HTTP(S); fetches the object from S3 with `credentials: "omit"`; creates a browser blob URL for preview/download. |
| Server | Requires authentication and workspace membership; enforces task, conversation, folder, uploader, and `files.manage` rules; validates the upload; generates the physical name; calls S3; writes metadata; presigns authorized reads; coordinates deletion and compensation. |
| PostgreSQL | Holds logical asset/folder/task/chat relationships and version metadata: original filename, server-generated stored name, MIME type, byte size, uploader, version number, and timestamps. |
| S3 | Holds bytes at a workspace-prefixed object key. It does not decide LOFT workspace or restricted-folder authorization. |

### Upload flow

1. The client posts one `file` field to a workspace asset, asset-version, task-attachment, or chat-attachment endpoint. Chat uploads also send `conversationId`; workspace uploads may send `folderId`.
2. Server route middleware requires an authenticated workspace member and complete storage configuration. Multer buffers one file in memory and enforces the 25 MiB limit.
3. The controller performs use-case authorization and validates the filename, extension, declared MIME type, and file content/signature.
4. The server creates a UUID `storedName` and sends `PutObject` with the key `<workspaceId>/<storedName>`, the byte buffer, and `ContentType`.
5. Only after S3 succeeds does the server create the Prisma metadata. If that database operation fails, `uploadWithCompensation` attempts to delete the newly uploaded S3 object and then rethrows the database error. If compensating deletion also fails, the server logs safe identifiers and returns `File upload could not be completed`.
6. On success, the server returns the serialized asset metadata. The serialized response excludes `storedName`.

Workspace, task, chat, and version uploads all use this compensation service. Version creation uses a serializable transaction, retries Prisma uniqueness/transaction conflicts up to four attempts, and generates a fresh object name for each attempt; failed attempts are compensated.

### Preview flow

1. The client calls `GET /api/workspaces/:workspaceId/assets/:assetId/versions/:versionId/download`.
2. The server verifies workspace membership, verifies that the version belongs to the requested asset/workspace, and enforces restricted-folder access.
3. The server creates a `GetObject` presigned URL with a 300-second lifetime and returns `{ "url": "..." }`. It does not redirect the browser.
4. The client fetches that URL directly from S3 with browser credentials omitted and converts the response to a blob.
5. The preview component uses a blob URL for images and PDFs, renders DOCX from the blob with `docx-preview`, and offers download rather than inline rendering for other accepted types. The validator permits no video type even though the generic preview component has a video branch.

### Download flow

Download uses the same authorization endpoint and direct S3 `GET` as preview. After receiving the blob, the client creates a temporary object URL, clicks an `<a download>` element using `AssetVersion.originalName`, and revokes the object URL. The LOFT bearer token is sent only to the LOFT API and is not forwarded to S3.

### Delete flow

For direct asset or task-attachment deletion, the server verifies the asset scope and requires either the original uploader or `files.manage`; restricted-folder access is also enforced. It then deletes every distinct version object sequentially before deleting the database asset. A missing S3 object (`NotFound`/`NoSuchKey`) is treated as already deleted. Any other S3 deletion failure becomes `Failed to delete stored object` and prevents the database deletion.

Deleting a task deletes all attachment objects before deleting the task. Conversation/channel purge finds both message-referenced attachment assets and assets still in the managed chat folder, deletes their version objects, and only then deletes the asset/conversation metadata transactionally. Merging assets only reassigns version metadata and does not move or copy S3 objects because keys are already workspace-scoped.

## 5. Current storage use cases

- **Workspace assets:** top-level or ordinary-folder files shown by the workspace Storage UI. General asset listing excludes task attachments.
- **Asset versions:** each upload creates an `AssetVersion`; adding a version stores another physical object and increments the logical version number.
- **Task attachments:** represented as `Asset` rows with `taskId`; they bypass the Storage folder system and are listed on their task.
- **Chat attachments:** represented as assets in a server-managed folder for the conversation. Default/general chat files are workspace-visible; selected group chats receive a restricted folder populated from conversation participants. Meeting chats are organized below a shared `Meeting files` folder.

## 6. Object organization

`server/src/utils/uploads.js` defines the complete object-key format:

```text
<workspaceId>/<storedName>
```

`storedName` is exactly `crypto.randomUUID()`; it has no filename extension. User-controlled names and paths never form part of the S3 key. The original filename remains in PostgreSQL as `AssetVersion.originalName`, while `AssetVersion.storedName` records the UUID needed to reconstruct the S3 key. Folder nesting is also database metadata (`Asset.folderId`); it does not create S3 directory levels.

## 7. Environment variables

Only the LOFT server should receive these variables.

| Variable | Secret? | Description |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | Yes | Access-key identifier used by the server's explicit AWS SDK credentials configuration. Treat it as credential material even though the secret key is the more sensitive half. |
| `AWS_SECRET_ACCESS_KEY` | **Yes** | Secret key paired with the access-key ID. |
| `AWS_REGION` | No | AWS region used to construct the S3 client and sign requests. |
| `AWS_S3_BUCKET` | No | Bucket used for every object operation. |
| `AWS_ENDPOINT_URL_S3` | No, but deployment-sensitive | Optional S3-compatible endpoint override. Leave blank for native AWS S3; setting it also enables `forcePathStyle`. |

Storage is considered configured only when region, bucket, access-key ID, and secret access key are all nonblank. The endpoint is optional. When required configuration is absent, upload middleware and download/delete operations fail with HTTP 503 `Object storage is not configured` rather than preventing server startup.

## 8. IAM permissions

The code performs only `PutObject`, `GetObject` (through presigning), and `DeleteObject`. A minimum identity policy for the server credential is therefore:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LoftObjectOperations",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::ervodigital-loft-dev-assets-jpr/*"
    }
  ]
}
```

The bucket name in this team-provided policy example **requires cloud-console confirmation**. The current implementation does not call bucket-listing, ACL, bucket-policy, or multipart-upload APIs, so it does not require `s3:ListBucket`, `s3:PutObjectAcl`, or bucket-administration permissions. Bucket policy and any key-management policy must still permit the identity's operations; the code does not set an ACL or an explicit server-side-encryption option.

## 9. CORS

Approved browser origins supplied by the team are:

- `http://localhost:5173` — **requires cloud-console confirmation**
- `https://loft-client.vercel.app` — **requires cloud-console confirmation**

The browser performs only a credential-omitted `GET` to S3. Upload and delete calls are server-to-S3 calls and do not require S3 CORS methods. A minimal recommended bucket CORS document matching the current browser code is:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://loft-client.vercel.app"
    ],
    "AllowedMethods": ["GET"],
    "MaxAgeSeconds": 300
  }
]
```

Do not replace the origins with `*`. This S3 policy is separate from the Express CORS configuration in `server/src/app.js`, which allows the single origin in `CLIENT_URL` and enables credentials for LOFT API requests.

## 10. Upload security

### Size and format validation

Multer and application validation both enforce a maximum of `25 * 1024 * 1024` bytes (25 MiB); empty files are rejected. The accepted extension/MIME combinations are:

| Extensions | Accepted declared MIME type(s) | Content validation |
| --- | --- | --- |
| `.pdf` | `application/pdf` | `%PDF-` signature |
| `.txt` | `text/plain` | Valid UTF-8, no NUL, and no detected active web/script-like content |
| `.md` | `text/markdown`, `text/plain` | Same text checks |
| `.csv` | `text/csv`, `text/plain` | Same text checks |
| `.docx` | Office Open XML Word MIME | Valid CRC-checked ZIP plus expected content-type, relationship, and `word/document.xml` entries |
| `.xlsx` | Office Open XML Spreadsheet MIME | Valid CRC-checked ZIP plus expected content-type, relationship, and `xl/workbook.xml` entries |
| `.pptx` | Office Open XML Presentation MIME | Valid CRC-checked ZIP plus expected content-type, relationship, and `ppt/presentation.xml` entries |
| `.jpg`, `.jpeg` | `image/jpeg` | JPEG prefix |
| `.png` | `image/png` | PNG signature |
| `.gif` | `image/gif` | GIF87a or GIF89a signature |
| `.webp` | `image/webp` | RIFF/WEBP markers |

This is signature/structure validation, not antivirus scanning or full content sanitization.

### Filename and path validation

The server normalizes names to Unicode NFC, trims whitespace, rejects empty names, control characters, literal or Unicode path separators, and single- or repeatedly-encoded `/` and `\` separators. The basename must be no more than 255 UTF-8 bytes. Physical names are server UUIDs, preventing a client filename from selecting a key or overwriting another upload.

### Authorization

All asset and task-attachment routes require authentication and workspace membership. Restricted-folder visibility checks walk the complete ancestor chain and fail closed for missing or cyclic ancestry. General uploads cannot target server-managed chat-folder ancestry. Chat uploads require conversation membership and resolve the destination folder on the server. Adding a version requires the original uploader or `files.manage`; deletion has the same ownership/permission rule.

### Compensation, deletion, and temporary access

- S3 upload occurs before metadata creation; a database failure triggers deletion of only the newly created object.
- Object deletion occurs before metadata deletion, and a non-`NotFound` S3 error stops the database mutation.
- Version objects are deleted sequentially so the first real storage failure stops later object and metadata operations.
- Authorized read URLs expire after 300 seconds (five minutes).

These controls reduce inconsistency but are not durable across process termination; see Known limitations.

## 11. Deployment

Configure all five AWS variable names in the Vercel project that deploys the LOFT server, not the client project. At minimum, region, bucket, access-key ID, and secret access key must be present for storage endpoints to work. Leave the endpoint override blank for native AWS S3.

Vercel Production and Preview are separate configuration scopes. Configure and validate each scope intentionally:

- **Production:** should point the production server deployment at the intended production-approved storage resources. The team-provided production URL and present variable values **require cloud-console confirmation**.
- **Preview:** should use explicitly approved preview values and preferably isolated data/resources. Do not assume Production variables are available to Preview deployments.

The deployed client must set its API base so it reaches the matching server, and the server's API CORS origin must match that client. Both versions must agree that the download authorization endpoint returns JSON `{ url }`; the current client does not expect an HTTP redirect. S3 must separately allow direct `GET` from the approved browser origins.

## 12. Testing and verification

### Existing repository coverage

The focused tests use fake Prisma/S3 clients and fake browser APIs; they do not contact AWS, Neon, or deployed Vercel services.

- `storage-safety.test.js`: upload types/signatures, active text rejection, filename/path rules, Multer size mapping, folder and asset authorization, configured-storage behavior, deletion ordering/failure behavior, and chat/task cleanup.
- `download-contract.test.js`: five-minute `{ url }` response, key and content-disposition construction, restricted-folder denial before signing, direct credential-omitted browser fetch, filename-preserving browser download, and safe client errors.
- `upload-compensation.test.js`: failed put behavior, database-failure compensation, safe logging when cleanup fails, compensation for all four upload flows, and concurrent version retry/cleanup behavior.

### Tests run during this documentation task

On 2026-10-04, the following command was run from `server/`:

```text
node --test test/storage-safety.test.js test/download-contract.test.js test/upload-compensation.test.js
```

Result: **44 passed, 0 failed** across 9 suites. These are offline implementation tests, not deployment or live-cloud tests.

### Local checklist

1. Use non-production AWS credentials and a test workspace. Confirm the server has its AWS variables and that the client targets the local server.
2. Upload one accepted file. Confirm the API returns 201, an asset/version row exists, and S3 contains exactly one object at `<workspaceId>/<storedName>`.
3. Try an oversized, forbidden, signature-mismatched, and path-bearing filename; confirm each fails and creates neither an S3 object nor metadata.
4. Preview an image, PDF, and DOCX. In browser developer tools, confirm the LOFT API first returns `{ url }`, followed by a direct S3 `GET` without the LOFT Authorization header.
5. Download a file and confirm the saved filename matches `originalName`.
6. Verify an unauthorized workspace user or restricted-folder outsider cannot obtain a URL.
7. Delete the asset and verify all version keys disappear from S3 and the metadata is removed. Repeat for a task with attachments and a conversation with chat attachments.

### Production checklist

1. In authorized consoles, confirm the server Production variables, exact region/bucket, credential identity, bucket public-access block/private policy, encryption expectations, and the two non-wildcard CORS origins.
2. Confirm the deployed client API base, server `CLIENT_URL`, health endpoint, and client/server release compatibility.
3. With a non-sensitive test file and a least-privileged test account, exercise workspace upload, version upload, task attachment, and chat attachment.
4. Verify preview and download in browser network tools: API authorization succeeds, direct S3 `GET` succeeds, no LOFT bearer token reaches S3, and the URL expires after approximately five minutes.
5. Verify restricted-folder and conversation access with a second user who should be denied.
6. Delete the test records through LOFT and confirm the physical objects are absent from S3.
7. Review server logs for safe error summaries only; do not copy or log presigned URLs or credentials.

Successful completion of this checklist—not code presence or offline tests—is the basis for declaring a deployment verified.

### Confirming deletion from S3

Before deletion, obtain the `AssetVersion.storedName` through authorized database administration and construct `<workspaceId>/<storedName>`. After deleting through LOFT, inspect that exact key in the S3 console or use an authorized `HeadObject`/equivalent check. The expected outcome is not-found. Also confirm the corresponding `Asset`/`AssetVersion` metadata is gone. Do not infer physical deletion only from the UI, and do not expose the database connection or any signed URL while collecting evidence.

### Common failures

| Message/symptom | Likely cause |
| --- | --- |
| `Object storage is not configured` (503) | One or more required server AWS variables are blank/missing. A blank endpoint alone is valid. |
| `File exceeds the 25 MiB upload limit` (413) | Multer or application validation rejected a file larger than 25 MiB. |
| `No file uploaded` / `Empty files are not allowed` | Missing multipart `file` field or zero-byte upload. |
| `Invalid filename` / `Filename must be at most 255 UTF-8 bytes` | Empty/path-bearing/control-character/encoded-separator name or excessive UTF-8 length. |
| `File type is not allowed` (415) | Extension and declared MIME pair is not on the allowlist. |
| `File content does not match its declared type` (415) | Signature/OOXML structure/text safety checks failed. |
| Membership, folder, conversation, uploader, or permission 403 | LOFT authorization rejected the request before signing or mutation. |
| `Failed to delete stored object` (502) | S3 deletion failed for a reason other than not-found; check IAM, bucket/region/key configuration, and AWS availability. Metadata is intentionally retained. |
| `File upload could not be completed` (500) | Metadata persistence failed after upload and the compensating S3 delete also failed. An orphan is possible and logs contain the workspace/object identifiers for controlled reconciliation. |
| `File download link is unavailable` | Server response omitted a parseable HTTP(S) URL or client/server contracts do not match. |
| `File could not be downloaded` / preview `Couldn't load this file.` | Direct S3 fetch failed or returned non-OK: possible expired signature, deleted object, incorrect bucket/region, IAM/bucket-policy denial, or CORS rejection. |
| Upload fails while direct reads work | `s3:PutObject`, server credential, bucket, or region problem; S3 browser CORS does not govern the server-side upload. |

## 13. Known limitations and next phases

- Compensation is in-process. A crash or forced termination after `PutObject` but before metadata commits or cleanup runs can leave an orphaned object.
- Deletion is also not atomic across S3 and PostgreSQL. A crash after object deletion but before metadata deletion can leave a dangling metadata record.
- There is no durable cleanup queue, object inventory reconciliation job, or outbox worker in the repository.
- S3 operations and database mutations cannot share a transaction.
- Files are buffered entirely in server memory; there is no multipart or direct-to-S3 upload path.
- Validation does not include malware scanning.

A future phase should add a transactional outbox/reconciliation design:

1. Create a database operation record with a deterministic object key and state such as `PENDING_UPLOAD`, `ACTIVE`, or `PENDING_DELETE` in the same transaction as the intended metadata change.
2. Let an idempotent worker perform S3 operations and advance state with retry count, backoff, and last-error metadata.
3. Treat delete not-found as success, matching current behavior.
4. Periodically compare database-referenced keys with S3 inventory/listing output, quarantine or delete aged unreferenced objects after a safety window, and flag referenced-but-missing keys.
5. Add metrics and alerts for stuck operations and a reviewed dead-letter path. Grant any future listing/inventory permission separately; it is not required by the current server runtime.

## 14. Security warnings

- Never commit `server/.env`.
- Never place AWS credentials or other server secrets in `VITE_*` variables; Vite variables are browser-visible.
- Never expose credentials, connection strings, or secret values in screenshots, tickets, logs, or documentation.
- Presigned URLs grant temporary access and should not be logged, pasted into tickets, or shared.
- Keep the bucket private, retain public-access blocking, and use a server identity restricted to the configured bucket. The actual cloud controls **require cloud-console confirmation**.

## Current integration status

| Capability/configuration | Implemented in code | Existing test coverage | Tested during this task | Deployment/cloud status |
| --- | --- | --- | --- | --- |
| Workspace asset upload | Yes | Validation, authorization, compensation | Passed offline focused suite | Not verified |
| Asset-version upload | Yes | Authorization, compensation, concurrent retry | Passed offline focused suite | Not verified |
| Task attachments | Yes | Scoping, visibility exclusion, upload compensation, deletion failure ordering | Passed offline focused suite | Not verified |
| Chat/meeting attachments | Yes | Managed-folder authorization, compensation, purge and deletion ordering | Passed offline focused suite | Not verified |
| Preview and download through `{ url }` | Yes; 300-second presigned `GetObject`, then direct browser fetch | Server authorization/signing and browser contract | Passed offline focused suite | Not verified |
| Object deletion | Yes; all version keys before metadata | Not-found handling, failure propagation, asset/task/chat ordering | Passed offline focused suite | Not verified |
| UUID workspace-prefixed keys and filename metadata separation | Yes | Key construction and validation assertions | Passed offline focused suite | Not applicable to deployment until live objects are inspected |
| 25 MiB/type/signature/path validation | Yes | Allowlist and rejection cases | Passed offline focused suite | Not verified with deployed runtime |
| Intended region/bucket/private access | Application accepts configured values; cloud resource definition absent | No live-cloud test | Not tested against AWS | **Requires cloud-console confirmation** |
| Approved S3 CORS origins | Recommended here; no repository-managed bucket CORS | No live browser/cloud test | Not tested against AWS | **Requires cloud-console confirmation** |
| Minimum IAM permissions | Operations in code are Get/Put/Delete object | Fake-client command tests only | Passed offline command-path tests | **Requires cloud-console confirmation** |
| Client/server Vercel URLs and environment scopes | Deployment files exist, but do not prove active URLs or variable values | No deployment test | Not tested | **Requires cloud-console confirmation** |
| Durable cleanup/outbox and reconciliation | No | No | No | Planned future phase |

