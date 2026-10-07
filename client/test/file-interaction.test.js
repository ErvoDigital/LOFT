import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";
import { build } from "esbuild";
import { previewMimeType } from "../src/lib/filePreview.js";
import { fileFailure } from "../src/lib/fileFeedback.js";

const noop = () => null;
const icons = Object.fromEntries(["File", "AlertCircle", "Download", "Eye", "FolderInput", "Trash2", "Loader2", "X", "Pencil", "Maximize2", "Minimize2", "Pin", "Moon", "Calendar", "Clock3", "Paperclip", "Image", "Film", "Music", "FileText"].map((name) => [name, noop]));
const paths = { preview: "storage/PreviewModal.jsx", card: "storage/AssetCard.jsx", task: "tasks/TaskDetailsPanel.jsx" };
const code = {};
for (const [name, path] of Object.entries(paths)) {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL(`../src/components/${path}`, import.meta.url))],
    bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", external: ["react", "react/jsx-runtime"],
    plugins: [{ name: "file-dependencies", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path, kind }) => {
        if (kind === "entry-point" || path === "react" || path === "react/jsx-runtime" || path.endsWith("/fileFeedback.js") || path.endsWith("/FileFailureNotice.jsx")) return;
        return { path, namespace: "mock" };
      });
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: `module.exports = globalThis.mocks[${JSON.stringify(path)}];`, loader: "js" }));
    } }],
  });
  code[name] = bundled.outputFiles[0].text;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const version = { id: "version", originalName: "notes.txt", mimeType: "text/plain", size: 12, version: 1 };
const asset = { id: "asset", name: "Notes", latestVersion: version, versionCount: 1, uploadedBy: { name: "Uploader" } };

async function mount(t, component = "preview", overrides = {}, apiOverrides = {}) {
  const calls = [];
  const downloads = [];
  const urls = [];
  const api = {
    fetchVersionBlob: async (...args) => { calls.push(args); return new Blob(["Preview contents"], { type: "text/plain" }); },
    downloadVersion: async (...args) => { downloads.push(args); },
    listTaskAttachments: async () => [asset],
    ...apiOverrides,
  };
  const props = { open: true, onClose() {}, workspaceId: "workspace", assetId: "asset", version, name: "Notes", ...overrides };
  const modal = ({ children, footer }) => React.createElement("section", null, children, footer);
  const exported = { exports: {} };
  vm.runInNewContext(code[component], {
    module: exported, require: createRequire(import.meta.url),
    mocks: {
      "lucide-react": icons,
      "../common/Modal.jsx": modal,
      "../common/Spinner.jsx": noop,
      "../common/Avatar.jsx": noop,
      "../common/Badges.jsx": { TierBadge: noop },
      "../../api/assets.js": api,
      "../../api/client.js": { apiErrorMessage: (err) => err.message },
      "../../lib/filePreview.js": { previewMimeType, readOfficePreview: async () => { throw new Error("PRIVATE parser failure"); } },
      "../../lib/colors.js": { displayColor: () => "" },
      "../../lib/uploads.js": { ACCEPTED_UPLOAD_TYPES: "" },
      "./OfficeContentPreview.jsx": noop,
      "./dragTypes.js": { ASSET_DRAG_TYPE: "asset" },
      "../../lib/fileIcons.jsx": { FileIcon: noop, formatSize: () => "12 B", timeAgo: () => "Just now" },
      "../storage/PreviewModal.jsx": noop,
    },
    navigator: { pdfViewerEnabled: overrides.pdfViewerEnabled ?? true },
    URL: { createObjectURL: () => "blob:file-preview", revokeObjectURL: (url) => urls.push(url) },
    Blob, AbortController, setTimeout, clearTimeout,
    requestAnimationFrame: (fn) => { fn(); return 1; }, cancelAnimationFrame() {},
    document: { addEventListener() {}, removeEventListener() {} },
  });
  let view;
  await act(async () => { view = create(React.createElement(exported.exports.default, props)); });
  t.after(() => act(() => view.unmount()));
  const button = (label) => view.root.findAllByType("button").find((node) => node.children.includes(label) || node.props["aria-label"] === label || node.props.title === label);
  const click = async (label) => act(async () => button(label).props.onClick());
  const update = async (changes) => { Object.assign(props, changes); await act(async () => view.update(React.createElement(exported.exports.default, props))); };
  return { view, calls, downloads, urls, button, click, update, text: () => JSON.stringify(view.toJSON()) };
}

test("File feedback distinguishes app access errors from expired storage links without showing internal errors", () => {
  const permission = fileFailure({ response: { status: 403, data: { error: "PRIVATE credentials" } } });
  assert.equal(permission.canRetry, false);
  assert.match(permission.message, /owner|admin/);
  const link = fileFailure({ status: 403, fileSource: "storage" });
  assert.equal(link.canRetry, true);
  assert.match(link.message, /fresh download link/);
  assert.equal(fileFailure({ response: { status: 404 } }).canRetry, false);
  assert.match(fileFailure({ code: "ERR_NETWORK" }).message, /internet/);
  assert.ok(!JSON.stringify(fileFailure(new Error("PRIVATE credentials"))).includes("PRIVATE"));
});

