import "../src/config/env.js";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { clientUrl } from "../src/services/mail.service.js";
import { buildWelcomeEmail, buildPasswordResetEmail, buildVerificationEmail } from "../src/utils/emailTemplates.js";
import { buildInviteEmail } from "../src/utils/inviteEmail.js";
import { escapeHtml } from "../src/utils/emailLayout.js";

const directory = fileURLToPath(new URL("../.mail-previews/", import.meta.url));
const sample = { name: "Alex Morgan", email: "preview@example.com" };
const emails = [
  ["welcome", buildWelcomeEmail(sample)],
  ["password-reset", buildPasswordResetEmail({ ...sample, link: clientUrl("/reset-password?token=preview-only") })],
  ["workspace-invite", buildInviteEmail({ workspaceName: "Design Studio", inviterName: "Jordan Lee", email: sample.email, link: clientUrl("/invite/preview-only") })],
  ["sign-in-code", buildVerificationEmail({ ...sample, code: "012345", purpose: "LOGIN" })],
  ["password-change-code", buildVerificationEmail({ ...sample, code: "012345", purpose: "PASSWORD_CHANGE" })],
];
await mkdir(directory, { recursive: true });
for (const [key, email] of emails) {
  await writeFile(new URL(`../.mail-previews/${key}.html`, import.meta.url), email.html);
  await writeFile(new URL(`../.mail-previews/${key}.txt`, import.meta.url), `${email.subject}\n\n${email.text}`);
}
await writeFile(new URL("../.mail-previews/index.html", import.meta.url), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Loft email previews</title>
<style>body{margin:0;background:#eef3f0;font:14px Arial,sans-serif;color:#134a3c}header{padding:24px;background:white;border-bottom:1px solid #dce5e2}h1{margin:0 0 8px;font-size:24px}p{margin:8px 0}nav{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}a,button{padding:8px 12px;border:1px solid #dce5e2;border-radius:8px;color:#134a3c;background:white;text-decoration:none;cursor:pointer}main{padding:16px;overflow:auto}iframe{display:block;width:760px;max-width:100%;height:1050px;margin:auto;border:0;background:#f4f7f6;border-radius:12px}</style></head>
<body><header><h1>Loft email previews</h1><p>Sample content only. No emails are sent and codes/links do not authorize account actions.</p>
<nav>${emails.map(([key, email]) => `<a href="${key}.html" target="preview">${escapeHtml(email.subject)}</a>`).join("")}</nav>
<button onclick="document.querySelector('iframe').style.width='760px'">Desktop</button> <button onclick="document.querySelector('iframe').style.width='375px'">Mobile</button>
<p>For inbox display, messages use the sender name Loft. The current SMTP sender address remains ervodigital@gmail.com.</p></header>
<main><iframe name="preview" title="Email template preview" src="welcome.html"></iframe></main></body></html>`);
console.log(`Email previews generated: ${directory}index.html`);
