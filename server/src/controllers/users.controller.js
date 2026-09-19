import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { hashPassword } from "../utils/password.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyGoogleCredential } from "../utils/googleAuth.js";
import { notify } from "../services/notification.service.js";
import { publicUser } from "../utils/publicUser.js";
import { imageDataUrlSchema } from "../utils/imageDataUrl.js";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  avatarColor: z.string().min(3).max(20).optional(),
  avatarUrl: imageDataUrlSchema,
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

const UPCOMING_TASK_LIMIT = 5;

// What a teammate sees when they open someone's profile: who they are, the
// workspaces the two of them share (with this person's role in each), and
// the tasks on this person's plate in those workspaces. Only workspaces the
// viewer also belongs to are ever counted, so it can't reveal anything the
// viewer couldn't already find on those workspaces' own boards.
//
// `workspaceId` narrows the task figures to the workspace the profile was
// opened from; without it they span every shared workspace.
export async function getUserProfile(req, res) {
  const targetId = req.params.userId;
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true, createdAt: true },
  });
  if (!target) throw new ApiError(404, "User not found");

  const [mine, theirs] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { userId: req.userId }, select: { workspaceId: true } }),
    prisma.workspaceMember.findMany({
      where: { userId: targetId },
      include: { workspace: { select: { id: true, name: true, color: true, logoUrl: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);
  const myWorkspaceIds = new Set(mine.map((m) => m.workspaceId));
  const shared = theirs.filter((m) => myWorkspaceIds.has(m.workspaceId));

  // Someone you share no workspace with is only visible if you already have
  // a conversation with them — otherwise this is a 404, not a 403, so it
  // can't be used to confirm that an account exists.
  if (targetId !== req.userId && shared.length === 0) {
    const sharedConversation = await prisma.conversation.findFirst({
      where: {
        AND: [{ participants: { some: { userId: req.userId } } }, { participants: { some: { userId: targetId } } }],
      },
      select: { id: true },
    });
    if (!sharedConversation) throw new ApiError(404, "User not found");
  }

  const focusId = String(req.query.workspaceId || "");
  const scopeIds = shared.some((m) => m.workspaceId === focusId) ? [focusId] : shared.map((m) => m.workspaceId);

  let tasks = { open: 0, overdue: 0, done: 0, upcoming: [] };
  if (scopeIds.length > 0) {
    const [doneStatuses, assigned] = await Promise.all([
      prisma.taskStatus.findMany({ where: { workspaceId: { in: scopeIds }, isDone: true }, select: { id: true } }),
      prisma.task.findMany({
        where: { workspaceId: { in: scopeIds }, assigneeId: targetId },
        select: { id: true, title: true, tier: true, dueDate: true, status: true, workspaceId: true },
      }),
    ]);
    const doneIds = new Set(doneStatuses.map((s) => s.id));
    const now = new Date();
    const open = assigned.filter((t) => !doneIds.has(t.status));
    const workspaceNames = new Map(shared.map((m) => [m.workspaceId, m.workspace.name]));

    // Dated work first, soonest (including overdue) at the top; undated after.
    const upcoming = [...open].sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return Number(!a.dueDate) - Number(!b.dueDate);
      return a.dueDate - b.dueDate;
    });

    tasks = {
      open: open.length,
      overdue: open.filter((t) => t.dueDate && t.dueDate < now).length,
      done: assigned.length - open.length,
      upcoming: upcoming.slice(0, UPCOMING_TASK_LIMIT).map((t) => ({
        id: t.id,
        title: t.title,
        tier: t.tier,
        dueDate: t.dueDate,
        workspaceId: t.workspaceId,
        workspaceName: workspaceNames.get(t.workspaceId),
      })),
    };
  }

  res.json({
    user: target,
    sharedWorkspaces: shared.map((m) => ({ ...m.workspace, role: m.role, joinedAt: m.joinedAt })),
    tasks,
  });
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
