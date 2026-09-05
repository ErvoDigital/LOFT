// Walks Tiptap's ProseMirror JSON (editor.getJSON()) to produce Markdown.
// Covers exactly the node/mark set this editor's toolbar can produce
// (StarterKit + task list + text align + color/highlight + sub/superscript).
// Marks with no portable Markdown syntax (underline, subscript, superscript,
// text color, highlight) degrade gracefully to plain text — Markdown is
// understood here as a portable export, not a lossless one; PDF/HTML exports
// preserve full fidelity for that.
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

export function toHtmlDocument(editor, title) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #1e293b; line-height: 1.65; }
  h1, h2, h3 { margin-top: 1.4em; margin-bottom: 0.4em; }
  blockquote { border-left: 3px solid #cbd5e1; padding-left: 1em; color: #64748b; margin-left: 0; font-style: italic; }
  pre { background: #0f172a; color: #f8fafc; padding: 1em; border-radius: 8px; overflow-x: auto; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0.25em; }
  ul[data-type="taskList"] li { display: flex; align-items: baseline; gap: 0.5em; }
  mark { background: #fef08a; }
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

export function exportDocument(editor, title, format) {
  const base = slugFilename(title);
  if (format === "markdown") downloadFile(`${base}.md`, toMarkdown(editor), "text/markdown");
  else if (format === "html") downloadFile(`${base}.html`, toHtmlDocument(editor, title), "text/html");
  else if (format === "pdf") window.print();
}
