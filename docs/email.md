# Email setup

LOFT uses the same SMTP transport for welcome emails (including new Google accounts), password resets, workspace invitations, sign-in verification and password-change verification.

Local API entry points load `server/.env` using its absolute location. Hosting platforms need these variables in the **backend deployment's environment**; a local `.env` file does not configure a deployed API.

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-sender@gmail.com
SMTP_PASS=your-google-app-password
MAIL_FROM="Loft <your-sender@gmail.com>"
CLIENT_URL=http://localhost:5173
```

For Gmail, use an [app password](https://support.google.com/accounts/answer/185833) with Google 2-Step Verification enabled. Spaces in Google's displayed app password are normalized by the transport. Use port 587 for STARTTLS or 465 for TLS. TLS certificates are checked. Set `CLIENT_URL` to the actual web application URL on your deployment, so reset and invitation links reach the right site. Restart the API after changing `.env` and redeploy after changing hosted environment variables.

## Sender name and custom-domain address

All outgoing messages explicitly use the display name **Loft**. `MAIL_FROM` selects the sender email address; an old display name embedded in it does not override the Loft name. The five email types share one responsive, table-based HTML layout, with a wordmark, inbox preview text, readable content, relevant action buttons or verification-code blocks, expiry/security notes, a help footer, and a matching plain-text alternative.

The current Gmail setup uses `MAIL_FROM="Loft <ervodigital@gmail.com>"`. Gmail can [rewrite an unverified From address](https://nodemailer.com/guides/using-gmail), so setting `MAIL_FROM="Loft <support@loft-client.site>"` alone does not reliably hide the Gmail address. [Verified Gmail/Workspace aliases](https://support.google.com/mail/answer/22370?hl=en) or a mail provider verified for your domain can send using the custom address. Some mail clients may still show the original Gmail account for aliases. Google also documents that third-party Gmail Send As support ends in January 2027; Workspace aliases are unaffected.

To use `support@loft-client.site` as the actual sender, verify `loft-client.site` with the selected email provider, add its required SPF/DKIM records (and configure DMARC), then use that provider's SMTP credentials with:

```dotenv
MAIL_FROM="Loft <support@loft-client.site>"
MAIL_REPLY_TO=support@loft-client.site
```

Keep `SMTP_USER` as the provider's authentication username, which may differ from `MAIL_FROM`. Custom-domain receiving is separate: configure a support mailbox or forwarding rule so replies are delivered. DNS currently points this domain to Namecheap forwarding servers; forwarding alone does not authorize Gmail to send from the domain. Preserve website DNS and existing forwarding/MX records when adding provider verification records unless the chosen receiving provider explicitly requires changes.

`MAIL_REPLY_TO` is optional. It changes the reply destination without changing the sender displayed in the inbox; only set it after that destination receives mail. Leaving it unset sends replies to the current sender.

## Verify delivery

Generate an HTML gallery and plain-text previews for all five email formats:

```bash
npm run mail:preview -w server
```

Open `server/.mail-previews/index.html` and select Desktop or Mobile. These files contain sample data, are ignored by Git, and do not send emails.

From the repository root:

```bash
npm run mail:check -w server
npm run mail:check -w server -- --send
```

The first command checks the SMTP connection, TLS and credentials without sending anything. The second sends five clearly labeled test messages to `SMTP_USER`: welcome, reset, invite, sign-in code and password-change code. Their links/codes cannot modify an account or join a workspace. The command succeeds only when SMTP accepts every recipient. SMTP acceptance is separate from inbox placement; check the receiving inbox and spam folder.

The local server also checks SMTP on startup. Send failures produce a `mail.delivery_failed` log with a provider error code, command and status code; credentials and message bodies are omitted. Authentication/recovery endpoints report an error if sending fails. Registration reports a welcome-email warning if that message fails after verification mail succeeds. Invitation results distinguish `emailed: true` from failed sends, so admins can retry them.

## Account verification

Apply the `20261006160000_add_email_challenges` migration and regenerate the Prisma client before running the updated backend:

```bash
npm exec -w server -- prisma migrate deploy
npm run prisma:generate
```

The workspace command runs Prisma from `server`, where it loads `server/.env`.

Registration, password sign-in and Google sign-in return a challenge, without a session token. The client asks for the emailed six-digit code and calls `/api/auth/2fa/verify`; only successful verification creates a session. `/api/auth/2fa/resend` sends a replacement after a 60-second cooldown. Codes expire in 10 minutes, allow five incorrect attempts, are consumed once, and are stored as keyed hashes in the database. Resending or repeating sign-in does not reset an active challenge's attempt count or expiry. Password-change codes use a separate purpose and cannot grant sign-in access. Password resets invalidate pending verification challenges.

If SMTP is missing or unavailable, new account access fails until mail is restored. Existing sessions keep their current expiration. No development response or in-app notification exposes a verification code or password reset token.
