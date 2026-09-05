import { MessageSquarePlus } from "lucide-react";
import { acceptAllSuggestions, rejectAllSuggestions } from "../../lib/tiptapSuggestion.js";

export default function SuggestionBar({ editor, count }) {
  if (!editor) return null;
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm print:hidden">
      <MessageSquarePlus className="h-4 w-4 shrink-0 text-amber-600" />
      <span className="text-amber-800">
        Suggesting mode — new text is tracked{count > 0 ? ` (${count} pending)` : ""}.
      </span>
      <div className="ml-auto flex gap-2">
        <button
          onClick={() => rejectAllSuggestions(editor)}
          disabled={count === 0}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-40"
        >
          Reject all
        </button>
        <button
          onClick={() => acceptAllSuggestions(editor)}
          disabled={count === 0}
          className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
