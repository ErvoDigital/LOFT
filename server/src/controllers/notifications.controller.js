import { prisma } from "../db/prisma.js";

export async function listNotifications(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.userId, isRead: false } });
  res.json({ notifications, unreadCount });
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
