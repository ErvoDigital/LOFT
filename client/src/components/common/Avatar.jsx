import { displayColor, textOn } from "../../lib/colors.js";

export default function Avatar({ name, color, size = 32, src }) {
  const initials = (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, backgroundColor: displayColor(color), color: textOn(color), fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
    >
      {initials}
    </div>
  );
}
