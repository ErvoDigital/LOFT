import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../utils/password.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyGoogleCredential } from "../utils/googleAuth.js";
import { notify } from "../services/notification.service.js";
import { publicUser } from "../utils/publicUser.js";

// Avatars are stored as data URIs directly on the user row (see
// client/src/lib/avatarImage.js) rather than in object storage, the same
// approach already used for images embedded in documents: a plain <img src>
// can't send the Authorization header a presigned/proxied download route
// would need. Restricted to raster formats — an svg data URI can carry a
// <script>, which would run wherever the avatar is rendered.
const avatarDataUrlPattern = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  avatarColor: z.string().min(3).max(20).optional(),
  avatarUrl: z
    .union([z.string().regex(avatarDataUrlPattern).max(300000), z.null()])
    .optional(),
});

const verifyPasswordCodeSchema = z.object({ code: z.string().length(6) });

const changePasswordSchema = z.object({
  code: z.string().length(6),
  newPassword: z.string().min(8).max(200),
});

const linkGoogleSchema = z.object({ credential: z.string().min(1) });

const PASSWORD_CODE_TTL_MS = 10 * 60 * 1000;

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function isCodeValid(user, code) {
  return Boolean(
    user.passwordChangeCode &&
      user.passwordChangeCode === code &&
      user.passwordChangeCodeExpiry &&
      user.passwordChangeCodeExpiry > new Date()
  );
}

export async function updateProfile(req, res) {
  const data = updateSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ user: publicUser(user) });
}

// Changing (or, for a Google-only account, setting) a password is gated on
// emailing a 6-digit code rather than the current password — no email
// provider is wired up yet (see server/.env.example's GOOGLE_CLIENT_ID
// neighbors for the pattern to follow), so for now the code also goes out
// as an in-app notification, the one delivery channel that already works,
// and — like forgotPassword below — is returned directly in the response
// outside production so the flow is testable without one.
export async function sendPasswordChangeCode(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  const code = generateCode();
  await prisma.user.update({
    where: { id: req.userId },
    data: { passwordChangeCode: code, passwordChangeCodeExpiry: new Date(Date.now() + PASSWORD_CODE_TTL_MS) },
  });

  await notify(req.userId, {
    type: "PASSWORD_CHANGE_CODE",
    title: "Password change verification code",
    body: `Your code is ${code}. It expires in 10 minutes.`,
  });

  const devOnly = process.env.NODE_ENV !== "production" ? { code } : {};
  res.json({ message: `A verification code was sent to ${user.email}.`, ...devOnly });
}

export async function verifyPasswordChangeCode(req, res) {
  const { code } = verifyPasswordCodeSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!isCodeValid(user, code)) throw new ApiError(400, "That code is invalid or has expired");
  res.json({ verified: true });
}

export async function changePassword(req, res) {
  const { code, newPassword } = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!isCodeValid(user, code)) throw new ApiError(400, "That code is invalid or has expired");

  const passwordHash = await hashPassword(newPassword);
  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: { passwordHash, passwordChangeCode: null, passwordChangeCodeExpiry: null },
  });
  res.json({ message: user.passwordHash ? "Password updated" : "Password set", user: publicUser(updated) });
}

export async function linkGoogle(req, res) {
  const { credential } = linkGoogleSchema.parse(req.body);
  const payload = await verifyGoogleCredential(credential);
  if (!payload.email_verified) throw new ApiError(400, "Invalid Google sign-in token");

  const existing = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  if (existing && existing.id !== req.userId) {
    throw new ApiError(409, "This Google account is already linked to another user");
  }

  const me = await prisma.user.findUnique({ where: { id: req.userId } });
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { googleId: payload.sub, avatarUrl: me.avatarUrl || payload.picture || null },
  });
  res.json({ user: publicUser(user) });
}

export async function unlinkGoogle(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user.googleId) throw new ApiError(400, "No Google account is connected");
  if (!user.passwordHash) {
    throw new ApiError(400, "Set a password before disconnecting Google, so you don't lose access to your account");
  }

  const updated = await prisma.user.update({ where: { id: req.userId }, data: { googleId: null } });
  res.json({ user: publicUser(updated) });
}

export async function searchUsers(req, res) {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
      ],
    },
    take: 10,
    select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true },
  });
  res.json({ users });
}