test("Unsupported previews explain how to open the file without fetching it first", async (t) => {
  const preview = await mount(t, "preview", { version: { ...version, mimeType: "application/zip", originalName: "archive.zip" } });
  assert.equal(preview.calls.length, 0);
  assert.match(preview.text(), /Preview isn't available/);
  await preview.click("Download to open");
  assert.equal(preview.downloads.length, 1);
  assert.match(preview.text(), /Download started/);
});

test("Temporary preview failures offer a retry that loads a fresh file", async (t) => {
  let calls = 0;
  const signals = [];
  const preview = await mount(t, "preview", {}, {
    fetchVersionBlob: async (...args) => {
      calls++;
      signals.push(args[3]);
      if (calls === 1) throw Object.assign(new Error("PRIVATE network details"), { code: "FILE_NETWORK_ERROR" });
      return new Blob(["Recovered preview"]);
    },
  });
  assert.match(preview.text(), /internet connection/);
  assert.ok(!preview.text().includes("PRIVATE"));
  await preview.click("Try preview again");
  assert.equal(calls, 2);
  assert.equal(signals[0].aborted, true);
  assert.match(preview.text(), /Recovered preview/);
  assert.equal(preview.view.root.findAllByProps({ role: "alert" }).length, 0);
});

test("Download failures keep a working preview visible and can be retried without reloading it", async (t) => {
  let downloads = 0;
  const preview = await mount(t, "preview", { onDownload: async () => { if (++downloads === 1) throw new Error("PRIVATE download details"); } });
  await preview.click("Download file");
  assert.match(preview.text(), /Preview contents/);
  assert.match(preview.text(), /Couldn't download the file/);
  assert.ok(!preview.text().includes("PRIVATE"));
  await preview.click("Try download again");
  assert.equal(downloads, 2);
  assert.equal(preview.calls.length, 1);
  assert.match(preview.text(), /Download started/);
});

test("Permission and missing-file failures show useful guidance instead of an endless spinner", async (t) => {
  const denied = await mount(t, "preview", {}, { fetchVersionBlob: async () => { throw { response: { status: 403 } }; } });
  assert.match(denied.text(), /give you access/);
  assert.equal(denied.button("Download file").props.disabled, true);
  assert.equal(denied.button("Try preview again"), undefined);
  const missing = await mount(t, "preview", { version: undefined });
  assert.equal(missing.calls.length, 0);
  assert.match(missing.text(), /no longer available/);
  assert.ok(!missing.text().includes("Loading preview"));
});

test("Image and Office rendering failures offer download and retry fallbacks", async (t) => {
  const image = await mount(t, "preview", { version: { ...version, mimeType: "image/png" } });
  await act(async () => image.view.root.findByType("img").props.onError());
  assert.match(image.text(), /Preview unavailable/);
  assert.equal(image.view.root.findAllByType("img").length, 0);
  assert.equal(image.button("Download file").props.disabled, false);
  await image.click("Try preview again");
  assert.equal(image.calls.length, 2);
  assert.equal(image.view.root.findAllByType("img").length, 1);
  const office = await mount(t, "preview", { version: { ...version, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
  assert.match(office.text(), /Preview unavailable/);
  assert.ok(!office.text().includes("PRIVATE"));
  assert.equal(office.button("Download file").props.disabled, false);
});

test("Browsers without a PDF viewer get download guidance immediately", async (t) => {
  const preview = await mount(t, "preview", { pdfViewerEnabled: false, version: { ...version, mimeType: "application/pdf" } });
  assert.equal(preview.calls.length, 0);
  assert.match(preview.text(), /browser can't preview this PDF/);
  assert.equal(preview.view.root.findAllByType("iframe").length, 0);
});

test("Changing or closing the preview aborts its request and ignores late results", async (t) => {
  const old = deferred();
  const signals = [];
  const preview = await mount(t, "preview", {}, {
    fetchVersionBlob: async (...args) => { signals.push(args[3]); return signals.length === 1 ? old.promise : new Blob(["New file contents"]); },
  });
  await preview.update({ version: { ...version, id: "new-version" } });
  assert.equal(signals[0].aborted, true);
  await act(async () => old.resolve(new Blob(["Old file contents"])));
  assert.match(preview.text(), /New file contents/);
  assert.ok(!preview.text().includes("Old file contents"));
  await preview.update({ open: false });
  assert.equal(signals[1].aborted, true);
});

test("Pending downloads prevent duplicate attempts", async (t) => {
  const pending = deferred();
  let downloads = 0;
  const preview = await mount(t, "preview", { onDownload: async () => { downloads++; return pending.promise; } });
  let first;
  await act(async () => { first = preview.button("Download file").props.onClick(); });
  assert.equal(preview.button("Preparing download…").props.disabled, true);
  await act(async () => preview.button("Preparing download…").props.onClick());
  assert.equal(downloads, 1);
  await act(async () => { pending.resolve(); await first; });
});

test("Storage cards keep download errors beside the file and retry the same version", async (t) => {
  const downloads = [];
  const card = await mount(t, "card", { asset, onDownload: async (value) => { downloads.push(value); if (downloads.length === 1) throw new Error("PRIVATE storage failure"); } });
  await card.click("Download");
  assert.match(card.text(), /Couldn't download the file/);
  assert.match(card.text(), /notes.txt/);
  assert.ok(!card.text().includes("PRIVATE"));
  await card.click("Try download again");
  assert.deepEqual(downloads, [version, version]);
  assert.equal(card.view.root.findAllByProps({ role: "alert" }).length, 0);
});

test("Task attachment downloads report failures and retain a retry action", async (t) => {
  let downloads = 0;
  const task = await mount(t, "task", { task: { id: "task", title: "Work", status: "todo" }, statuses: [] }, { downloadVersion: async () => { if (++downloads === 1) throw Object.assign(new Error("PRIVATE transfer failure"), { code: "FILE_NETWORK_ERROR" }); } });
  await task.click("Download");
  assert.match(task.text(), /internet connection/);
  assert.ok(!task.text().includes("PRIVATE"));
  await task.click("Try download again");
  assert.equal(downloads, 2);
  assert.equal(task.view.root.findAllByProps({ role: "alert" }).length, 0);
});
