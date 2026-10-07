import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `export { default as Login } from './pages/Login.jsx';
      export { default as Register } from './pages/Register.jsx';
      export { AuthProvider, useAuth } from './context/AuthContext.jsx';`,
    resolveDir: fileURLToPath(new URL("../src/", import.meta.url)),
  },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
  plugins: [{
    name: "auth-boundaries",
    setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => {
        let mock;
        if (path.endsWith("/api/auth.js")) mock = "auth-api";
        else if (path.endsWith("/api/client.js")) mock = "api-client";
        else if (path.endsWith("/GoogleSignInButton.jsx")) mock = "google-button";
        else if (path.endsWith("/TermsModal.jsx")) mock = "terms-modal";
        else if (["react-router-dom", "lucide-react"].includes(path)) mock = path;
        if (mock) return { path: mock, namespace: "mock" };
      });
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
        contents: `module.exports = globalThis.mocks[${JSON.stringify(path)}];`, loader: "js",
      }));
    },
  }],
});

async function mount(t, page = "Login", overrides = {}) {
  const storage = new Map();
  const navigations = [];
  const verified = [];
  const challenge = {
    twoFactorRequired: true, challengeId: "a".repeat(32), email: "a***@loft.test",
    expiresAt: new Date(Date.now() + 600000).toISOString(), resendAfter: 0,
    ...overrides.challenge,
  };
  const api = {
    login: async () => challenge,
    register: async () => challenge,
    googleLogin: async () => challenge,
    fetchMe: async () => { throw new Error("No session yet"); },
    verifyTwoFactor: async (id, code) => {
      verified.push([id, code]);
      if (code !== "123456") throw new Error("That code is invalid or has expired.");
      return { token: "verified-session", user: { id: "u-ada", email: "ada@loft.test" } };
    },
    resendTwoFactor: async () => ({ ...challenge, resendAfter: 60 }),
    ...overrides.api,
  };
  const exported = { exports: {} };
  vm.runInNewContext(bundled.outputFiles[0].text, {
    module: exported, require: createRequire(import.meta.url), setInterval, clearInterval,
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    mocks: {
      "auth-api": api,
      "api-client": { apiErrorMessage: (err) => err.message },
      "react-router-dom": {
        Link: ({ to, children }) => React.createElement("a", { href: to }, children),
        useLocation: () => ({ state: { from: "/invite/return-to-workspace", email: "ada@loft.test" } }),
        useNavigate: () => (...args) => navigations.push(args),
      },
      "lucide-react": { Eye: () => null, EyeOff: () => null },
      "google-button": ({ onCredential, onSuccess }) => React.createElement("button", {
        type: "button", "data-google": true,
        onClick: async () => onSuccess(await onCredential("google-credential")),
      }, "Continue with Google"),
      "terms-modal": () => null,
    },
  });
  const { AuthProvider, useAuth } = exported.exports;
  let auth;
  function Probe() { auth = useAuth(); return null; }
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(AuthProvider, null,
      React.createElement(exported.exports[page]), React.createElement(Probe)));
  });
  t.after(() => act(() => renderer.unmount()));
  return { renderer, storage, navigations, verified, getAuth: () => auth };
}

async function submit(renderer) {
  await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
}

async function enterCode(renderer, code) {
  await act(async () => renderer.root.findByProps({ id: "sign-in-code" }).props.onChange({ target: { value: code } }));
}

test("password sign-in waits for verification before saving a session or opening an invite", async (t) => {
  const app = await mount(t);
  await act(async () => app.renderer.root.findByProps({ type: "password" }).props.onChange({ target: { value: "correct-password" } }));
  await submit(app.renderer);
  assert.equal(app.storage.has("loft_token"), false);
  assert.equal(app.getAuth().user, null);
  assert.equal(app.navigations.length, 0);
  assert.ok(app.renderer.root.findByProps({ id: "sign-in-code" }));

  await enterCode(app.renderer, "999999");
  await submit(app.renderer);
  assert.equal(app.storage.has("loft_token"), false);
  assert.equal(app.navigations.length, 0);
  assert.match(app.renderer.root.findByProps({ role: "alert" }).children.join(""), /invalid/);

  await enterCode(app.renderer, "abc1234567");
  await submit(app.renderer);
  assert.equal(app.verified.at(-1)[1], "123456");
  assert.equal(app.storage.get("loft_token"), "verified-session");
  assert.equal(app.getAuth().user.id, "u-ada");
  assert.equal(app.navigations[0][0], "/invite/return-to-workspace");
});

for (const page of ["Login", "Register"]) {
  test(`${page} Google sign-in opens the verification form before account access`, async (t) => {
    const app = await mount(t, page);
    await act(async () => app.renderer.root.findByProps({ "data-google": true }).props.onClick());
    assert.equal(app.storage.has("loft_token"), false);
    assert.equal(app.navigations.length, 0);
    await enterCode(app.renderer, "123456");
    await submit(app.renderer);
    assert.equal(app.storage.get("loft_token"), "verified-session");
    assert.equal(app.navigations[0][0], "/invite/return-to-workspace");
  });
}

test("password registration requires verification before entering the workspace", async (t) => {
  const app = await mount(t, "Register");
  await act(async () => {
    const passwords = app.renderer.root.findAllByProps({ type: "password" });
    passwords.forEach((input) => input.props.onChange({ target: { value: "correct-password" } }));
  });
  await submit(app.renderer);
  assert.equal(app.storage.has("loft_token"), false);
  assert.equal(app.navigations.length, 0);
  await enterCode(app.renderer, "123456");
  await submit(app.renderer);
  assert.equal(app.storage.get("loft_token"), "verified-session");
  assert.equal(app.navigations[0][0], "/invite/return-to-workspace");
});

test("resending clears the old input and enforces the new cooldown", async (t) => {
  const app = await mount(t);
  await submit(app.renderer);
  await enterCode(app.renderer, "111111");
  const resend = app.renderer.root.findAllByType("button").find((node) => node.children.includes("Resend code"));
  await act(async () => resend.props.onClick());
  assert.equal(app.renderer.root.findByProps({ id: "sign-in-code" }).props.value, "");
  const cooldown = app.renderer.root.findAllByType("button").find((node) => node.children.some((s) => String(s).startsWith("Resend in")));
  assert.equal(cooldown.props.disabled, true);
  assert.equal(app.storage.has("loft_token"), false);
});

test("SMTP errors keep sign-in on the credentials screen without a session", async (t) => {
  const app = await mount(t, "Login", { api: { login: async () => { throw new Error("The email could not be sent."); } } });
  await submit(app.renderer);
  assert.equal(app.storage.has("loft_token"), false);
  assert.equal(app.navigations.length, 0);
  assert.equal(app.renderer.root.findAllByProps({ id: "sign-in-code" }).length, 0);
  assert.ok(JSON.stringify(app.renderer.toJSON()).includes("could not be sent"));
});

test("expired challenges disable verification and resend", async (t) => {
  const app = await mount(t, "Login", { challenge: { expiresAt: new Date(Date.now() - 1000).toISOString() } });
  await submit(app.renderer);
  assert.equal(app.renderer.root.findByProps({ id: "sign-in-code" }).props.disabled, true);
  assert.match(app.renderer.root.findByProps({ role: "alert" }).children.join(""), /expired/);
  assert.equal(app.storage.has("loft_token"), false);
});
