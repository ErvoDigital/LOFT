// User.name is the single string every list, mention and avatar reads, so it
// is derived from the editable parts rather than edited directly: the
// nickname when one is set, otherwise "First Last".
export function displayName({ firstName, lastName, nickname }) {
  return nickname?.trim() || [firstName, lastName].map((s) => s?.trim()).filter(Boolean).join(" ");
}

// For sources that only hand over one combined name (Google profiles without
// given/family names, clients from before the fields were split).
export function splitName(name) {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || null };
}
