import { after, test } from "node:test";
import assert from "node:assert/strict";
import { clearPrismaClient, setPrismaClient } from "../src/db/prisma.js";
import { getMessages, listConversations } from "../src/controllers/messages.controller.js";
import { listWorkspaceConversations } from "../src/controllers/conversations.controller.js";

const rows = Array.from({ length: 260 }, (_, index) => ({
  id: `message-${String(index).padStart(3, "0")}`, conversationId: "chat", content: index === 0 ? "Old launch plan" : `Message ${index}`,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, Math.floor(index / 2))),
  sender: { id: "other", name: "Riley" }, attachment: null, reactions: [],
}));
rows.push({ ...rows[0], id: "private", conversationId: "another-chat", content: "Private launch plan" });
let permitted = true;
let messageReads = 0;
let conversationQuery;
let conversations = [];
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return value.every((branch) => matches(row, branch));
    if (key === "OR") return value.some((branch) => matches(row, branch));
    if (value instanceof Date) return row[key].getTime() === value.getTime();
    if (value && typeof value === "object") {
      if ("lt" in value) return row[key] < value.lt;
      if ("contains" in value) return row[key]?.toLowerCase().includes(value.contains.toLowerCase());
      return row[key] ? matches(row[key], value) : false;
    }
    return row[key] === value;
  });
}
const fake = {
  conversation: {
    findUnique: async () => ({ id: "chat" }),
    findMany: async (query) => { conversationQuery = query; return conversations; },
  },
  conversationParticipant: { findUnique: async () => permitted ? { userId: "self" } : null },
  message: { findMany: async ({ where, orderBy, take }) => {
    messageReads++;
    assert.deepEqual(orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
    assert.ok(take <= 101);
    return rows.filter((row) => matches(row, where)).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, take);
  } },
};
setPrismaClient(fake);
after(() => clearPrismaClient(fake));
async function page(query = {}) {
  let result;
  await getMessages({ userId: "self", params: { conversationId: "chat" }, query }, { json: (body) => { result = body; } });
  return result;
}

test("chat history starts at the latest message and paginates all 260 without gaps or duplicates", async () => {
  const all = [];
  let result = await page();
  assert.equal(result.messages.at(-1).id, "message-259");
  assert.equal(result.messages.length, 50);
  while (true) {
    all.unshift(...result.messages.map((message) => message.id));
    if (!result.hasMore) break;
    result = await page({ before: result.nextCursor });
  }
  assert.equal(all.length, 260);
  assert.equal(new Set(all).size, 260);
  assert.equal(all[0], "message-000");
  assert.equal(result.nextCursor, null);
});

test("chat search finds old history and stays within the authorized conversation", async () => {
  const result = await page({ q: "LAUNCH" });
  assert.deepEqual(result.messages.map((message) => message.id), ["message-000"]);
});

test("chat cursors survive deletion of their boundary message", async () => {
  const first = await page({ limit: "3" });
  const oldest = first.messages[0];
  const index = rows.findIndex((message) => message.id === oldest.id);
  const [removed] = rows.splice(index, 1);
  try {
    const second = await page({ before: first.nextCursor, limit: "3" });
    assert.equal(second.messages.at(-1).id, "message-256");
  } finally { rows.splice(index, 0, removed); }
});

test("nonparticipants cannot fetch or search message history", async () => {
  permitted = false;
  const reads = messageReads;
  try { await assert.rejects(page({ q: "launch" }), (error) => error.statusCode === 403); }
  finally { permitted = true; }
  assert.equal(messageReads, reads);
});

test("chat rejects invalid cursors and excessive page sizes", async () => {
  await assert.rejects(page({ before: "broken-cursor" }), (error) => error.statusCode === 400);
  await assert.rejects(page({ limit: "10000" }));
});

test("conversation lists fetch one preview per channel and preserve attachment previews", async () => {
  conversations = [{ id: "chat", title: "General", isGroup: true, isDefault: true, workspaceId: "workspace", workspace: { name: "Team", color: "#137a64" },
    participants: [{ userId: "self", user: { id: "self", name: "Alex" } }],
    messages: [{ ...rows[0], content: "", attachment: { id: "asset", name: "Plan.pdf", versions: [{ id: "version", originalName: "Plan.pdf", mimeType: "application/pdf", size: 100 }] } }],
  }];
  const reads = messageReads;
  let global, workspace;
  await listConversations({ userId: "self" }, { json: (body) => { global = body; } });
  assert.equal(conversationQuery.include.messages.take, 1);
  await listWorkspaceConversations({ userId: "self", params: { workspaceId: "workspace" } }, { json: (body) => { workspace = body; } });
  assert.equal(conversationQuery.include.messages.take, 1);
  assert.equal(messageReads, reads);
  assert.equal(global.conversations[0].lastMessage.attachment.name, "Plan.pdf");
  assert.equal(workspace.conversations[0].lastMessage.attachment.name, "Plan.pdf");
});
