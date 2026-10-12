import test from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { SocketYjsProvider, toBase64 } from "../src/lib/yjsSocketProvider.js";

function socketMock(server, connected = true) {
  const handlers = new Map();
  return {
    connected, sent: [],
    on(event, fn) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(fn); },
    off(event, fn) { handlers.get(event)?.delete(fn); },
    fire(event, payload) { for (const fn of Array.from(handlers.get(event) || [])) fn(payload); },
    emit(event, data, ack) {
      this.sent.push({ event, data });
      if (!this.connected) { ack?.({ error: "Disconnected" }); return; }
      if (event === "document:join") ack?.({ update: toBase64(Y.encodeStateAsUpdate(server)), peers: [] });
      if (event === "document:update") Y.applyUpdate(server, new Uint8Array(Buffer.from(data.update, "base64")));
    },
    listenerCount(event) { return handlers.get(event)?.size || 0; },
  };
}

function session(t, connected = true) {
  const server = new Y.Doc();
  const local = new Y.Doc();
  const socket = socketMock(server, connected);
  const provider = new SocketYjsProvider(socket, "document", local, { id: "self", name: "Alex", avatarColor: "#137a64" });
  t.after(() => { provider.destroy(); local.destroy(); server.destroy(); });
  return { server, local, socket, provider };
}

test("opening a document waits for the initial live connection instead of failing immediately", async (t) => {
  const { provider, socket, server, local } = session(t, false);
  server.getMap("pageLayout").set("size", "a4");
  const opening = provider.connect();
  assert.equal(socket.sent.filter((s) => s.event === "document:join").length, 0);
  socket.connected = true;
  socket.fire("connect");
  await opening;
  assert.equal(socket.sent.filter((s) => s.event === "document:join").length, 1);
  assert.equal(local.getMap("pageLayout").get("size"), "a4");
});

test("reconnecting merges remote changes and sends edits made offline back to the server", async (t) => {
  const { provider, socket, server, local } = session(t);
  await provider.connect();
  socket.connected = false;
  local.getMap("pageLayout").set("size", "a4");
  local.getText("notes").insert(0, "Local edits");
  server.getMap("pageLayout").set("orientation", "landscape");
  socket.connected = true;
  socket.fire("connect");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(server.getText("notes").toString(), "Local edits");
  assert.deepEqual(server.getMap("pageLayout").toJSON(), { orientation: "landscape", size: "a4" });
  assert.deepEqual(local.getMap("pageLayout").toJSON(), server.getMap("pageLayout").toJSON());
});

test("closing while waiting for a connection cancels the join and removes its listeners", async (t) => {
  const { provider, socket } = session(t, false);
  const opening = provider.connect();
  const rejected = assert.rejects(opening, /Document closed/);
  provider.destroy();
  await rejected;
  assert.equal(socket.listenerCount("connect"), 0);
  socket.connected = true;
  socket.fire("connect");
  assert.equal(socket.sent.filter((s) => s.event === "document:join").length, 0);
});
