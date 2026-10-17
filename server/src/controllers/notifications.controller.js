import { prisma } from "../db/prisma.js";
import { z } from "zod";
import { notificationPreferencesSchema, readPreferences } from "../services/preferences.js";

const visible = () => ({ OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }] });

export async function listNotifications(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId, ...visible() },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.userId, isRead: false, ...visible() } });
  res.json({ notifications, unreadCount });
}

export async function getPreferences(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { notificationPreferences: true } });
  res.json({ preferences: readPreferences(user?.notificationPreferences, notificationPreferencesSchema) });
}
export async function savePreferences(req, res) {
  const preferences = notificationPreferencesSchema.parse(req.body);
  await prisma.user.update({ where: { id: req.userId }, data: { notificationPreferences: JSON.stringify(preferences) } });
  res.json({ preferences });
}
export async function snooze(req, res) {
  const { minutes } = z.object({ minutes: z.number().int().min(5).max(10080) }).strict().parse(req.body);
  await prisma.notification.updateMany({ where: { id: req.params.notificationId, userId: req.userId }, data: { snoozedUntil: new Date(Date.now() + minutes * 60000), isRead: false } });
  res.json({ message: "Notification snoozed" });
}

export async function markRead(req, res) {
  await prisma.notification.updateMany({
    where: { id: req.params.notificationId, userId: req.userId },
    data: { isRead: true },
  });
  res.json({ message: "Marked as read" });
}

export async function markAllRead(req, res) {
  await prisma.notification.updateMany({
    where: { userId: req.userId, isRead: false },
    data: { isRead: true },
  });
  res.json({ message: "All marked as read" });
}
