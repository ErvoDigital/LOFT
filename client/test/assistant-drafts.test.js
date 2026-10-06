import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/components/calendar/EventModal.jsx", import.meta.url))],
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"],
  plugins: [{ name: "draft-dependencies", setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
      if (kind === "entry-point" || path === "react" || path === "react/jsx-runtime") return;
      return { path, namespace: "mock" };
    });
    builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: `module.exports = globalThis.mocks[${JSON.stringify(path)}];`, loader: "js" }));
  } }],
});
const members = [{ user: { id: "owner", name: "Owner" } }, { user: { id: "partner", name: "Partner" } }];

async function mount(t, draft) {
  const calls = [];
  const saved = [];
  const deleted = [];
  let closed = 0;
  const api = Object.fromEntries(["updateEventDraft", "scheduleEventDraft", "deleteEventDraft", "createEvent", "updateEvent", "cancelEvent"].map((name) => [name, async (...args) => { calls.push({ name, args }); return { id: "saved" }; }]));
  const exported = { exports: {} };
  vm.runInNewContext(bundled.outputFiles[0].text, {
    module: exported, require: createRequire(import.meta.url),
    mocks: {
      "lucide-react": { CalendarX: () => null },
      "../common/Modal.jsx": ({ children }) => React.createElement("section", null, children),
      "../../context/ConfirmContext.jsx": { useConfirm: () => async () => true },
      "../../api/events.js": api,
      "../../api/client.js": { apiErrorMessage: (e) => e.message },
      "../common/DatePicker.jsx": { DateTimePicker: ({ onChange, ...props }) => React.createElement("input", { ...props, type: "datetime-local", onChange: (e) => onChange(e.target.value) }) },
    },
  });
  let view;
  await act(async () => { view = create(React.createElement(exported.exports.default, { open: true, draft, workspaceId: "workspace", members, onSaved: (value) => saved.push(value), onDeleted: (id) => deleted.push(id), onClose: () => closed++ })); });
  t.after(() => act(() => view.unmount()));
  const click = async (label) => { await act(async () => view.root.findAllByType("button").find((b) => b.children.includes(label)).props.onClick()); };
  const changeDate = async (id, value) => { await act(async () => view.root.findAllByType("input").find((input) => input.props.id === id).props.onChange({ target: { value } })); };
  const submit = async () => { await act(async () => view.root.findByType("form").props.onSubmit({ preventDefault() {} })); };
  return { view, calls, saved, deleted, click, changeDate, submit, get closed() { return closed; } };
}

test("Saving a meeting draft keeps absent dates and attendees empty instead of choosing defaults", async (t) => {
  const modal = await mount(t, { id: "draft", title: "Planning", description: "Agenda later", location: "Room A", attendeeIds: [] });
  const dates = modal.view.root.findAllByType("input").filter((i) => i.props.type === "datetime-local");
  assert.ok(dates.every((i) => i.props.value === "" && i.props.required === false));
  await modal.submit();
  assert.deepEqual(modal.calls.map((c) => c.name), ["updateEventDraft"]);
  const data = modal.calls[0].args[2];
  assert.equal(data.startTime, null);
  assert.equal(data.endTime, null);
  assert.deepEqual(Array.from(data.attendeeIds), []);
  assert.equal(data.description, "Agenda later");
  assert.equal(data.location, "Room A");
  assert.equal(modal.closed, 1);
});

test("Draft scheduling requires details and uses a separate explicit action", async (t) => {
  const modal = await mount(t, { id: "draft", title: "Planning", attendeeIds: [] });
  await modal.click("Schedule meeting");
  assert.equal(modal.calls.length, 0);
  assert.match(JSON.stringify(modal.view.toJSON()), /at least one attendee/);
  await modal.changeDate("event-starts", "2026-10-09T10:00");
  await modal.changeDate("event-ends", "2026-10-09T11:00");
  await modal.click("Partner");
  await modal.click("Schedule meeting");
  assert.deepEqual(modal.calls.map((c) => c.name), ["scheduleEventDraft"]);
  assert.deepEqual(Array.from(modal.calls[0].args[2].attendeeIds), ["partner"]);
  assert.equal(modal.saved.length, 1);
});

test("Supplied draft times and selected attendees survive saving; drafts can be discarded", async (t) => {
  const startTime = "2026-10-09T02:00:00.000Z";
  const modal = await mount(t, { id: "draft", title: "Planning", startTime, attendeeIds: ["partner"] });
  await modal.submit();
  assert.equal(modal.calls[0].args[2].startTime, startTime);
  assert.equal(modal.calls[0].args[2].endTime, null);
  assert.deepEqual(Array.from(modal.calls[0].args[2].attendeeIds), ["partner"]);
  await modal.click("Discard draft");
  assert.equal(modal.calls[1].name, "deleteEventDraft");
  assert.deepEqual(modal.deleted, ["draft"]);
});
