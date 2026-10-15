export const PRIORITY_LABELS = { TIER_1: "Urgent", TIER_2: "High", TIER_3: "Medium", TIER_4: "Low" };
export const priorityLabel = (value) => PRIORITY_LABELS[value] || "Medium";
export const humanizePriorityTerms = (text = "") => String(text).replace(/\bTIER[ _-]*([1-4])\b/gi, (_, number) => PRIORITY_LABELS[`TIER_${number}`]);
