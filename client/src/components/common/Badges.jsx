const PRIORITY_STYLES = {
  LOW: "bg-ink-100 text-ink-500",
  MEDIUM: "bg-brand-50 text-brand-700",
  HIGH: "bg-accent-100 text-accent-600",
  URGENT: "bg-red-100 text-red-700",
};

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

export function PriorityBadge({ priority }) {
  return <span className={`badge ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.MEDIUM}`}>{priority}</span>;
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
