import { useEffect } from "react";

// Mobile keyboards resize the visible viewport without always resizing CSS
// viewport units. Keep overlays inside the area the user can actually see.
export default function useVisualViewport(ref, active) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = ref.current;
    if (!active || !viewport || !element) return;
    let focusFrame;

    function revealField() {
      const field = document.activeElement;
      if (!element.contains?.(field) || !field?.matches?.("input, textarea, select")) return;
      window.cancelAnimationFrame?.(focusFrame);
      focusFrame = window.requestAnimationFrame?.(() => field.scrollIntoView({ block: "nearest", inline: "nearest" }));
    }

    function update() {
      element.style.setProperty("--visible-height", `${viewport.height}px`);
      element.style.setProperty("--visible-top", `${viewport.offsetTop}px`);
      element.dataset.compact = String(viewport.height <= 500);
      revealField();
    }

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    element.addEventListener?.("focusin", revealField);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      element.removeEventListener?.("focusin", revealField);
      window.cancelAnimationFrame?.(focusFrame);
      element.style.removeProperty("--visible-height");
      element.style.removeProperty("--visible-top");
      delete element.dataset.compact;
    };
  }, [ref, active]);
}
