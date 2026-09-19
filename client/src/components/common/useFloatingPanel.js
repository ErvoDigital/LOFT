import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const GAP = 6;
const EDGE = 8;

// Places a panel portaled to <body> against its trigger: under it, or above
// when the space below is too short, and always inside the viewport. Portaled
// because modals clip their overflow and would cut the panel off. Also closes
// the panel on a pointer press outside both elements.
//
// matchWidth stretches the panel to the trigger's width (at least minWidth);
// otherwise the panel keeps its own width. Returns the panel's style, plus
// `place` for re-measuring after the panel's content changes size.
export default function useFloatingPanel({ open, triggerRef, panelRef, onClose, align = "start", matchWidth = false, minWidth = 0 }) {
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const r = trigger.getBoundingClientRect();
    const width = matchWidth ? Math.max(r.width, minWidth) : panel.offsetWidth;
    const height = panel.offsetHeight;
    const fitsBelow = r.bottom + GAP + height <= window.innerHeight - EDGE;
    const top = fitsBelow || r.top - GAP - height < EDGE ? r.bottom + GAP : r.top - GAP - height;
    const preferred = align === "end" ? r.right - width : r.left;
    const left = Math.min(Math.max(preferred, EDGE), window.innerWidth - width - EDGE);
    setPos({ top, left, width: matchWidth ? width : undefined });
  }, [triggerRef, panelRef, align, matchWidth, minWidth]);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, onClose, place, triggerRef, panelRef]);

  // Hidden (but laid out, so it can be measured) until the first placement.
  const style = pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: "hidden", top: 0, left: 0 };
  return { style, place };
}
