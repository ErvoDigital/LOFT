import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// Emailed invites and the admin-only invite code, exercised over HTTP against
// the real app with an in-memory stand-in for Prisma, so it needs no database
// (search.test.js is the suite that runs against a real one). The fake only
// answers the queries these routes make.

function createFakePrisma() {
  const db = {
    users: [],
    workspaces: [],
    members: [],
    invites: [],
    conversations: [],
    participants: [],
    notifications: [],
  };
  const lc = (s) => s.toLowerCase();
  const memberCount = (workspaceId) => db.members.filter((m) => m.workspaceId === workspaceId).length;
  const userOf = (id) => db.users.find((u) => u.id === id);
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, avatarColor: u.avatarColor, avatarUrl: null });

  function findMember(where) {
    if (where.id) return db.members.find((m) => m.id === where.id) ?? null;
    const { workspaceId, userId } = where.workspaceId_userId;
    return db.members.find((m) => m.workspaceId === workspaceId && m.userId === userId) ?? null;
  }

  function withInviteIncludes(invite) {
    if (!invite) return null;
    const workspace = db.workspaces.find((w) => w.id === invite.workspaceId);
    const by = userOf(invite.invitedById);
    return {
      ...invite,
      workspace: { ...workspace, _count: { members: memberCount(workspace.id) } },
      invitedBy: { id: by.id, name: by.name, avatarColor: by.avatarColor, avatarUrl: null },
    };
  }

  return {
    db,
    user: {
      findUnique: async ({ where }) => userOf(where.id) ?? null,
      findMany: async ({ where, select }) => {
        const wanted = where.email.in.map(lc);
        const workspaceId = select.memberships.where.workspaceId;
        return db.users
          .filter((u) => wanted.includes(lc(u.email)))
          .map((u) => ({
            id: u.id,
            email: u.email,
            memberships: db.members.filter((m) => m.userId === u.id && m.workspaceId === workspaceId),
          }));
      },
    },
    workspace: {
      update: async ({ where, data }) => Object.assign(db.workspaces.find((w) => w.id === where.id), data),
      findUnique: async ({ where }) => {
        const ws = db.workspaces.find(
          (w) => w.id === where.id || (where.inviteCode && w.inviteCode === where.inviteCode)
        );
        if (!ws) return null;
        const members = db.members
          .filter((m) => m.workspaceId === ws.id)
          .map((m) => ({ ...m, user: publicUser(userOf(m.userId)) }));
        return { ...ws, _count: { members: members.length }, members };
      },
    },
    workspaceMember: {
      findUnique: async ({ where }) => findMember(where),
      findMany: async ({ where }) => db.members.filter((m) => m.workspaceId === where.workspaceId),
      create: async ({ data }) => {
        const member = { id: crypto.randomUUID(), title: null, permissions: "", joinedAt: new Date(), ...data };
        db.members.push(member);
        return member;
      },
    },
    workspaceInvite: {
      findMany: async ({ where }) =>
        db.invites
          .filter((i) => i.workspaceId === where.workspaceId)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(withInviteIncludes),
      findUnique: async ({ where }) =>
        withInviteIncludes(db.invites.find((i) => (where.id ? i.id === where.id : i.token === where.token))),
      upsert: async ({ where, update, create }) => {
        const { workspaceId, email } = where.workspaceId_email;
        const existing = db.invites.find((i) => i.workspaceId === workspaceId && i.email === email);
        if (existing) return Object.assign(existing, update, { updatedAt: new Date() });
        const invite = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...create };
        db.invites.push(invite);
        return invite;
      },
      delete: async ({ where }) => {
        const index = db.invites.findIndex((i) => i.id === where.id);
        return db.invites.splice(index, 1)[0];
      },
      deleteMany: async ({ where }) => {
        const before = db.invites.length;
        db.invites = db.invites.filter((i) => !(i.workspaceId === where.workspaceId && i.email === where.email));
        return { count: before - db.invites.length };
      },
    },
    conversation: {
      findFirst: async ({ where }) =>
        db.conversations.find((c) => c.workspaceId === where.workspaceId && c.isDefault) ?? null,
    },
    conversationParticipant: {
      upsert: async ({ create }) => {
        db.participants.push(create);
        return create;
      },
    },
    notification: {
      create: async ({ data }) => {
        const notification = { id: crypto.randomUUID(), createdAt: new Date(), isRead: false, ...data };
        db.notifications.push(notification);
        return notification;
      },
    },
    realtimeEvent: { create: async () => ({}) },
  };
}

