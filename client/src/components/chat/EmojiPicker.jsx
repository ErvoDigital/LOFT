import { useEffect, useRef } from "react";

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
      className="absolute bottom-full left-0 z-10 mb-2 max-h-64 w-64 overflow-y-auto rounded-lg border border-ink-200 bg-white p-2 shadow-panel"
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
