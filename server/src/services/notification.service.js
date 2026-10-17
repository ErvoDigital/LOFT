import { prisma } from "../db/prisma.js";
import { emitToUser } from "../sockets/io.js";
import { notificationPreferencesSchema, readPreferences, quietNow } from "./preferences.js";

// Creates a notification row and pushes it live to the user if connected.
export async function notify(userId, { type, title, body, link, meta, dedupeKey }, { db = prisma, now = new Date(), preferences } = {}) {
  const user = preferences ? null : await db.user.findUnique({ where: { id: userId }, select: { notificationPreferences: true } });
  const settings = preferences || readPreferences(user?.notificationPreferences, notificationPreferencesSchema);
  const workspaceId = meta?.workspaceId || link?.match(/\/workspaces\/([^/]+)/)?.[1];
  if (settings.disabledTypes.includes(type) || settings.mutedWorkspaceIds.includes(workspaceId)) return null;
  let notification;
  try {
    notification = await db.notification.create({
      data: { userId, type, title, body, link, ...(dedupeKey ? { dedupeKey } : {}), meta: meta ? JSON.stringify(meta) : null },
    });
  } catch (error) { if (dedupeKey && error.code === "P2002") return null; throw error; }
  emitToUser(userId, "notification:new", { ...notification, silent: quietNow(settings, now) });
  return notification;
}

export async function notifyMany(userIds, payload) {
  return Promise.all(userIds.map((userId) => notify(userId, payload)));
}
