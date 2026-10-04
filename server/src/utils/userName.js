// User.name is the single string every list, mention and avatar reads, so it
// is derived from first and last name rather than edited directly. The
// nickname is stored alongside and doesn't affect it.
export function fullName({ firstName, lastName }) {
  return [firstName, lastName].map((s) => s?.trim()).filter(Boolean).join(" ");
}

// For sources that only hand over one combined name (Google profiles without
// given/family names, clients from before the fields were split).
export function splitName(name) {
  const [firstName = "", ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || null };
}
