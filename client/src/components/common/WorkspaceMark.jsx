import { displayColor, textOn } from "../../lib/colors.js";

export const workspaceInitials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

// A workspace's logo, or its initials on its color when it has none. The logo
// also sits on the workspace color, so a transparent logo picks it up. Size,
// rounding and type size come from className.
export default function WorkspaceMark({ name, color, logoUrl, className = "" }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{ backgroundColor: displayColor(color) }}
        className={`shrink-0 object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={{ backgroundColor: displayColor(color), color: textOn(color) }}
      className={`flex shrink-0 items-center justify-center font-semibold ${className}`}
    >
      {workspaceInitials(name)}
    </span>
  );
}
