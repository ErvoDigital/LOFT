import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "userId_purpose") return row.userId === value.userId && row.purpose === value.purpose;
    if (value && typeof value === "object" && !(value instanceof Date)) {
      return Object.entries(value).every(([op, expected]) => {
        if (op === "gt") return row[key] > expected;
        if (op === "lte") return row[key] <= expected;
        if (op === "lt") return row[key] < expected;
        throw new Error(`Unsupported test operator: ${op}`);
      });
    }
    if (value instanceof Date) return row[key]?.getTime() === value.getTime();
    return row[key] === value;
  });
}

function apply(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value?.increment) row[key] += value.increment;
    else if (value?.decrement) row[key] -= value.decrement;
    else row[key] = value;
  }
}

function model(rows) {
  return {
    findUnique: async ({ where }) => structuredClone(rows.find((r) => matches(r, where)) || null),
    findFirst: async ({ where }) => structuredClone(rows.find((r) => matches(r, where)) || null),
    create: async ({ data }) => {
      if (data.purpose && rows.some((r) => r.userId === data.userId && r.purpose === data.purpose)) {
        throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
      }
      const row = { id: crypto.randomUUID(), ...data };
      rows.push(row);
      return structuredClone(row);
    },
    update: async ({ where, data }) => {
      const row = rows.find((r) => matches(r, where));
      assert.ok(row, "Updated record exists");
      apply(row, data);
      return structuredClone(row);
    },
    updateMany: async ({ where, data }) => {
      const selected = rows.filter((r) => matches(r, where));
      selected.forEach((r) => apply(r, data));
      return { count: selected.length };
    },
    deleteMany: async ({ where }) => {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i], where)) { rows.splice(i, 1); count++; }
      }
      return { count };
    },
  };
}

