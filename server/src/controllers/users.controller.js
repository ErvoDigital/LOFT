import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { ApiError } from "../utils/ApiError.js";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  avatarColor: z.string().min(3).max(20).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

function publicUser(user) {
  const { passwordHash, resetToken, resetTokenExpiry, ...rest } = user;
  return rest;
}

export async function updateProfile(req, res) {
  const data = updateSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json({ user: publicUser(user) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.userId } });

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(401, "Current password is incorrect");

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });
  res.json({ message: "Password updated" });
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
