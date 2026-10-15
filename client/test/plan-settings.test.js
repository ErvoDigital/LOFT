import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/components/profile/PlanSettings.jsx", import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"], plugins: [{ name: "settings-dependencies", setup(builder) {
  builder.onResolve({ filter: /.*/ }, ({ path, kind }) => kind === "entry-point" || ["react", "react/jsx-runtime"].includes(path) ? undefined : { path, namespace: "mock" });
  builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: `module.exports=globalThis.mocks[${JSON.stringify(path)}];`, loader: "js" }));
} }] });

async function mount(t, options = {}) {
  let user = { id: "alice", name: "Alice", ...options.user };
  const writes = [];
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, { module, require: createRequire(import.meta.url), mocks: {
    "lucide-react": { Sparkles: () => null },
    "../../context/AuthContext.jsx": { useAuth: () => ({ user, setUser: (next) => { user = typeof next === "function" ? next(user) : next; } }) },
    "../../api/users.js": { updateProfile: async (data) => { writes.push(data); if (options.error) throw options.error; if (options.pending) await options.pending; return { id: "alice", ...data }; } },
    "../../api/client.js": { apiErrorMessage: (error) => error.message },
  } });
  let view; await act(async () => { view = create(React.createElement(module.exports.default)); });
  t.after(() => act(() => view.unmount()));
  return { view, writes, get user() { return user; }, switch: () => view.root.findByProps({ role: "switch" }), rerender: async () => act(async () => view.update(React.createElement(module.exports.default))), changeUser: (next) => { user = next; } };
}

test("Personal AI priority analysis is enabled by default and both toggle values persist through the profile API", async (t) => {
  const settings = await mount(t);
  assert.equal(settings.switch().props["aria-checked"], true);
  await act(async () => settings.switch().props.onClick());
  assert.equal(settings.user.aiPriorityEnabled, false);
  await settings.rerender();
  assert.equal(settings.switch().props["aria-checked"], false);
  await act(async () => settings.switch().props.onClick());
  assert.equal(settings.user.aiPriorityEnabled, true);
  assert.deepEqual(settings.writes.map((write) => write.aiPriorityEnabled), [false, true]);
});

test("Failed preference saves preserve the original value, reject duplicate clicks, and cannot affect a different account", async (t) => {
  const options = { error: new Error("Preference could not be saved") };
  const settings = await mount(t, options);
  await act(async () => settings.switch().props.onClick());
  assert.equal(settings.user.aiPriorityEnabled, undefined);
  assert.match(JSON.stringify(settings.view.toJSON()), /Preference could not be saved/);
  options.error = null;
  let finish; options.pending = new Promise((resolve) => { finish = resolve; });
  await act(async () => { void settings.switch().props.onClick(); void settings.switch().props.onClick(); });
  assert.equal(settings.writes.length, 2);
  assert.equal(settings.switch().props.disabled, true);
  settings.changeUser({ id: "bob", aiPriorityEnabled: true });
  await act(async () => finish());
  assert.equal(settings.user.id, "bob");
  assert.equal(settings.user.aiPriorityEnabled, true);
});
