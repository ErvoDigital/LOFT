import { AlertTriangle, Clock3, CircleDot, Archive } from "lucide-react";
import { ROLE_LABELS } from "../../lib/access.js";

const STATUS_STYLES = {
  TODO: "bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-300",
  IN_PROGRESS: "bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400",
  COMPLETED: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
};

const STATUS_LABELS = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

// Task priority. Stored as TIER_1..TIER_4, the values the Smart Priority
// engine weighs (server/src/services/priority.service.js), but always shown
// as plain words: Urgent, High, Medium, Low. Urgent gets the loudest
// treatment (solid crimson and a small live-pulse dot) since it's meant to
// override everything else on the page the way it overrides scheduling; the
// rest fade down to Low's quiet outlined pill.
export const TIER_META = {
  TIER_1: {
    label: "Urgent",
    description: "Needs attention right away",
    Icon: AlertTriangle,
    className: "bg-red-600 text-white",
    dot: "bg-red-500",
    pulse: true,
  },
  TIER_2: {
    label: "High",
    description: "Important, with a deadline coming up",
    Icon: Clock3,
    className: "bg-accent-600 text-white",
    dot: "bg-accent-500",
  },
  TIER_3: {
    label: "Medium",
    description: "Regular work with flexible timing",
    Icon: CircleDot,
    className: "bg-brand-600 text-white",
    dot: "bg-brand-500",
  },
  TIER_4: {
    label: "Low",
    description: "Nice to have, whenever there's time",
    Icon: Archive,
    className: "border border-ink-300 bg-white text-ink-500 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-400",
    dot: "bg-ink-300 dark:bg-ink-500",
  },
};

// Lowest to highest, the order a picker reads in.
export const PRIORITY_ORDER = ["TIER_4", "TIER_3", "TIER_2", "TIER_1"];

// compact drops the icon for tight rows; the word itself always shows.
export function TierBadge({ tier, compact = false }) {
  const meta = TIER_META[tier] || TIER_META.TIER_3;
  const Icon = meta.Icon;
  return (
    <span className={`badge ${meta.className}`} title={`${meta.label} priority`}>
      {meta.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
      )}
      {!compact && <Icon className="h-3 w-3 shrink-0" />}
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_STYLES[status] || STATUS_STYLES.TODO}`}>{STATUS_LABELS[status] || status}</span>;
}

// A member's role, or the title an admin gave them in its place. Admins keep
// the accent color whatever they're called, so it's always clear who they are.
export function RoleBadge({ role, title }) {
  const styles = {
    ADMIN: "bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400",
    MANAGER: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
    MEMBER: "bg-ink-100 text-ink-500 dark:bg-ink-700 dark:text-ink-300",
  };
  return (
    <span className={`badge max-w-[10rem] ${styles[role] || styles.MEMBER}`}>
      <span className="truncate">{title || ROLE_LABELS[role] || role}</span>
    </span>
  );
}
