import { useEffect } from "react";

// Mobile keyboards resize the visible viewport without always resizing CSS
// viewport units. Keep overlays inside the area the user can actually see.
export default function useVisualViewport(ref, active) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = ref.current;
    if (!active || !viewport || !element) return;

    function update() {
      element.style.setProperty("--visible-height", `${viewport.height}px`);
      element.style.setProperty("--visible-top", `${viewport.offsetTop}px`);
      element.dataset.compact = String(viewport.height <= 500);
    }

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      element.style.removeProperty("--visible-height");
      element.style.removeProperty("--visible-top");
      delete element.dataset.compact;
    };
  }, [ref, active]);
}
