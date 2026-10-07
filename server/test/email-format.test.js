import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { buildWelcomeEmail, buildPasswordResetEmail, buildVerificationEmail } from "../src/utils/emailTemplates.js";
import { buildInviteEmail } from "../src/utils/inviteEmail.js";
import { sendMail, setMailTransport } from "../src/services/mail.service.js";

const savedEnv = {};
const keys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "MAIL_REPLY_TO", "CLIENT_URL"];
before(() => {
  for (const key of keys) savedEnv[key] = process.env[key];
  Object.assign(process.env, {
    SMTP_HOST: "smtp.test", SMTP_USER: "sender@example.com", SMTP_PASS: "test-secret",
    MAIL_FROM: "Ervo Digital <sender@example.com>", MAIL_REPLY_TO: "support@loft-client.site",
    CLIENT_URL: "https://www.loft-client.site",
  });
});
after(() => {
  setMailTransport(null);
  for (const key of keys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function messages(name = "Ada", link = "https://www.loft-client.site/?a=1&b=2") {
  const email = "recipient@example.com";
  return [
    buildWelcomeEmail({ name, email, link }),
    buildPasswordResetEmail({ name, email, link }),
    buildInviteEmail({ workspaceName: name, inviterName: name, email, link }),
    buildVerificationEmail({ name, email, code: "012345", purpose: "LOGIN" }),
    buildVerificationEmail({ name, email, code: "012345", purpose: "PASSWORD_CHANGE" }),
  ];
}

test("all five email types serialize Loft sender identity and real HTML/text MIME alternatives", async () => {
  const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const captured = [];
  setMailTransport({ sendMail: async (options) => {
    const result = await stream.sendMail(options);
    captured.push(result.message.toString("utf8"));
    return { ...result, accepted: [options.to], rejected: [] };
  } });
  for (const message of messages()) await sendMail({ to: "recipient@example.com", ...message });
  assert.equal(captured.length, 5);
  for (const mime of captured) {
    assert.match(mime, /^From: Loft <sender@example\.com>$/m);
    assert.match(mime, /^Reply-To: Loft <support@loft-client\.site>$/m);
    assert.match(mime, /Content-Type: multipart\/alternative/);
    assert.match(mime, /Content-Type: text\/plain; charset=utf-8/);
    assert.match(mime, /Content-Type: text\/html; charset=utf-8/);
    assert.ok(!mime.includes("Ervo Digital"));
  }
});

test("user-controlled names cannot inject markup in any template", () => {
  const unsafe = '<img src=x onerror="alert(1)"> & O\'Brien';
  for (const { html, text } of messages(unsafe)) {
    assert.ok(!html.includes("<img"));
    assert.ok(html.includes("&lt;img"));
    assert.ok(html.includes("&amp;"));
    assert.ok(text.includes(unsafe));
  }
  for (const { html } of messages().slice(0, 3)) {
    assert.ok(html.includes('href="https://www.loft-client.site/?a=1&amp;b=2"'));
  }
});

test("action emails reject executable links and verification emails reject invalid credentials", () => {
  for (const link of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
    assert.throws(() => messages("Ada", link), /HTTP or HTTPS/);
  }
  const params = { name: "Ada", email: "recipient@example.com", code: "012345", purpose: "LOGIN" };
  assert.throws(() => buildVerificationEmail({ ...params, code: "<b>code</b>" }), /six-digit/);
  assert.throws(() => buildVerificationEmail({ ...params, purpose: "RESET" }), /Unknown/);
});
