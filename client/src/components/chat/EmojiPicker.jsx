import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Matches the rendered box: max-h-64 (256px, padding included since Preflight
// sets border-box) plus the mb-2/mt-2 gap to the anchor.
const PICKER_HEIGHT = 264;
const PICKER_WIDTH = 256; // w-64

// The picker is `position: absolute` against its trigger (its React parent
// in every place this is used), so overflow clipping comes from whichever
// ancestor of that trigger actually scrolls — not necessarily the viewport.
// Walking up for the nearest auto/hidden/scroll element finds it generically,
// so this works the same whether the trigger sits in the composer (no
// clipping ancestor, falls back to the viewport) or in a scrolling message
// list (clipped to that list's box).
function findClipAncestor(el) {
  let node = el?.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (/(auto|hidden|scroll)/.test(style.overflowY) || /(auto|hidden|scroll)/.test(style.overflowX)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

const EMOJI_GROUPS = [
  {
    label: "Smileys",
    emojis: ["😀", "😁", "😂", "🤣", "😊", "🙂", "😉", "😍", "😘", "😜", "🤔", "😎", "😴", "😢", "😭", "😡", "🥳", "🤗", "😇", "🙃"],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "👋", "✌️", "🤞", "👌", "🫡"],
  },
  {
    label: "Hearts",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "🔥", "✨", "🎉"],
  },
  {
    label: "Objects",
    emojis: ["🚀", "⭐", "☕", "🍕", "🎂", "📎", "📌", "⏰", "✅", "❌", "⚠️", "💡"],
  },
];

export default function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);
  // Measured against the trigger's actual position before paint (see the
  // layout effect below), so this default never flashes visibly — it only
  // matters for the one frame before that measurement runs.
  const [placement, setPlacement] = useState({ vertical: "top", horizontal: "left" });

  useLayoutEffect(() => {
    const anchor = ref.current?.parentElement;
    if (!anchor) return;
    const anchorRect = anchor.getBoundingClientRect();
    const clipRect = findClipAncestor(anchor)?.getBoundingClientRect();

    const topBound = Math.max(0, clipRect?.top ?? 0);
    const bottomBound = Math.min(window.innerHeight, clipRect?.bottom ?? window.innerHeight);
    const rightBound = Math.min(window.innerWidth, clipRect?.right ?? window.innerWidth);

    const spaceAbove = anchorRect.top - topBound;
    const spaceBelow = bottomBound - anchorRect.bottom;
    const spaceRight = rightBound - anchorRect.left;

    setPlacement({
      vertical: spaceAbove >= PICKER_HEIGHT || spaceAbove >= spaceBelow ? "top" : "bottom",
      horizontal: spaceRight >= PICKER_WIDTH ? "left" : "right",
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute z-10 max-h-64 w-64 overflow-y-auto rounded-lg border border-ink-200 bg-white p-2 shadow-panel ${
        placement.vertical === "top" ? "bottom-full mb-2" : "top-full mt-2"
      } ${placement.horizontal === "left" ? "left-0" : "right-0"}`}
    >
      {EMOJI_GROUPS.map((group) => (
        <div key={group.label} className="mb-1.5 last:mb-0">
          <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{group.label}</p>
          <div className="grid grid-cols-8 gap-0.5">
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelect(emoji)}
                className="flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-ink-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
