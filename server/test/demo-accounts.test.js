import test from "node:test";
import assert from "node:assert/strict";
import { buildDemoFixtures, seedDemoAccounts } from "../prisma/seed-demo-accounts.js";

test("Demo accounts form four isolated groups with two populated workspaces each", () => {
  const fixtures = buildDemoFixtures(new Date("2026-10-04T00:00:00Z"));
  assert.equal(fixtures.users.length, 32);
  assert.equal(fixtures.users.filter((p) => p.role === "ADMIN").length, 4);
  assert.equal(fixtures.users.filter((p) => p.role === "MEMBER").length, 28);
  assert.equal(new Set(fixtures.users.map((p) => p.email)).size, 32);
  assert.equal(fixtures.workspace.length, 8);
  assert.equal(fixtures.files.length, 24);
  for (const person of fixtures.users) {
    const memberships = fixtures.workspaceMember.filter((m) => m.userId === person.id);
    assert.equal(memberships.length, 2);
    for (const membership of memberships) {
      assert.equal(membership.role, person.role);
      const team = fixtures.workspaceMember.filter((m) => m.workspaceId === membership.workspaceId);
      assert.equal(team.length, 8);
      assert.equal(team.filter((m) => m.role === "ADMIN").length, 1);
      assert.ok(team.every((m) => fixtures.users.find((p) => p.id === m.userId).group === person.group));
      const tasks = fixtures.task.filter((t) => t.workspaceId === membership.workspaceId && t.assigneeId === person.id);
      assert.equal(tasks.length, 3);
      assert.ok(tasks.some((t) => !fixtures.taskStatus.find((s) => s.id === t.status).isDone));
      const channels = fixtures.conversation.filter((c) => c.workspaceId === membership.workspaceId);
      assert.equal(channels.length, 2);
      for (const channel of channels) {
        assert.ok(fixtures.conversationParticipant.some((p) => p.conversationId === channel.id && p.userId === person.id));
        assert.equal(fixtures.message.filter((m) => m.conversationId === channel.id).length, 8);
      }
      const files = fixtures.files.filter((f) => f.asset.workspaceId === membership.workspaceId);
      assert.equal(files.length, 3);
      for (const file of files) {
        assert.equal(file.version.size, Buffer.byteLength(file.content));
        assert.ok(file.content.length > 0);
      }
    }
  }
  const rerun = buildDemoFixtures(new Date("2026-10-05T00:00:00Z"));
  assert.deepEqual(fixtures.task.map((t) => t.id), rerun.task.map((t) => t.id));
  assert.deepEqual(fixtures.files.map((f) => f.version.storedName), rerun.files.map((f) => f.version.storedName));
});

test("Demo seeding refuses production and missing opt-in before touching the database", async () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalOptIn = process.env.ALLOW_DEV_SEED;
  try {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEV_SEED = "true";
    await assert.rejects(seedDemoAccounts(), /production/);
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_DEV_SEED;
    await assert.rejects(seedDemoAccounts(), /ALLOW_DEV_SEED/);
  } finally {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
    if (originalOptIn === undefined) delete process.env.ALLOW_DEV_SEED;
    else process.env.ALLOW_DEV_SEED = originalOptIn;
  }
});
