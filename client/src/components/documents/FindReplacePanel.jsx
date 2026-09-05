import { useEffect, useRef, useState } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";

function findMatches(editor, query, caseSensitive) {
  if (!query) return [];
  const q = caseSensitive ? query : query.toLowerCase();
  const matches = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = caseSensitive ? node.text : node.text.toLowerCase();
    let idx = 0;
    while ((idx = text.indexOf(q, idx)) !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + query.length });
      idx += query.length;
    }
  });
  return matches;
}

// Deliberately doesn't auto-select/scroll to a match on every keystroke —
// that would require focusing the editor (ProseMirror only paints a visible
// selection highlight while its contenteditable has focus), which would
// steal focus out of this input mid-typing. Selection only moves on an
// explicit navigation action (Next/Prev/Enter), where stealing focus is
// exactly what the user just asked for.
export default function FindReplacePanel({ editor, onClose }) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setMatchIndex(0);
  }, [query, caseSensitive]);

  if (!editor) return null;
  const matches = findMatches(editor, query, caseSensitive);

  function selectMatch(i) {
    const m = matches[i];
    if (!m) return;
    editor.chain().focus().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
  }

  function goNext() {
    if (!matches.length) return;
    const next = (matchIndex + 1) % matches.length;
    setMatchIndex(next);
    selectMatch(next);
  }

  function goPrev() {
    if (!matches.length) return;
    const prev = (matchIndex - 1 + matches.length) % matches.length;
    setMatchIndex(prev);
    selectMatch(prev);
  }

  function replaceOne() {
    const m = matches[matchIndex];
    if (!m) return;
    editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, replacement).run();
  }

  function replaceAll() {
    if (!matches.length) return;
    // Replace from the end backwards so earlier positions stay valid as each
    // replacement shifts everything after it.
    const ordered = [...matches].sort((a, b) => b.from - a.from);
    let chain = editor.chain().focus();
    for (const m of ordered) chain = chain.insertContentAt({ from: m.from, to: m.to }, replacement);
    chain.run();
  }

  return (
    <div className="absolute right-4 top-2 z-20 w-80 card p-3 shadow-panel">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find"
          className="input !py-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.shiftKey ? goPrev() : goNext());
            if (e.key === "Escape") onClose();
          }}
        />
        <button onClick={onClose} title="Close" aria-label="Close find and replace" className="shrink-0 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 h-4 text-xs text-ink-400">{matches.length ? `${matchIndex + 1} of ${matches.length}` : query ? "No matches" : ""}</p>
      <div className="mt-1 flex items-center gap-1">
        <button onClick={goPrev} disabled={!matches.length} title="Previous" className="btn-ghost !p-1.5 disabled:opacity-30">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={goNext} disabled={!matches.length} title="Next" className="btn-ghost !p-1.5 disabled:opacity-30">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <label className="ml-2 flex items-center gap-1.5 text-xs text-ink-500">
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Match case
        </label>
      </div>
      <input
        value={replacement}
        onChange={(e) => setReplacement(e.target.value)}
        placeholder="Replace with"
        className="input !py-1 mt-2 text-sm"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button onClick={replaceOne} disabled={!matches.length} className="btn-secondary !py-1 !px-2.5 text-xs">
          Replace
        </button>
        <button onClick={replaceAll} disabled={!matches.length} className="btn-primary !py-1 !px-2.5 text-xs">
          Replace all
        </button>
      </div>
    </div>
  );
}
