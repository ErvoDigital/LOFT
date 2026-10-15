import { after, afterEach, before, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { closeMailTransport, isMailConfigured, mailProvider, sendMail, senderIdentity, setMailTransport, verifyMailConnection } from "../src/services/mail.service.js";
import { buildWelcomeEmail, buildPasswordResetEmail, buildVerificationEmail } from "../src/utils/emailTemplates.js";
import { buildInviteEmail } from "../src/utils/inviteEmail.js";
import { resetErrorSinkForTests, setErrorSinkForTests } from "../src/utils/logger.js";

const keys = ["MAIL_PROVIDER", "BREVO_API_KEY", "MAIL_FROM", "MAIL_REPLY_TO", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
const savedEnv = {};
let requests, logs;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const unavailable = (error) => error.statusCode === 503 && /could not be sent/.test(error.message);

before(() => {
  for (const key of keys) savedEnv[key] = process.env[key];
});
beforeEach(() => {
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    MAIL_PROVIDER: "brevo", BREVO_API_KEY: "test-api-secret",
    MAIL_FROM: "Old brand <sender@example.com>",
    // Stale SMTP credentials must never be used after a Brevo failure.
    SMTP_HOST: "smtp.test", SMTP_USER: "login@smtp-brevo.com", SMTP_PASS: "smtp-secret",
  });
  requests = [];
  logs = [];
  setErrorSinkForTests((entry) => logs.push(entry));
  mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, options });
    return response({ messageId: "<accepted@brevo.test>" }, 201);
  });
});
afterEach(() => {
  mock.restoreAll();
  setMailTransport(null);
  closeMailTransport();
  resetErrorSinkForTests();
});
after(() => {
  for (const key of keys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

test("Brevo requires its API key and an explicit sender, independently of SMTP", () => {
  assert.equal(isMailConfigured(), true);
  delete process.env.BREVO_API_KEY;
  assert.equal(isMailConfigured(), false);
  process.env.BREVO_API_KEY = "test-api-secret";
  delete process.env.MAIL_FROM;
  assert.equal(senderIdentity().from.address, "");
  assert.equal(isMailConfigured(), false);
  process.env.MAIL_FROM = "invalid-sender";
  assert.equal(isMailConfigured(), false);
});

test("provider selection prefers Brevo credentials unless explicitly set to SMTP", () => {
  delete process.env.MAIL_PROVIDER;
  assert.equal(mailProvider(), "brevo");
  process.env.MAIL_PROVIDER = " SMTP ";
  assert.equal(mailProvider(), "smtp");
  assert.equal(isMailConfigured(), true);
  delete process.env.MAIL_PROVIDER;
  delete process.env.BREVO_API_KEY;
  assert.equal(mailProvider(), "smtp");
  process.env.MAIL_PROVIDER = "misspelled-provider";
  assert.equal(isMailConfigured(), false);
});

test("missing configuration stops delivery before making a request", async () => {
  delete process.env.BREVO_API_KEY;
  await assert.rejects(sendMail({ to: "user@example.com", subject: "Test", text: "Test" }), (error) => error.statusCode === 503 && /email settings/.test(error.message));
  assert.equal(requests.length, 0);
});

test("all five email types retain SyncTayo identity, HTML, text and recipients through Brevo", async () => {
  process.env.MAIL_REPLY_TO = "Support <replies@example.com>";
  const sample = { name: "Ada", email: "user@example.com", link: "https://app.loft-client.site/" };
  const messages = [
    buildWelcomeEmail(sample),
    buildPasswordResetEmail(sample),
    buildInviteEmail({ ...sample, workspaceName: "Studio", inviterName: "Alex" }),
    buildVerificationEmail({ ...sample, code: "012345", purpose: "LOGIN" }),
    buildVerificationEmail({ ...sample, code: "012345", purpose: "PASSWORD_CHANGE" }),
  ];
  for (const message of messages) {
    assert.deepEqual(await sendMail({ to: sample.email, ...message }), {
      messageId: "<accepted@brevo.test>", accepted: [sample.email], rejected: [],
    });
  }
  assert.equal(requests.length, 5);
  requests.forEach(({ url, options }, index) => {
    assert.equal(url, "https://api.brevo.com/v3/smtp/email");
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["api-key"], "test-api-secret");
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body), {
      sender: { name: "SyncTayo", email: "sender@example.com" },
      to: [{ email: sample.email }], subject: messages[index].subject,
      htmlContent: messages[index].html, textContent: messages[index].text,
      replyTo: { name: "SyncTayo", email: "replies@example.com" },
    });
    assert.ok(!options.body.includes("test-api-secret"));
  });
});

test("reply-to is omitted unless configured and rotated keys take effect", async () => {
  process.env.BREVO_API_KEY = " rotated-secret ";
  await sendMail({ to: "user@example.com", subject: "Test", text: "Plain text" });
  const { options } = requests[0];
  assert.equal(options.headers["api-key"], "rotated-secret");
  assert.equal(JSON.parse(options.body).replyTo, undefined);
});

