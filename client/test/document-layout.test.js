import test from "node:test";
import assert from "node:assert/strict";
import { Editor, getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { DEFAULT_PAGE_LAYOUT, normalizePageLayout, pageDimensions, paginateBlocks } from "../src/lib/documentLayout.js";
import { PageBreak } from "../src/lib/tiptapPageBreak.js";
import { toHtmlDocument, toMarkdown } from "../src/lib/documentExport.js";

const dimensions = pageDimensions(DEFAULT_PAGE_LAYOUT);

test("a page break splits a paragraph at the caret without adding an extra blank line", (t) => {
  const editor = new Editor({ element: null, extensions: [StarterKit, PageBreak], content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "BeforeAfter" }] }] } });
  t.after(() => editor.destroy());
  editor.commands.setTextSelection(7);
  assert.equal(editor.commands.insertPageBreak(), true);
  assert.deepEqual(editor.getJSON().content.map((n) => n.type), ["paragraph", "pageBreak", "paragraph"]);
  assert.equal(editor.state.selection.$from.parent.textContent, "After");
  assert.equal(editor.state.selection.$from.parentOffset, 0);
});

test("typing after a page break at the end retains the break and writes onto the new page", (t) => {
  const editor = new Editor({ element: null, extensions: [StarterKit, PageBreak], content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "First page" }] }] } });
  t.after(() => editor.destroy());
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  assert.equal(editor.commands.insertPageBreak(), true);
  editor.commands.insertContent({ type: "text", text: "Second page" });
  assert.deepEqual(editor.getJSON().content.map((n) => n.type), ["paragraph", "pageBreak", "paragraph"]);
  assert.equal(editor.state.doc.lastChild.textContent, "Second page");
});

test("page breaks cannot be inserted into list items", (t) => {
  const editor = new Editor({ element: null, extensions: [StarterKit, PageBreak], content: { type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "List item" }] }] }] }] } });
  t.after(() => editor.destroy());
  editor.commands.setTextSelection(4);
  const original = JSON.stringify(editor.getJSON());
  assert.equal(editor.can().insertPageBreak(), false);
  assert.equal(editor.commands.insertPageBreak(), false);
  assert.equal(JSON.stringify(editor.getJSON()), original);
});

test("page setup validates saved values and applies paper orientation and margins", () => {
  assert.deepEqual(normalizePageLayout({ size: "unknown", orientation: "invalid", margins: "__proto__" }), DEFAULT_PAGE_LAYOUT);
  assert.deepEqual(pageDimensions({ size: "a4", orientation: "landscape", margins: "narrow" }), { width: 1123, height: 794, margin: 48, gap: 24 });
});

test("content that fits exactly inside the margins stays on one page", () => {
  const result = paginateBlocks([{ pos: 0, top: 96, bottom: 960, type: "paragraph" }], dimensions, 10);
  assert.equal(result.pages.length, 1);
  assert.deepEqual(result.breaks, []);
});

test("overflow moves the next block to the next sheet without changing document positions", () => {
  const blocks = [{ pos: 0, top: 96, bottom: 940, type: "paragraph" }, { pos: 10, top: 948, bottom: 990, type: "paragraph" }];
  const snapshot = structuredClone(blocks);
  const result = paginateBlocks(blocks, dimensions, 20);
  assert.equal(result.pages.length, 2);
  assert.equal(result.breaks[0].pos, 10);
  assert.equal(result.breaks[0].height + blocks[1].top, 1080 + 96);
  assert.deepEqual(result.pages, [{ number: 1, from: 0, to: 10 }, { number: 2, from: 10, to: 20 }]);
  assert.deepEqual(blocks, snapshot);
});

test("explicit page breaks retain empty sheets and push following content inside its margins", () => {
  const result = paginateBlocks([
    { pos: 0, top: 96, bottom: 120, type: "paragraph" },
    { pos: 2, top: 128, bottom: 128, type: "pageBreak" },
    { pos: 3, top: 128, bottom: 128, type: "pageBreak" },
    { pos: 4, top: 128, bottom: 150, type: "paragraph" },
  ], dimensions, 6);
  assert.equal(result.pages.length, 3);
  assert.equal(result.breaks.filter((b) => b.explicit).length, 2);
  assert.equal(result.breaks.reduce((sum, b) => sum + b.height, 0) + 128, 2160 + 96);
});

