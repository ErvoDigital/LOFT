import { after, test } from "node:test";
import assert from "node:assert/strict";
import { clearPrismaClient, setPrismaClient } from "../src/db/prisma.js";
import { listMyWorkspaces } from "../src/controllers/workspaces.controller.js";

const rows = [
  { id: "ws-admin", name: "Admin team", inviteCode: "ADMINCODE", members: [{ role: "ADMIN", permissions: "" }], _count: { members: 3 } },
  { id: "ws-member", name: "Member team", inviteCode: "PRIVATECODE", members: [{ role: "MEMBER", permissions: "tasks.status" }], _count: { members: 5 } },
];
let query;
const fake = { workspace: { findMany: async (input) => { query = input; return rows; } } };
setPrismaClient(fake);
after(() => clearPrismaClient(fake));

test("workspace lists preserve each membership's role and admin-only invite access", async () => {
  let result;
  await listMyWorkspaces({ userId: "u-existing" }, { json: (body) => { result = body; } });
  assert.equal(query.where.members.some.userId, "u-existing");
  assert.equal(query.include.members.where.userId, "u-existing");
  assert.deepEqual(result.workspaces.map((w) => w.myRole), ["ADMIN", "MEMBER"]);
  assert.equal(result.workspaces[0].inviteCode, "ADMINCODE");
  assert.equal(result.workspaces[1].inviteCode, undefined);
  assert.deepEqual(result.workspaces[1].myPermissions, ["tasks.status"]);
  assert.deepEqual(result.workspaces.map((w) => w.memberCount), [3, 5]);
});