test("recipient arrays and named recipients are mapped to the Brevo contract", async () => {
  const result = await sendMail({ to: [" one@example.com ", { name: "Two", address: "two@example.com" }], subject: "Test", text: "Test" });
  assert.deepEqual(JSON.parse(requests[0].options.body).to, [{ email: "one@example.com" }, { email: "two@example.com", name: "Two" }]);
  assert.deepEqual(result.accepted, ["one@example.com", "two@example.com"]);
  for (const to of [[], "invalid", "one@example.com,two@example.com"]) {
    await assert.rejects(sendMail({ to, subject: "Test", text: "Test" }), unavailable);
  }
  assert.equal(requests.length, 1);
});

describe("Brevo rejects delivery safely", () => {
  for (const [status, code] of [[401, "unauthorized"], [400, "invalid_parameter"], [403, "permission_denied"], [402, "not_enough_credits"], [429, "rate_limit_exceeded"], [500, "unknown-secret-value"]]) {
    test(`HTTP ${status} is unavailable without SMTP fallback or retries`, async () => {
      let smtpSends = 0;
      setMailTransport({ sendMail: async () => { smtpSends++; return { accepted: ["user@example.com"] }; } });
      globalThis.fetch.mock.mockImplementation(async (...args) => {
        requests.push(args);
        return response({ code, message: "test-api-secret user@example.com private email content" }, status);
      });
      await assert.rejects(sendMail({ to: "user@example.com", subject: "Test", text: "private email content" }), unavailable);
      assert.equal(smtpSends, 0);
      assert.equal(requests.length, 1);
      assert.equal(logs[0].provider, "brevo");
      assert.equal(logs[0].responseCode, status);
      assert.equal(logs[0].code, status === 500 ? "EBREVO_API" : code);
      assert.ok(!JSON.stringify(logs).includes("test-api-secret"));
      assert.ok(!JSON.stringify(logs).includes("user@example.com"));
      assert.ok(!JSON.stringify(logs).includes("private email content"));
      assert.ok(!JSON.stringify(logs).includes("unknown-secret-value"));
    });
  }

  test("a success status without a message ID does not report acceptance", async () => {
    globalThis.fetch.mock.mockImplementation(async () => response({}));
    await assert.rejects(sendMail({ to: "user@example.com", subject: "Test", text: "Test" }), unavailable);
    assert.equal(logs[0].code, "EBREVO_RESPONSE");
  });

  test("non-JSON responses do not leak the response body", async () => {
    globalThis.fetch.mock.mockImplementation(async () => new Response("secret gateway response", { status: 502 }));
    await assert.rejects(sendMail({ to: "user@example.com", subject: "Test", text: "Test" }), unavailable);
    assert.equal(logs[0].responseCode, 502);
    assert.ok(!JSON.stringify(logs).includes("secret gateway response"));
  });

  for (const name of ["TypeError", "TimeoutError"]) {
    test(`${name} becomes a safe delivery error`, async () => {
      globalThis.fetch.mock.mockImplementation(async () => { throw Object.assign(new Error("test-api-secret"), { name }); });
      await assert.rejects(sendMail({ to: "user@example.com", subject: "Test", text: "Test" }), unavailable);
      assert.equal(logs[0].code, name === "TimeoutError" ? "ETIMEDOUT" : "EBREVO_NETWORK");
      assert.ok(!JSON.stringify(logs).includes("test-api-secret"));
    });
  }
});

test("read-only verification checks the account and active sender without sending", async () => {
  globalThis.fetch.mock.mockImplementation(async (url, options) => {
    requests.push({ url, options });
    return response(url.endsWith("/account") ? { relay: { enabled: true } } : { senders: [{ email: "SENDER@example.com", active: true }] });
  });
  assert.equal(await verifyMailConnection(), true);
  assert.deepEqual(requests.map(({ url }) => url), ["https://api.brevo.com/v3/account", "https://api.brevo.com/v3/senders?domain=example.com"]);
  assert.ok(requests.every(({ options }) => options.method === "GET" && options.body === undefined));
});

test("disabled transactional email fails verification before checking senders", async () => {
  globalThis.fetch.mock.mockImplementation(async (...args) => { requests.push(args); return response({ relay: { enabled: false } }); });
  await assert.rejects(verifyMailConnection(), (error) => error.statusCode === 503 && /disabled/.test(error.message));
  assert.equal(requests.length, 1);
});

test("unverified and missing senders fail configuration verification", async () => {
  for (const senders of [[], [{ email: "sender@example.com", active: false }], [{ email: "someone@example.com", active: true }]]) {
    globalThis.fetch.mock.mockImplementation(async (url) => response(url.endsWith("/account") ? { relay: { enabled: true } } : { senders }));
    await assert.rejects(verifyMailConnection(), (error) => error.statusCode === 503 && /not verified/.test(error.message));
  }
});

test("SMTP still rejects partial recipient failures", async () => {
  process.env.MAIL_PROVIDER = "smtp";
  setMailTransport({ sendMail: async () => ({ accepted: ["one@example.com"], rejected: ["two@example.com"] }) });
  await assert.rejects(sendMail({ to: ["one@example.com", "two@example.com"], subject: "Test", text: "Test" }), unavailable);
  assert.equal(logs[0].code, "ERECIPIENT");
  assert.equal(requests.length, 0);
});
