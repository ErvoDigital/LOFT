// Walks Tiptap's ProseMirror JSON (editor.getJSON()) to produce Markdown.
// Covers exactly the node/mark set this editor's toolbar can produce
// (StarterKit + task list + text align + color/highlight + sub/superscript).
// Marks with no portable Markdown syntax (underline, subscript, superscript,
// text color, highlight) degrade gracefully to plain text — Markdown is
// understood here as a portable export, not a lossless one; PDF/HTML exports
// preserve full fidelity for that.
import { normalizePageLayout, pageDimensions } from "./documentLayout.js";
function serializeMarks(text, marks = []) {
  let result = text;
  for (const mark of marks) {
    if (mark.type === "bold") result = `**${result}**`;
    else if (mark.type === "italic") result = `*${result}*`;
    else if (mark.type === "strike") result = `~~${result}~~`;
    else if (mark.type === "code") result = `\`${result}\``;
    else if (mark.type === "link") result = `[${result}](${mark.attrs?.href || ""})`;
  }
  return result;
}

function serializeInline(nodes = []) {
  return nodes.map((n) => (n.type === "text" ? serializeMarks(n.text, n.marks) : n.type === "hardBreak" ? "\n" : "")).join("");
}

function serializeListItem(item, depth, marker) {
  const indent = "  ".repeat(depth);
  const lines = (item.content || []).map((n) => (n.type === "paragraph" ? serializeInline(n.content) : serializeNode(n, depth + 1).trim()));
  return `${indent}${marker} ${lines.join(" ").trim()}\n`;
}

function serializeTaskItem(item, depth) {
  const indent = "  ".repeat(depth);
  const checked = item.attrs?.checked ? "x" : " ";
  const text = (item.content || []).filter((n) => n.type === "paragraph").map((n) => serializeInline(n.content)).join(" ");
  return `${indent}- [${checked}] ${text.trim()}\n`;
}

function serializeNode(node, depth = 0) {
  switch (node.type) {
    case "paragraph":
      return serializeInline(node.content) + "\n\n";
    case "heading":
      return "#".repeat(node.attrs?.level || 1) + " " + serializeInline(node.content) + "\n\n";
    case "bulletList":
      return (node.content || []).map((li) => serializeListItem(li, depth, "-")).join("") + "\n";
    case "orderedList":
      return (node.content || []).map((li, i) => serializeListItem(li, depth, `${i + 1}.`)).join("") + "\n";
    case "taskList":
      return (node.content || []).map((li) => serializeTaskItem(li, depth)).join("") + "\n";
    case "blockquote":
      return (
        (node.content || [])
          .map((n) => serializeNode(n, depth))
          .join("")
          .trim()
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n") + "\n\n"
      );
    case "codeBlock": {
      const code = (node.content || []).map((n) => n.text || "").join("");
      return "```" + (node.attrs?.language || "") + "\n" + code + "\n```\n\n";
    }
    case "horizontalRule":
      return "---\n\n";
    case "pageBreak":
      return '<div style="break-after: page;"></div>\n\n';
    case "image":
      return `![${node.attrs?.alt || ""}](${node.attrs?.src || ""})\n\n`;
    case "table": {
      const rows = (node.content || []).map((row) => (row.content || []).map((cell) => (cell.content || []).map((child) => serializeNode(child).trim()).join("<br>").replace(/\|/g, "\\|").replace(/\n/g, "<br>")));
      if (!rows.length) return "";
      const columns = Math.max(...rows.map((row) => row.length));
      const rowText = (cells) => `| ${Array.from({ length: columns }, (_, i) => cells[i] || "").join(" | ")} |\n`;
      return rowText(rows[0]) + rowText(Array(columns).fill("---")) + rows.slice(1).map(rowText).join("") + "\n";
    }
    default:
      return node.content ? node.content.map((n) => serializeNode(n, depth)).join("") : "";
  }
}

export function toMarkdown(editor) {
  const json = editor.getJSON();
  return (json.content || []).map((n) => serializeNode(n)).join("").trim() + "\n";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function toHtmlDocument(editor, title, pageLayout) {
  const layout = normalizePageLayout(pageLayout);
  const dims = pageDimensions(layout);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: ${layout.size === "a4" ? "A4" : "letter"} ${layout.orientation}; margin: ${dims.margin / 96}in; }
  body { font-family: Arial, sans-serif; font-size: 11pt; max-width: ${dims.width - dims.margin * 2}px; margin: 2rem auto; padding: 0 1rem; color: #1e293b; line-height: 1.65; overflow-wrap: break-word; }
  h1, h2, h3 { margin-top: 1.4em; margin-bottom: 0.4em; }
  blockquote { border-left: 3px solid #cbd5e1; padding-left: 1em; color: #64748b; margin-left: 0; font-style: italic; }
  pre { background: #0f172a; color: #f8fafc; padding: 1em; border-radius: 8px; overflow-x: auto; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0.25em; }
  ul[data-type="taskList"] li { display: flex; align-items: baseline; gap: 0.5em; }
  mark { background: #fef08a; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #cbd5e1; padding: 0.4em 0.6em; vertical-align: top; }
  th { background: #f8fafc; text-align: left; }
  [data-page-break] { break-after: page; height: 0; }
  @media screen { [data-page-break] { margin: 2rem 0; border-top: 1px dashed #cbd5e1; } }
  @media print { body { max-width: none; margin: 0; padding: 0; } h1, h2, h3 { break-after: avoid; } tr, img { break-inside: avoid; } }
</style>
</head>
<body>
${editor.getHTML()}
</body>
</html>
`;
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugFilename(title) {
  return (title || "Untitled document").trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 80) || "document";
}

export function exportDocument(editor, title, format, layout) {
  const base = slugFilename(title);
  if (format === "markdown") downloadFile(`${base}.md`, toMarkdown(editor), "text/markdown");
  else if (format === "html") downloadFile(`${base}.html`, toHtmlDocument(editor, title, layout), "text/html");
  else if (format === "pdf") window.print();
}
