// Single source of truth for what a user row looks like once it leaves the
// server — duplicated per-controller versions of this previously drifted:
// auth.controller.js's copy didn't know about passwordChangeCode/
// passwordChangeCodeExpiry added for the profile password-change flow, so
// register/login/me responses were leaking them.
export function publicUser(user) {
  const { passwordHash, googleId, resetToken, resetTokenExpiry, passwordChangeCode, passwordChangeCodeExpiry, ...rest } =
    user;
  return { ...rest, hasPassword: !!passwordHash, googleLinked: !!googleId };
}