describe("Workspace invites (in-memory)", () => {
  let server;
  let baseUrl;
  let fake;
  let sentMail;
  let tokens;
  const savedEnv = {};
  const ENV_KEYS = ["JWT_SECRET", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CLIENT_URL"];

  before(async () => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    // jwt.js reads its secret at import time, so the app is imported after this.
    process.env.JWT_SECRET = "invite-test-secret";
    process.env.SMTP_HOST = "smtp.test";
    process.env.SMTP_USER = "loft@test";
    process.env.SMTP_PASS = "secret";
    process.env.CLIENT_URL = "https://loft.test/";

    const { createApp } = await import("../src/app.js");
    const { setPrismaClient } = await import("../src/db/prisma.js");
    const { setMailTransport } = await import("../src/services/mail.service.js");
    const { signToken } = await import("../src/utils/jwt.js");

    fake = createFakePrisma();
    fake.db.users.push(
      { id: "u-admin", name: "Ada Admin", email: "ada@loft.test", avatarColor: "#134A3C" },
      { id: "u-member", name: "Max Member", email: "max@loft.test", avatarColor: "#134A3C" },
      { id: "u-outsider", name: "Olu Outsider", email: "olu@loft.test", avatarColor: "#134A3C" },
      { id: "u-stranger", name: "Sam Stranger", email: "sam@loft.test", avatarColor: "#134A3C" }
    );
    fake.db.workspaces.push(
      { id: "ws-1", name: "Studio <b>One</b>", inviteCode: "ABCDEFG", ownerId: "u-admin", color: "#134A3C" },
      { id: "ws-2", name: "Other", inviteCode: "HJKLMNP", ownerId: "u-stranger", color: "#134A3C" }
    );
    fake.db.members.push(
      { id: "m-admin", workspaceId: "ws-1", userId: "u-admin", role: "ADMIN", permissions: "", joinedAt: new Date() },
      // Holding members.manage still isn't enough to invite or see the code.
      {
        id: "m-member",
        workspaceId: "ws-1",
        userId: "u-member",
        role: "MEMBER",
        permissions: "members.manage",
        joinedAt: new Date(),
      },
      { id: "m-other", workspaceId: "ws-2", userId: "u-stranger", role: "ADMIN", permissions: "", joinedAt: new Date() }
    );
    fake.db.conversations.push({ id: "c-general", workspaceId: "ws-1", isDefault: true });
    setPrismaClient(fake);

    sentMail = [];
    setMailTransport({ sendMail: async (message) => sentMail.push(message) });

    tokens = {
      admin: signToken({ sub: "u-admin" }),
      member: signToken({ sub: "u-member" }),
      outsider: signToken({ sub: "u-outsider" }),
      stranger: signToken({ sub: "u-stranger" }),
    };

    server = createApp().listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  async function call(method, path, { token, body } = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  }

  it("shows the invite code to admins only", async () => {
    const asAdmin = await call("GET", "/workspaces/ws-1", { token: tokens.admin });
    assert.equal(asAdmin.body.workspace.inviteCode, "ABCDEFG");

    const asMember = await call("GET", "/workspaces/ws-1", { token: tokens.member });
    assert.equal(asMember.status, 200);
    assert.equal(asMember.body.workspace.inviteCode, undefined);
  });

  it("keeps the invite routes to admins", async () => {
    const send = await call("POST", "/workspaces/ws-1/invites", {
      token: tokens.member,
      body: { emails: ["new@x.test"] },
    });
    assert.equal(send.status, 403);
    const list = await call("GET", "/workspaces/ws-1/invites", { token: tokens.member });
    assert.equal(list.status, 403);
    assert.equal(fake.db.invites.length, 0);
  });

  it("rejects malformed addresses", async () => {
    const res = await call("POST", "/workspaces/ws-1/invites", {
      token: tokens.admin,
      body: { emails: ["not-an-email"] },
    });
    assert.equal(res.status, 400);
  });

  it("emails new addresses, notifies existing accounts and skips members", async () => {
    const res = await call("POST", "/workspaces/ws-1/invites", {
      token: tokens.admin,
      body: { emails: [" New@X.test ", "new@x.test", "olu@loft.test", "MAX@loft.test"] },
    });
    assert.equal(res.status, 201);
    assert.deepEqual(
      res.body.results.map((r) => [r.email, r.status, r.emailed ?? null, r.notified ?? null]),
      [
        ["new@x.test", "invited", true, false],
        ["olu@loft.test", "invited", true, true],
        ["max@loft.test", "member", null, null],
      ]
    );
    assert.equal(res.body.invites.length, 2);
    assert.match(res.body.invites[0].link, /^https:\/\/loft\.test\/invite\/[\w-]{20,}$/);

    assert.equal(sentMail.length, 2);
    const toNew = sentMail.find((m) => m.to === "new@x.test");
    assert.equal(toNew.subject, "Ada Admin invited you to join Studio <b>One</b> on LOFT");
    assert.ok(toNew.html.includes("Studio &lt;b&gt;One&lt;/b&gt;"), "workspace name is escaped in the HTML");
    assert.ok(!toNew.html.includes("<b>One</b>"));

    const notice = fake.db.notifications.find((n) => n.userId === "u-outsider");
    assert.equal(notice.type, "WORKSPACE_INVITE");
    assert.match(notice.link, /^\/invite\//);
  });

  it("refreshes rather than duplicates a repeat invite, keeping its link", async () => {
    const before = fake.db.invites.find((i) => i.email === "new@x.test").token;
    const res = await call("POST", "/workspaces/ws-1/invites", {
      token: tokens.admin,
      body: { emails: ["new@x.test"] },
    });
    assert.equal(res.status, 201);
    assert.equal(fake.db.invites.filter((i) => i.email === "new@x.test").length, 1);
    assert.equal(fake.db.invites.find((i) => i.email === "new@x.test").token, before);
  });

  it("previews an invite without signing in", async () => {
    const invite = fake.db.invites.find((i) => i.email === "olu@loft.test");
    const res = await call("GET", `/invites/${invite.token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.invite.workspace.name, "Studio <b>One</b>");
    assert.equal(res.body.invite.invitedBy.name, "Ada Admin");
    assert.equal(res.body.invite.workspace.inviteCode, undefined);

    assert.equal((await call("GET", "/invites/does-not-exist-but-long-enough")).status, 404);
  });

  it("only lets the invited address accept", async () => {
    const invite = fake.db.invites.find((i) => i.email === "olu@loft.test");
    const wrong = await call("POST", `/invites/${invite.token}/accept`, { token: tokens.stranger });
    assert.equal(wrong.status, 403);
    assert.match(wrong.body.error, /olu@loft\.test/);
    assert.equal((await call("POST", `/invites/${invite.token}/accept`)).status, 401);
  });

  it("joins the workspace, clears the invite and tells the admins", async () => {
    const invite = fake.db.invites.find((i) => i.email === "olu@loft.test");
    const res = await call("POST", `/invites/${invite.token}/accept`, { token: tokens.outsider });
    assert.equal(res.status, 201);
    assert.equal(res.body.workspace.id, "ws-1");
    assert.equal(res.body.workspace.inviteCode, undefined);

    assert.ok(
      fake.db.members.some((m) => m.workspaceId === "ws-1" && m.userId === "u-outsider" && m.role === "MEMBER")
    );
    assert.ok(fake.db.participants.some((p) => p.conversationId === "c-general" && p.userId === "u-outsider"));
    assert.ok(!fake.db.invites.some((i) => i.id === invite.id));
    assert.ok(
      fake.db.notifications.some((n) => n.userId === "u-admin" && n.title === "Olu Outsider joined Studio <b>One</b>")
    );

    assert.equal((await call("POST", `/invites/${invite.token}/accept`, { token: tokens.outsider })).status, 404);
  });

  it("refuses an expired invite", async () => {
    const invite = fake.db.invites.find((i) => i.email === "new@x.test");
    invite.expiresAt = new Date(Date.now() - 1000);
    fake.db.users.push({ id: "u-new", name: "New Person", email: "new@x.test", avatarColor: "#134A3C" });
    const { signToken } = await import("../src/utils/jwt.js");

    const preview = await call("GET", `/invites/${invite.token}`);
    assert.equal(preview.body.invite.expired, true);
    const res = await call("POST", `/invites/${invite.token}/accept`, { token: signToken({ sub: "u-new" }) });
    assert.equal(res.status, 410);
  });

  it("withdraws invites only from their own workspace", async () => {
    const invite = fake.db.invites.find((i) => i.email === "new@x.test");
    const crossed = await call("DELETE", `/workspaces/ws-2/invites/${invite.id}`, { token: tokens.stranger });
    assert.equal(crossed.status, 404);
    const res = await call("DELETE", `/workspaces/ws-1/invites/${invite.id}`, { token: tokens.admin });
    assert.equal(res.status, 200);
    assert.equal(fake.db.invites.length, 0);
  });

  it("lets only admins replace the code, and retires the old one", async () => {
    assert.equal((await call("POST", "/workspaces/ws-1/invite-code", { token: tokens.member })).status, 403);

    const res = await call("POST", "/workspaces/ws-1/invite-code", { token: tokens.admin });
    assert.equal(res.status, 200);
    assert.match(res.body.inviteCode, /^[A-HJ-NP-Z2-9]{7}$/);
    assert.notEqual(res.body.inviteCode, "ABCDEFG");

    const oldCode = await call("POST", "/workspaces/join", { token: tokens.stranger, body: { inviteCode: "ABCDEFG" } });
    assert.equal(oldCode.status, 404);
  });

  it("reports email as off when SMTP isn't configured, and still creates the invite", async () => {
    delete process.env.SMTP_HOST;
    try {
      const sentBefore = sentMail.length;
      const res = await call("POST", "/workspaces/ws-1/invites", {
        token: tokens.admin,
        body: { emails: ["later@x.test"] },
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.emailEnabled, false);
      assert.equal(res.body.results[0].emailed, false);
      assert.equal(res.body.invites.length, 1);
      assert.equal(sentMail.length, sentBefore);
    } finally {
      process.env.SMTP_HOST = "smtp.test";
    }
  });
});
