import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { runOpenClaw } from "../src/services/openclaw.service.js";

const config = { url: "http://gateway", token: "private-test-token" };
const args = { message: "Today?", history: [], instructions: "LOFT", tools: [], config };
const messageOutput = (text) => ({ id: "final", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] });
const encodeEvent = (event) => `event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`;
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("Gateway text arrives before completion, including split SSE frames and UTF-8", async () => {
  let source;
  const stream = new ReadableStream({ start(controller) { source = controller; } });
  const encoder = new TextEncoder();
  const firstDelta = deferred();
  const events = [];
  const result = runOpenClaw({
    ...args, executeTool: () => assert.fail("No tools in a text reply"),
    onProgress(event) { events.push(event); firstDelta.resolve(); },
    fetchImpl: async (url, init) => {
      assert.equal(JSON.parse(init.body).stream, true);
      return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
    },
  });
  for (const byte of encoder.encode(encodeEvent({ type: "response.output_text.delta", delta: "Hello 👋" }))) source.enqueue(Uint8Array.of(byte));
  await firstDelta.promise;
  assert.deepEqual(events, [{ type: "delta", text: "Hello 👋" }]);
  source.enqueue(encoder.encode(encodeEvent({ type: "response.completed", response: messageOutput("Hello 👋") })));
  source.close();
  assert.equal(await result, "Hello 👋");
});

test("Tool-round text resets and streamed calls execute only after a valid terminal response", async () => {
  const progress = [];
  let executions = 0;
  let round = 0;
  const result = await runOpenClaw({
    ...args, onProgress: (event) => progress.push(event),
    executeTool: async () => { executions++; return { tasks: [] }; },
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      if (round++ === 0) {
        assert.equal(executions, 0);
        return new Response(encodeEvent({ type: "response.output_text.delta", delta: "Checking." }) + encodeEvent({
          type: "response.completed", response: { id: "tool-round", output: [{ type: "function_call", name: "list_my_tasks", arguments: "{}" }] },
        }), { headers: { "Content-Type": "text/event-stream" } });
      }
      assert.equal(body.previous_response_id, "tool-round");
      assert.equal(executions, 1);
      return new Response(encodeEvent({ type: "response.output_text.delta", delta: "Done." }) + encodeEvent({ type: "response.completed", response: messageOutput("Done.") }), { headers: { "Content-Type": "text/event-stream" } });
    },
  });
  assert.equal(result, "Done.");
  assert.deepEqual(progress.map((event) => event.type), ["delta", "reset", "delta"]);
});

test("Failed, incomplete and interrupted streams never execute pending calls", async () => {
  for (const payload of [
    encodeEvent({ type: "response.output_item.added", item: { type: "function_call", name: "propose_task", arguments: "{}" } }),
    encodeEvent({ type: "response.failed", response: { error: { message: "private-provider-secret" } } }),
    encodeEvent({ type: "response.incomplete", response: { status: "incomplete" } }),
    "data: invalid-json\n\n",
  ]) {
    await assert.rejects(runOpenClaw({
      ...args, onProgress() {}, executeTool: () => assert.fail("Incomplete calls cannot execute"),
      fetchImpl: async () => new Response(payload, { headers: { "Content-Type": "text/event-stream" } }),
    }), (err) => err.statusCode === 502 && !err.message.includes("private-provider-secret"));
  }
});

test("Independent reads overlap while proposals and result order stay sequential", { timeout: 2000 }, async () => {
  const gate = deferred();
  const bothStarted = deferred();
  const started = [];
  const finished = [];
  const names = ["list_my_tasks", "list_upcoming_events", "propose_task", "list_workspaces", "propose_event"];
  let round = 0;
  const result = runOpenClaw({
    ...args,
    executeTool: async (name) => {
      started.push(name);
      if (name === names[0] || name === names[1]) {
        if (started.length === 2) bothStarted.resolve();
        await gate.promise;
      }
      if (name === "propose_task") assert.deepEqual(finished, names.slice(0, 2));
      if (name === "propose_event") assert.deepEqual(finished, names.slice(0, 4));
      finished.push(name);
      return { name };
    },
    fetchImpl: async (url, init) => {
      if (round++ === 0) return Response.json({ id: "tools", output: names.map((name) => ({ type: "function_call", name, arguments: "{}" })) });
      assert.equal(JSON.parse(init.body).input, names.map((name) => `\nTool ${name} result: ${JSON.stringify({ name })}`).join(""));
      return Response.json(messageOutput("Done."));
    },
  });
  await bothStarted.promise;
  assert.deepEqual(started, names.slice(0, 2));
  gate.resolve();
  assert.equal(await result, "Done.");
  assert.deepEqual(finished, names);
});

