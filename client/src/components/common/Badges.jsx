import { AlertTriangle, Clock3, CircleDot, Archive } from "lucide-react";

const STATUS_STYLES = {
  TODO: "bg-ink-100 text-ink-500",
  IN_PROGRESS: "bg-accent-100 text-accent-600",
  COMPLETED: "bg-brand-100 text-brand-700",
};

const STATUS_LABELS = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

// The 4-tier Smart Priority scheme — replaces the old free-floating
// Low/Medium/High/Urgent priority. Tier 1 gets a louder treatment (solid
// crimson, uppercase, a small live-pulse dot) since it's meant to visually
// override everything else on the page the way it overrides scheduling;
// tiers fade in urgency down to Tier 4's quiet outlined pill.
export const TIER_META = {
  TIER_1: {
    label: "Tier 1",
    short: "T1",
    description: "Critical / Immediate",
    Icon: AlertTriangle,
    className: "bg-red-600 text-white uppercase tracking-wide",
    pulse: true,
  },
  TIER_2: {
    label: "Tier 2",
    short: "T2",
    description: "Important / Time-sensitive",
    Icon: Clock3,
    className: "bg-accent-600 text-white",
  },
  TIER_3: {
    label: "Tier 3",
    short: "T3",
    description: "Flexible / Routine",
    Icon: CircleDot,
    className: "bg-brand-600 text-white",
  },
  TIER_4: {
    label: "Tier 4",
    short: "T4",
    description: "Backlog / Someday",
    Icon: Archive,
    className: "border border-ink-300 bg-white text-ink-500",
  },
};

export function TierBadge({ tier, compact = false }) {
  const meta = TIER_META[tier] || TIER_META.TIER_3;
  const Icon = meta.Icon;
  return (
    <span className={`badge ${meta.className}`}>
      {meta.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
      )}
      <Icon className="h-3 w-3 shrink-0" />
      {compact ? meta.short : meta.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_STYLES[status] || STATUS_STYLES.TODO}`}>{STATUS_LABELS[status] || status}</span>;
}

export function RoleBadge({ role }) {
  const styles = {
    ADMIN: "bg-accent-100 text-accent-600",
    MANAGER: "bg-brand-50 text-brand-700",
    MEMBER: "bg-ink-100 text-ink-500",
  };
  return <span className={`badge ${styles[role] || styles.MEMBER}`}>{role}</span>;
}