test("headings stay with their following block instead of being stranded at the bottom", () => {
  const result = paginateBlocks([
    { pos: 0, top: 96, bottom: 890, type: "paragraph" },
    { pos: 10, top: 900, bottom: 930, type: "heading" },
    { pos: 20, top: 940, bottom: 990, type: "paragraph" },
  ], dimensions, 30);
  assert.equal(result.breaks.length, 1);
  assert.equal(result.breaks[0].pos, 10);
  assert.equal(result.pages.length, 2);
});

test("a paragraph longer than a sheet flows by lines and preserves its stored node", () => {
  const lines = Array.from({ length: 100 }, (_, i) => ({ pos: i * 10 + 1, top: 96 + i * 24, bottom: 120 + i * 24 }));
  const result = paginateBlocks([{ pos: 0, top: 96, bottom: 2496, type: "paragraph", lines }], dimensions, 1002);
  assert.equal(result.pages.length, 3);
  assert.equal(result.breaks.length, 2);
  let offset = 0;
  for (const line of lines) {
    offset += result.breaks.filter((b) => b.pos === line.pos).reduce((sum, b) => sum + b.height, 0);
    const page = Math.floor((line.top + offset) / 1080);
    assert.ok(line.top + offset >= page * 1080 + 96);
    assert.ok(line.bottom + offset <= page * 1080 + 960);
  }
});

test("table and list overflow selects a spacer that preserves the parent structure", () => {
  const result = paginateBlocks([
    { pos: 0, top: 96, bottom: 940, type: "tableRow" },
    { pos: 10, top: 940, bottom: 980, type: "tableRow", spacer: { tag: "tr", columns: 3 } },
    { pos: 20, top: 1820, bottom: 1900, type: "listItem", spacer: { tag: "li" } },
  ], dimensions, 30);
  assert.equal(result.breaks[0].tag, "tr");
  assert.equal(result.breaks[0].columns, 3);
  assert.equal(result.breaks[1].tag, "li");
});

test("page breaks, formatted text and shared layout survive a persisted Yjs snapshot", () => {
  const schema = getSchema([StarterKit, TextStyle, FontFamily, FontSize, PageBreak]);
  const content = { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "First page", marks: [{ type: "textStyle", attrs: { fontFamily: "Georgia", fontSize: "14pt" } }] }] },
    { type: "pageBreak" },
    { type: "paragraph", content: [{ type: "text", text: "Second page" }] },
  ] };
  const original = prosemirrorJSONToYDoc(schema, content, "default");
  original.getMap("pageLayout").set("size", "a4");
  original.getMap("pageLayout").set("orientation", "landscape");
  const reopened = new Y.Doc();
  Y.applyUpdate(reopened, Y.encodeStateAsUpdate(original));
  assert.equal(JSON.stringify(yDocToProsemirrorJSON(reopened, "default")), JSON.stringify(yDocToProsemirrorJSON(original, "default")));
  assert.equal(yDocToProsemirrorJSON(reopened, "default").content[1].type, "pageBreak");
  assert.deepEqual(reopened.getMap("pageLayout").toJSON(), { size: "a4", orientation: "landscape" });
  original.destroy(); reopened.destroy();
});

test("HTML and Markdown exports retain page breaks and HTML respects paper setup", () => {
  const editor = {
    getHTML: () => '<p>Before</p><div data-page-break=""></div><p>After</p>',
    getJSON: () => ({ content: [{ type: "paragraph", content: [{ type: "text", text: "Before" }] }, { type: "pageBreak" }, { type: "paragraph", content: [{ type: "text", text: "After" }] }] }),
  };
  const html = toHtmlDocument(editor, 'A <safe> "title"', { size: "a4", orientation: "landscape", margins: "narrow" });
  assert.match(html, /size: A4 landscape; margin: 0.5in/);
  assert.match(html, /\[data-page-break\].*break-after: page/);
  assert.match(html, /A &lt;safe&gt; &quot;title&quot;/);
  assert.match(toMarkdown(editor), /Before\s+<div style="break-after: page;"><\/div>\s+After/);
});

test("Markdown export retains table rows and escapes pipes inside cells", () => {
  const cell = (text) => ({ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
  const markdown = toMarkdown({ getJSON: () => ({ content: [{ type: "table", content: [{ type: "tableRow", content: [cell("Name"), cell("Status")] }, { type: "tableRow", content: [cell("A | B"), cell("Ready")] }] }] }) });
  assert.equal(markdown, "| Name | Status |\n| --- | --- |\n| A \\| B | Ready |\n");
});
