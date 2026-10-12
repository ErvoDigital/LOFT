import { Search, X } from "lucide-react";

export default function ConversationSearch({ value, onChange, label = "Search conversations" }) {
  return (
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      <input type="search" aria-label={label} placeholder={label} value={value} onChange={(e) => onChange(e.target.value)}
        className="input !rounded-lg !py-2 !pl-9 !pr-8 !text-xs" />
      {value && <button type="button" aria-label="Clear search" onClick={() => onChange("")}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700 dark:hover:text-ink-100"><X className="h-3.5 w-3.5" /></button>}
    </div>
  );
}