test("Canceled requests stop before gateway calls or tool continuations", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(runOpenClaw({ ...args, signal: controller.signal, fetchImpl: () => assert.fail("No request after cancellation") }));
  const midRequest = new AbortController();
  await assert.rejects(runOpenClaw({
    ...args, signal: midRequest.signal, executeTool: () => assert.fail("No tools after cancellation"),
    fetchImpl: async () => {
      midRequest.abort();
      return Response.json({ id: "tool-round", output: [{ type: "function_call", name: "list_my_tasks", arguments: "{}" }] });
    },
  }));
});

test("HTTP streaming retains authentication, membership checks and sanitized failures", async () => {
  process.env.JWT_SECRET = "stream-test-secret";
  process.env.OPENCLAW_GATEWAY_TOKEN = config.token;
  const { setPrismaClient, clearPrismaClient } = await import("../src/db/prisma.js");
  const { createApp } = await import("../src/app.js");
  const { signToken } = await import("../src/utils/jwt.js");
  const userId = "11111111-1111-4111-8111-111111111111";
  const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const db = { workspaceMember: { async findUnique({ where }) { return where.workspaceId_userId.workspaceId === workspaceId ? { role: "MEMBER" } : null; } } };
  setPrismaClient(db);
  const firstDelta = deferred();
  const finishReply = deferred();
  const canceledAtGateway = deferred();
  const gateway = http.createServer(async (req, res) => {
    assert.equal(req.headers.authorization, "Bearer " + config.token);
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    assert.equal(body.stream, true);
    res.setHeader("Content-Type", "text/event-stream");
    res.write(encodeEvent({ type: "response.output_text.delta", delta: "Early text." }));
    firstDelta.resolve();
    if (body.input.includes("Cancel")) {
      res.on("close", () => canceledAtGateway.resolve());
      return;
    }
    await finishReply.promise;
    const event = body.input.includes("Fail")
      ? { type: "response.failed", response: { error: { message: "private-provider-secret" } } }
      : { type: "response.completed", response: messageOutput("Completed reply.") };
    res.end(encodeEvent(event));
  });
  const app = http.createServer(createApp());
  await Promise.all([new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve)), new Promise((resolve) => app.listen(0, "127.0.0.1", resolve))]);
  const oldUrl = process.env.OPENCLAW_GATEWAY_URL;
  process.env.OPENCLAW_GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  const url = `http://127.0.0.1:${app.address().port}/api/assistant/message`;
  const headers = { "Content-Type": "application/json", Accept: "application/x-ndjson", Authorization: `Bearer ${signToken({ sub: userId })}` };
  try {
    assert.equal((await fetch(url, { method: "POST", headers: { Accept: headers.Accept, "Content-Type": "application/json" }, body: JSON.stringify({ message: "Hi" }) })).status, 401);
    assert.equal((await fetch(url, { method: "POST", headers, body: JSON.stringify({ message: "Hi", workspaceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }) })).status, 403);
    const pending = fetch(url, { method: "POST", headers, body: JSON.stringify({ message: "Hi", workspaceId }) });
    await firstDelta.promise;
    const response = await pending;
    assert.match(response.headers.get("content-type"), /application\/x-ndjson/);
    assert.equal(response.headers.get("x-accel-buffering"), "no");
    const reader = response.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    assert.deepEqual(JSON.parse(first), { type: "delta", text: "Early text." });
    finishReply.resolve();
    let remaining = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      remaining += new TextDecoder().decode(value);
    }
    const result = JSON.parse(remaining.trim());
    assert.equal(result.type, "result");
    assert.equal(result.reply, "Completed reply.");
    assert.deepEqual(result.actions, []);
    const failed = await fetch(url, { method: "POST", headers, body: JSON.stringify({ message: "Fail", workspaceId }) });
    const events = (await failed.text()).trim().split("\n").map(JSON.parse);
    assert.equal(events.at(-1).type, "error");
    assert.ok(!JSON.stringify(events).includes("private-provider-secret"));
    const canceled = await fetch(url, { method: "POST", headers, body: JSON.stringify({ message: "Cancel", workspaceId }) });
    await canceled.body.cancel();
    await canceledAtGateway.promise;
    const afterCancel = await fetch(url, { method: "POST", headers, body: JSON.stringify({ message: "Hi again", workspaceId }) });
    assert.equal(afterCancel.status, 200);
    assert.ok((await afterCancel.text()).includes('"type":"result"'));
  } finally {
    finishReply.resolve();
    app.closeAllConnections();
    gateway.closeAllConnections();
    await Promise.all([new Promise((resolve) => app.close(resolve)), new Promise((resolve) => gateway.close(resolve))]);
    if (oldUrl === undefined) delete process.env.OPENCLAW_GATEWAY_URL;
    else process.env.OPENCLAW_GATEWAY_URL = oldUrl;
    clearPrismaClient(db);
  }
});