describe("Account email and verification over HTTP (in-memory)", () => {
  let server, baseUrl, users, challenges, sent, passwordHash, setTransport, authToken, googleVerify;
  let transportFailure;
  const savedEnv = {};
  const keys = ["JWT_SECRET", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "CLIENT_URL", "GOOGLE_CLIENT_ID", "NODE_ENV"];

  before(async () => {
    for (const key of keys) savedEnv[key] = process.env[key];
    Object.assign(process.env, {
      JWT_SECRET: "auth-email-test-secret", SMTP_HOST: "smtp.test", SMTP_PORT: "587",
      SMTP_USER: "sender@loft.test", SMTP_PASS: "test-password", MAIL_FROM: "LOFT <sender@loft.test>",
      CLIENT_URL: "https://loft.test/", GOOGLE_CLIENT_ID: "test-google-client", NODE_ENV: "development",
    });
    googleVerify = OAuth2Client.prototype.verifyIdToken;
    OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => ({
      getPayload: () => ({ sub: `google-${idToken}`, email: `${idToken}@loft.test`, email_verified: true, given_name: "Google", name: "Google User" }),
    });
    const { createApp } = await import("../src/app.js");
    const { setPrismaClient } = await import("../src/db/prisma.js");
    const { setMailTransport } = await import("../src/services/mail.service.js");
    const { hashPassword } = await import("../src/utils/password.js");
    const { signToken } = await import("../src/utils/jwt.js");
    users = [];
    challenges = [];
    setPrismaClient({ user: model(users), emailChallenge: model(challenges) });
    setTransport = setMailTransport;
    setTransport({ sendMail: async (message) => {
      if (transportFailure?.(message)) throw Object.assign(new Error("Simulated SMTP auth failure"), { code: "EAUTH", responseCode: 535 });
      sent.push(message);
      return { accepted: [message.to], rejected: [], messageId: `message-${sent.length}` };
    } });
    passwordHash = await hashPassword("correct-password");
    authToken = signToken({ sub: "u-existing" });
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  beforeEach(() => {
    users.length = 0;
    challenges.length = 0;
    sent = [];
    transportFailure = null;
    users.push({ id: "u-existing", name: "Ada <Admin>", firstName: "Ada", email: "ada@loft.test", passwordHash });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    setTransport(null);
    OAuth2Client.prototype.verifyIdToken = googleVerify;
    for (const key of keys) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  async function call(path, body, token) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }
  const login = () => call("/auth/login", { email: "ada@loft.test", password: "correct-password" });
  const codeIn = (message) => message.text.match(/^\d{6}$/m)?.[0];
  const verify = (response, code) => call("/auth/2fa/verify", { challengeId: response.body.challengeId, code });
  const latestCode = () => codeIn(sent.at(-1));
  const wrongCode = () => latestCode() === "999999" ? "888888" : "999999";

  it("registration emails welcome and verification without granting access first", async () => {
    const res = await call("/auth/register", { firstName: "New", lastName: "User", email: "new@loft.test", password: "correct-password" });
    assert.equal(res.status, 201);
    assert.equal(res.body.welcomeEmailSent, true);
    assert.equal(res.body.twoFactorRequired, true);
    assert.equal(res.body.token, undefined);
    assert.equal(res.body.user, undefined);
    assert.equal(res.body.code, undefined);
    assert.deepEqual(sent.map((m) => m.subject).sort(), ["Welcome to Loft", "Your Loft sign-in verification code"]);
    assert.ok(sent.every((m) => m.to === "new@loft.test"));
    const emailCode = codeIn(sent.find((m) => /sign-in/.test(m.subject)));
    assert.ok(emailCode);
    assert.notEqual(challenges[0].codeHash, emailCode);
    const verified = await verify(res, emailCode);
    assert.equal(verified.status, 200);
    assert.equal(verified.body.user.email, "new@loft.test");
    assert.ok(verified.body.token);
  });

  it("requires a correct single-use code for password sign-in", async () => {
    const res = await login();
    assert.equal(res.status, 200);
    assert.equal(res.body.token, undefined);
    assert.equal(sent.length, 1);
    assert.match(sent[0].html, /Ada &lt;Admin&gt;/);
    assert.equal((await call("/auth/me")).status, 401);
    assert.equal((await call("/auth/me", undefined, res.body.challengeId)).status, 401);
    assert.equal((await verify(res, wrongCode())).status, 400);
    const result = await verify(res, latestCode());
    assert.equal(result.status, 200);
    assert.equal(result.body.user.passwordHash, undefined);
    assert.equal((await call("/auth/me", undefined, result.body.token)).status, 200);
    assert.equal((await verify(res, latestCode())).status, 400);
  });

  it("rejects bad passwords without sending mail", async () => {
    assert.equal((await call("/auth/login", { email: "ada@loft.test", password: "wrong" })).status, 401);
    assert.equal(sent.length, 0);
    assert.equal(challenges.length, 0);
  });

  it("does not resend or reset attempt limits when sign-in is repeated", async () => {
    const res = await login();
    const again = await login();
    assert.equal(again.body.challengeId, res.body.challengeId);
    assert.equal(sent.length, 1);
    assert.equal((await call("/auth/2fa/resend", { challengeId: res.body.challengeId })).status, 429);
    for (let i = 0; i < 5; i++) assert.equal((await verify(res, wrongCode())).status, 400);
    assert.equal((await verify(res, latestCode())).status, 429);
    assert.equal((await login()).status, 429);
    assert.equal((await call("/auth/2fa/resend", { challengeId: res.body.challengeId })).status, 429);
  });

  it("resends after cooldown without extending expiry or resetting attempts", async () => {
    const res = await login();
    const oldCode = latestCode();
    await verify(res, wrongCode());
    const expiry = challenges[0].expiresAt.getTime();
    challenges[0].sentAt = new Date(Date.now() - 61000);
    const resent = await call("/auth/2fa/resend", { challengeId: res.body.challengeId });
    assert.equal(resent.status, 200);
    assert.equal(sent.length, 2);
    assert.equal(challenges[0].attempts, 1);
    assert.equal(challenges[0].expiresAt.getTime(), expiry);
    if (latestCode() !== oldCode) assert.equal((await verify(res, oldCode)).status, 400);
    assert.equal((await verify(res, latestCode())).status, 200);
  });

  it("rejects expired codes and starts a fresh challenge on a new sign-in", async () => {
    const res = await login();
    const oldCode = latestCode();
    challenges[0].expiresAt = new Date(Date.now() - 1000);
    assert.equal((await verify(res, oldCode)).status, 400);
    assert.equal((await call("/auth/2fa/resend", { challengeId: res.body.challengeId })).status, 400);
    const fresh = await login();
    assert.equal(fresh.status, 200);
    assert.notEqual(fresh.body.challengeId, res.body.challengeId);
    assert.equal(challenges[0].attempts, 0);
    assert.equal((await verify(fresh, latestCode())).status, 200);
  });

  it("consumes codes atomically under concurrent verification", async () => {
    const res = await login();
    const responses = await Promise.all([verify(res, latestCode()), verify(res, latestCode())]);
    assert.equal(responses.filter((r) => r.status === 200).length, 1);
    assert.equal(challenges.length, 0);
  });

  it("reports SMTP failure without granting access and allows a retry", async () => {
    transportFailure = () => true;
    const failed = await login();
    assert.equal(failed.status, 503);
    assert.equal(failed.body.token, undefined);
    assert.equal(challenges.length, 0);
    transportFailure = null;
    assert.equal((await login()).status, 200);
    assert.equal(sent.length, 1);
  });

  it("restores a prior code if resending fails, preserving attempt limits", async () => {
    const res = await login();
    const oldCode = latestCode();
    await verify(res, wrongCode());
    challenges[0].sentAt = new Date(Date.now() - 61000);
    const codeHash = challenges[0].codeHash;
    transportFailure = () => true;
    assert.equal((await call("/auth/2fa/resend", { challengeId: res.body.challengeId })).status, 503);
    assert.equal(challenges[0].codeHash, codeHash);
    assert.equal(challenges[0].attempts, 1);
    transportFailure = null;
    assert.equal((await verify(res, oldCode)).status, 200);
  });

  it("emails password-reset links without exposing the token in development", async () => {
    const result = await call("/auth/forgot-password", { email: "ada@loft.test" });
    assert.equal(result.status, 200);
    assert.equal(result.body.resetToken, undefined);
    assert.equal(sent[0].subject, "Reset your Loft password");
    const token = sent[0].text.match(/https:\/\/loft.test\/reset-password\?token=([a-f0-9]+)/)[1];
    assert.notEqual(users[0].resetToken, token);
    assert.equal((await call("/auth/reset-password", { token, password: "new-password" })).status, 200);
    assert.equal((await call("/auth/reset-password", { token, password: "other-password" })).status, 400);
  });

  it("reports reset-email failure and clears only the failed request's token", async () => {
    transportFailure = () => true;
    assert.equal((await call("/auth/forgot-password", { email: "ada@loft.test" })).status, 503);
    assert.equal(users[0].resetToken, null);
    assert.equal(users[0].resetTokenExpiry, null);
  });

  it("keeps unknown email recovery responses generic", async () => {
    const known = await call("/auth/forgot-password", { email: "ada@loft.test" });
    const unknown = await call("/auth/forgot-password", { email: "unknown@loft.test" });
    assert.deepEqual(unknown, known);
    assert.equal(sent.length, 1);
  });

  it("delivers password-change codes by email only and consumes them on change", async () => {
    const sentResponse = await call("/users/me/password-change/send-code", {}, authToken);
    assert.equal(sentResponse.status, 200);
    assert.equal(sentResponse.body.code, undefined);
    assert.equal(sent[0].subject, "Your Loft password change verification code");
    const code = latestCode();
    assert.equal((await call("/users/me/password-change/verify-code", { code }, authToken)).status, 200);
    assert.equal(challenges[0].attempts, 0);
    assert.equal((await call("/auth/2fa/verify", { challengeId: challenges[0].id, code })).status, 400);
    assert.equal((await call("/users/me/change-password", { code, newPassword: "changed-password" }, authToken)).status, 200);
    assert.equal((await call("/users/me/change-password", { code, newPassword: "changed-again" }, authToken)).status, 400);
  });

  it("does not accept a login code as a password-change code", async () => {
    await login();
    assert.equal((await call("/users/me/change-password", { code: latestCode(), newPassword: "changed-password" }, authToken)).status, 400);
  });

  it("password resets invalidate pending sign-in and password-change challenges", async () => {
    const pending = await login();
    const signInCode = latestCode();
    await call("/users/me/password-change/send-code", {}, authToken);
    await call("/auth/forgot-password", { email: "ada@loft.test" });
    const token = sent.at(-1).text.match(/token=([a-f0-9]+)/)[1];
    assert.equal((await call("/auth/reset-password", { token, password: "recovered-password" })).status, 200);
    assert.equal(challenges.length, 0);
    assert.equal((await verify(pending, signInCode)).status, 400);
  });

  it("Google registration emails welcome and still requires verification", async () => {
    const result = await call("/auth/google", { credential: "new-google" });
    assert.equal(result.status, 200);
    assert.equal(result.body.twoFactorRequired, true);
    assert.equal(result.body.token, undefined);
    assert.equal(result.body.welcomeEmailSent, true);
    const code = codeIn(sent.find((m) => /sign-in/.test(m.subject)));
    assert.equal((await verify(result, code)).status, 200);
  });

  it("existing Google accounts receive a verification email, without another welcome", async () => {
    users[0].googleId = "google-ada";
    const result = await call("/auth/google", { credential: "ada" });
    assert.equal(result.body.twoFactorRequired, true);
    assert.equal(result.body.token, undefined);
    assert.equal(sent.length, 1);
    assert.equal((await verify(result, latestCode())).status, 200);
  });

  it("surfaces a welcome-email failure after signup without losing the verification challenge", async () => {
    transportFailure = (m) => m.subject === "Welcome to Loft";
    const result = await call("/auth/register", { firstName: "New", email: "new@loft.test", password: "correct-password" });
    assert.equal(result.status, 201);
    assert.equal(result.body.welcomeEmailSent, false);
    assert.match(result.body.emailWarning, /could not be sent/);
    assert.equal((await verify(result, latestCode())).status, 200);
  });

  it("missing SMTP fails closed and never reveals codes or reset tokens", async () => {
    const host = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    try {
      for (const [path, body, token] of [
        ["/auth/login", { email: "ada@loft.test", password: "correct-password" }],
        ["/auth/forgot-password", { email: "ada@loft.test" }],
        ["/auth/register", { firstName: "New", email: "new@loft.test", password: "correct-password" }],
        ["/users/me/password-change/send-code", {}, authToken],
      ]) {
        const result = await call(path, body, token);
        assert.equal(result.status, 503);
        assert.equal(result.body.code, undefined);
        assert.equal(result.body.resetToken, undefined);
        assert.equal(result.body.token, undefined);
      }
      assert.equal(users.length, 1);
      assert.equal(challenges.length, 0);
    } finally {
      process.env.SMTP_HOST = host;
    }
  });
});
