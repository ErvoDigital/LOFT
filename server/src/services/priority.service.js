// Smart Priority Engine — computes a single real-time weight score for a
// task from its tier, how close its deadline is, and any manual override.
// This score is the one ranking signal used everywhere a task list needs
// sorting (My Plan's schedule, the "someday" backlog): tier alone would
// starve an urgent Tier 3 item behind a comfortable Tier 1 one, and
// deadline-only sorting would ignore that a platform outage (Tier 1) still
// outranks a routine weekly review (Tier 3) even a few hours out — this
// formula blends both instead of picking one axis.

export const TIER_WEIGHTS = { TIER_1: 1000, TIER_2: 500, TIER_3: 200, TIER_4: 50 };
const OVERDUE_SURGE = 500;
const DECAY_NUMERATOR = 1000;
const DECAY_WINDOW_HOURS = 168; // 7 days — beyond this, distance-to-deadline stops mattering
const PIN_BONUS = 10000;
const SNOOZE_SCORE = -5000;

export function calculatePriorityScore(task, now = new Date()) {
  if (task.isSnoozed) return SNOOZE_SCORE;

  const tierWeight = TIER_WEIGHTS[task.tier] ?? TIER_WEIGHTS.TIER_3;
  if (task.isPinned) return PIN_BONUS + tierWeight;

  if (!task.dueDate) return tierWeight;

  const hoursUntilDue = (new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilDue <= 0) return tierWeight + OVERDUE_SURGE;
  if (hoursUntilDue <= DECAY_WINDOW_HOURS) return tierWeight + DECAY_NUMERATOR / (hoursUntilDue + 1);
  return tierWeight;
}
