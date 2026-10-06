import test from "node:test";
import assert from "node:assert/strict";
import { SocketLike } from "../src/lib/socketShim.js";

function setup(t, { timeout = 100 } = {}) {
  const sockets = [];
  class FakeWebSocket {
    static OPEN = 1;
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; this.onclose?.(); }
    open() { this.readyState = 1; this.onopen(); }
    receive(data) { this.onmessage({ data: JSON.stringify(data) }); }
  }
  for (const [name, value] of Object.entries({ WebSocket: FakeWebSocket, location: { href: "https://www.loft-client.site/chat" } })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
  const client = new SocketLike("/", "test token", { ackTimeoutMs: timeout });
  t.after(() => client.disconnect());
  return { client, sockets, ws: sockets[0] };
}

test("relative realtime URLs resolve to the site's secure WebSocket endpoint", (t) => {
  const { ws } = setup(t);
  assert.equal(ws.url, "wss://www.loft-client.site/ws?token=test+token");
});

test("disconnected requests report failure instead of silently disappearing", (t) => {
  const { client, ws } = setup(t);
  let response;
  client.emit("message:send", {}, (data) => { response = data; });
  assert.match(response.error, /unavailable/);
  assert.equal(ws.sent.length, 0);
});

test("an unacknowledged meeting request times out exactly once", async (t) => {
  const { client, ws } = setup(t, { timeout: 5 });
  ws.open();
  const responses = [];
  const result = await new Promise((resolve) => {
    client.emit("meeting:join", "workspace", (data) => { responses.push(data); resolve(data); });
  });
  assert.match(result.error, /No response/);
  ws.receive({ ackId: ws.sent[0].id, data: { peers: [] } });
  assert.equal(responses.length, 1);
  assert.equal(client._pendingAcks.size, 0);
});

test("successful acknowledgements are delivered once and cancel the timeout", async (t) => {
  const { client, ws } = setup(t, { timeout: 5 });
  ws.open();
  const responses = [];
  client.emit("meeting:join", "workspace", (data) => responses.push(data));
  const ack = { ackId: ws.sent[0].id, data: { peers: [] } };
  ws.receive(ack);
  ws.receive(ack);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(responses, [{ peers: [] }]);
});

test("connection loss fails pending requests and reconnect emits connect again", (t) => {
  const { client, ws, sockets } = setup(t);
  let connected = 0;
  client.on("connect", () => connected++);
  ws.open();
  let response;
  client.emit("message:send", {}, (data) => { response = data; });
  ws.close();
  assert.match(response.error, /Connection lost/);
  assert.equal(client.connected, false);
  clearTimeout(client._reconnectTimer);
  client._open();
  sockets[1].open();
  assert.equal(connected, 2);
  assert.equal(client._pendingAcks.size, 0);
});

test("send errors complete pending requests immediately", (t) => {
  const { client, ws } = setup(t);
  ws.open();
  ws.send = () => { throw new Error("closed"); };
  let response;
  client.emit("message:send", {}, (data) => { response = data; });
  assert.match(response.error, /Couldn't send/);
  assert.equal(client._pendingAcks.size, 0);
});
