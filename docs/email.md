# Email setup

LOFT uses Brevo's transactional email API for welcome emails (including new Google accounts), password resets, workspace invitations, sign-in verification and password-change verification. All five email types share the backend mail service and the existing HTML/plain-text templates.

## Configure Brevo

1. Add and verify **ervodigital@gmail.com** as a sender in [Brevo's sender settings](https://app.brevo.com/senders). Messages use the display name **Loft**.
2. Create an **API key** in [Brevo's SMTP & API settings](https://app.brevo.com/settings/keys/api). An SMTP key does not authenticate API requests.
3. Set these variables in `server/.env` for local use, or in the **loft-server backend deployment's environment** for production:

```dotenv
MAIL_PROVIDER=brevo
BREVO_API_KEY=your-brevo-api-key
MAIL_FROM="Loft <ervodigital@gmail.com>"
MAIL_TEST_TO=ervodigital@gmail.com
CLIENT_URL=https://app.loft-client.site
```

Local development can use `CLIENT_URL=http://localhost:5173`. `server/.env.example` contains the email configuration template. The API resolves `server/.env` regardless of its working directory, and hosting environment variables take precedence over the file. Keep the API key in backend secrets; do not put it in frontend/Vite variables or commit it.

On Vercel, configure the variables for the **loft-server** project's Production environment and redeploy the server. Preview deployments need their own settings if they should send email. Changing a local file does not configure the deployed API. `CLIENT_URL` controls the destination of reset and invitation links.

Messages are sent over HTTPS to Brevo's [`POST /v3/smtp/email`](https://developers.brevo.com/docs/send-a-transactional-email) using the `api-key` header. Delivery calls have a 15-second timeout. The service requires a message ID before reporting provider acceptance. It does not retry or fall back to another provider after a failed or timed-out Brevo request.

`MAIL_PROVIDER=brevo` explicitly selects Brevo. When this variable is unset, a configured `BREVO_API_KEY` selects Brevo; otherwise the existing SMTP transport remains available. Unsupported provider names, a missing Brevo key or a missing/invalid `MAIL_FROM` make email unavailable rather than reporting successful sends.

## Sender and replies

All outgoing messages explicitly use the display name **Loft**. `MAIL_FROM` selects the sender address; an embedded display name does not override Loft. `MAIL_REPLY_TO` optionally selects a different reply address. Leave it unset to receive replies at the sender mailbox.

To switch to `support@loft-client.site`, add the sender in Brevo and [authenticate the domain](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC) using the DNS records Brevo provides, then update `MAIL_FROM`. Configure a mailbox or forwarding rule separately to receive replies. Preserve website and existing receiving/MX records when adding authentication records.

## Verify configuration and delivery

From the repository root:

```bash
npm run mail:check -w server
```

This is read-only. For Brevo, it authenticates against the account API, checks whether transactional email is disabled, and confirms `MAIL_FROM` matches an active sender. It does not send email or prove inbox delivery.

To deliberately send five labeled delivery tests to a mailbox you control:

```bash
npm run mail:check -w server -- --send --to ervodigital@gmail.com
```

Alternatively, set `MAIL_TEST_TO` and use `--send`. An explicit recipient is required: SMTP authentication usernames are not necessarily receiving mailboxes. Test messages cover welcome, reset, invite, sign-in code and password-change code. Their links/codes cannot modify an account or join a workspace. Provider acceptance is separate from inbox delivery; check the recipient's inbox/spam folder and [Brevo's transactional logs](https://app.brevo.com/transactional/logs).

Generate HTML and plain-text previews without sending email:

```bash
npm run mail:preview -w server
```

Open `server/.mail-previews/index.html` and select Desktop or Mobile. Generated previews contain sample data and are ignored by Git.

The local server checks email configuration on startup. Provider failures produce a `mail.delivery_failed` log containing the provider, error code and status code. Credentials, provider error messages, recipients and message bodies are omitted. Authentication/recovery endpoints report an error if sending fails. Registration reports a welcome-email warning if that message fails after verification mail succeeds. Invitation results distinguish successful sends from failures so admins can retry them.

## Existing SMTP deployments

The SMTP transport remains available when explicitly selected:

```dotenv
MAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-smtp-login
SMTP_PASS=your-brevo-smtp-key
MAIL_FROM="Loft <ervodigital@gmail.com>"
```

Brevo [SMTP authentication](https://developers.brevo.com/docs/smtp-integration) requires the SMTP login and SMTP key from its dashboard, rather than the API key. Port 587 uses STARTTLS; port 465 uses TLS. TLS certificates are checked. `mail:check` verifies the SMTP connection and authentication for this provider.

## Account verification

Apply the email challenge migrations and regenerate the Prisma client before running a backend that has not yet received them:

```bash
npm exec -w server -- prisma migrate deploy
npm run prisma:generate
```

The workspace command runs Prisma from `server`, where it loads `server/.env`.

Registration sends a verification challenge before granting access. Password and Google sign-in require an emailed code when the account has two-factor authentication enabled. The client calls `/api/auth/2fa/verify` to complete a challenge; `/api/auth/2fa/resend` sends a replacement after a 60-second cooldown. Codes expire in 10 minutes, allow five incorrect attempts, are consumed once, and are stored as keyed hashes. Repeating sign-in or resending does not reset an active challenge's attempt count or expiry. Password-change codes use a separate purpose and cannot grant sign-in access. Password resets invalidate pending challenges.

Flows requiring email fail when the selected email provider is unavailable. Existing sessions keep their current expiration. No development response or in-app notification exposes a verification code or password reset token.
