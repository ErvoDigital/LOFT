import { prisma } from "../db/prisma.js";
import { emitToUser } from "../sockets/io.js";

// Creates a notification row and pushes it live to the user if connected.
export async function notify(userId, { type, title, body, link, meta }) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, link, meta: meta ? JSON.stringify(meta) : null },
  });

  emitToUser(userId, "notification:new", notification);
  return notification;
}

export async function notifyMany(userIds, payload) {
  return Promise.all(userIds.map((userId) => notify(userId, payload)));
}
