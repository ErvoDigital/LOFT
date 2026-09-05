import { Mark, mergeAttributes, Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ySyncPluginKey } from "@tiptap/y-tiptap";

// A lighter-weight "Suggesting" mode than Google Docs' full track-changes:
// while active, this user's own new insertions are auto-tagged with this
// mark (colored/underlined, attributed to them) so a reviewer can see what
// changed since they started reviewing and accept or reject it in bulk.
// Deliberately does NOT intercept/block deletions of pre-existing content —
// doing that safely alongside Yjs's own transaction pipeline (every
// transaction here also needs to sync correctly to every collaborator) is a
// materially bigger, riskier feature than this session's scope, so this
// stays scoped to "track what's been added," not full accept/reject-per-edit.
export const SuggestionInsert = Mark.create({
  name: "suggestionInsert",
  addAttributes() {
    return {
      userName: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-suggestion-insert]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-suggestion-insert": "true",
        title: HTMLAttributes.userName ? `Suggested by ${HTMLAttributes.userName}` : "Suggested addition",
      }),
      0,
    ];
  },
});

const suggestionModeKey = new PluginKey("suggestionMode");

export const SuggestionMode = Extension.create({
  name: "suggestionMode",
  addStorage() {
    return { active: false, userName: null };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: suggestionModeKey,
        appendTransaction(transactions, oldState, newState) {
          if (!storage.active) return null;
          const markType = newState.schema.marks.suggestionInsert;
          if (!markType) return null;

          let tr = null;
          for (const transaction of transactions) {
            if (!transaction.docChanged) continue;
            // Skip transactions that originated from applying a remote Yjs
            // update (someone else's edit arriving over the wire) — this
            // mode only tags what THIS user typed, never a collaborator's.
            const meta = transaction.getMeta(ySyncPluginKey);
            if (meta?.isChangeOrigin) continue;

            const { mapping } = transaction;
            mapping.maps.forEach((stepMap, i) => {
              stepMap.forEach((_fromA, _toA, fromB, toB) => {
                if (toB <= fromB) return;
                const from = mapping.slice(i + 1).map(fromB, -1);
                const to = mapping.slice(i + 1).map(toB, 1);
                if (to <= from) return;
                tr = tr || newState.tr;
                tr.addMark(from, to, markType.create({ userName: storage.userName }));
              });
            });
          }

          if (!tr) return null;
          tr.setMeta("addToHistory", false);
          return tr;
        },
      }),
    ];
  },
});

export function countSuggestions(editor) {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.isText && node.marks.some((m) => m.type.name === "suggestionInsert")) count++;
  });
  return count;
}

// Keeps the text, drops the mark — the suggested addition becomes ordinary
// accepted content.
export function acceptAllSuggestions(editor) {
  editor.chain().focus().selectAll().unsetMark("suggestionInsert").run();
}

// Removes every suggestion-marked range outright, from the end backwards so
// earlier positions stay valid as each removal shifts everything after it —
// same pattern as Find & Replace's "replace all".
export function rejectAllSuggestions(editor) {
  const ranges = [];
  let current = null;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const hasMark = node.marks.some((m) => m.type.name === "suggestionInsert");
    if (hasMark) {
      if (current && current.to === pos) current.to = pos + node.nodeSize;
      else {
        current = { from: pos, to: pos + node.nodeSize };
        ranges.push(current);
      }
    } else {
      current = null;
    }
  });
  if (!ranges.length) return;
  let chain = editor.chain().focus();
  for (const r of [...ranges].reverse()) chain = chain.deleteRange(r);
  chain.run();
}
