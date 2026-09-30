import { useEffect, useState } from "react";

// Tracks a CSS media query, for layouts that change what they render (not
// just how it is styled) between phone and desktop widths.
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// The width at which two-pane views (a list beside its detail) have room for
// both panes. Below it they show one pane at a time.
export const TWO_PANE = "(min-width: 768px)";
