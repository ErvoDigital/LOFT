import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import useFloatingPanel from "./useFloatingPanel.js";

// Stands in for the usual chevron, which the design system doesn't use: two
// stacked dots, reading as "there are choices here".
export function ChoiceDots({ open }) {
  return (
    <span
      className={`flex shrink-0 flex-col gap-[3px] ${open ? "text-brand-600 dark:text-brand-300" : "text-ink-400 dark:text-ink-500"}`}
      aria-hidden="true"
    >
      <span className="h-[3px] w-[3px] rounded-full bg-current" />
      <span className="h-[3px] w-[3px] rounded-full bg-current" />
    </span>
  );
}

export const TRIGGER = {
  md: "input flex cursor-pointer items-center gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-60",
  sm:
    "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border border-ink-400/70 bg-white py-1 pl-2 pr-1.5 text-xs font-medium text-ink-800 " +
    "shadow-[inset_0_1px_2px_rgb(var(--ink-950)/0.06)] transition-colors hover:border-ink-500/70 focus:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/25 " +
    "disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-ink-200 dark:shadow-none dark:hover:border-white/[0.16]",
};

export const OPEN_RING = "!border-brand-500 ring-2 ring-brand-500/25";

// A themed replacement for <select>. The native list is drawn by the OS: it
// ignores dark mode and the theme color, and can't show avatars or badges.
// Follows the WAI-ARIA "select-only combobox" pattern — focus stays on the
// trigger and aria-activedescendant tracks the highlighted option.
//
// options: [{ value, label, description?, icon? }]; onChange receives the
// option's value, not an event. Pass `id` to name it with a <label htmlFor>.
export default function Select({
  value,
  onChange,
  options,
  size = "md",
  align = "start",
  placeholder = "Select…",
  className = "",
  disabled = false,
  id: triggerId,
  title,
  "aria-label": ariaLabel,
}) {
  const id = useId();
  const listId = `${id}-list`;
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const typeahead = useRef({ text: "", timer: null });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const openMenu = (index = selectedIndex) => {
    if (disabled || options.length === 0) return;
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  };

  const close = useCallback(() => setOpen(false), []);

  const choose = (index) => {
    const option = options[index];
    close();
    triggerRef.current?.focus();
    if (option && option.value !== value) onChange(option.value);
  };

  const { style: menuStyle } = useFloatingPanel({
    open,
    triggerRef,
    panelRef: menuRef,
    onClose: close,
    align,
    matchWidth: true,
    minWidth: size === "sm" ? 176 : 0,
  });

  useEffect(() => {
    if (open) menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => () => clearTimeout(typeahead.current.timer), []);

  function jumpTo(char) {
    const t = typeahead.current;
    clearTimeout(t.timer);
    t.text += char.toLowerCase();
    t.timer = setTimeout(() => (t.text = ""), 500);
    const from = open ? active : Math.max(selectedIndex, 0);
    const order = [...options.keys()].map((i) => (from + 1 + i) % options.length);
    // A repeated single letter cycles through matches; a longer run matches the prefix.
    const needle = [...t.text].every((c) => c === t.text[0]) ? t.text[0] : t.text;
    const hit = order.find((i) => String(options[i].label).toLowerCase().startsWith(needle));
    if (hit === undefined) return;
    if (open) setActive(hit);
    else openMenu(hit);
  }

  function onKeyDown(e) {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu(e.key === "ArrowUp" && selectedIndex < 0 ? last : selectedIndex);
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        jumpTo(e.key);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, last));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        // Only the menu closes — the Modal listens for Escape on document.
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        close();
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) jumpTo(e.key);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`${TRIGGER[size]} ${open ? OPEN_RING : ""} ${className}`}
      >
        {selected?.icon && <span className="flex shrink-0 items-center">{selected.icon}</span>}
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-ink-500 dark:text-ink-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChoiceDots open={open} />
      </button>

      {open &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={menuStyle}
            className="dropdown-panel fixed z-[60] max-h-72 overflow-y-auto !bg-white p-1.5 ring-1 ring-ink-900/[0.06] motion-safe:animate-[fade-in_0.12s_ease-out] dark:!bg-ink-800 dark:ring-0"
          >
            {options.map((option, i) => {
              const isSelected = i === selectedIndex;
              const isActive = i === active;
              return (
                <li
                  key={String(option.value)}
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onPointerMove={() => setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(i)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 ${
                    size === "sm" ? "text-xs" : "text-sm"
                  } ${
                    isActive
                      ? "bg-brand-500/10 text-ink-900 dark:bg-white/[0.08] dark:text-ink-50"
                      : "text-ink-700 dark:text-ink-200"
                  }`}
                >
                  {option.icon && <span className="flex shrink-0 items-center">{option.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${isSelected ? "font-semibold" : "font-medium"}`}>{option.label}</span>
                    {option.description && (
                      <span className="mt-0.5 block truncate text-xs font-normal text-ink-500 dark:text-ink-400">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" strokeWidth={2.5} />}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
