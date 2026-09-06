// In production (Vercel), the REST API and the realtime WebSocket service
// (Neon Functions) are separate deployments with no shared memory, so a push
// is written to the RealtimeEvent table — the realtime service polls that
// table and forwards matching rows to whatever connections it holds.
//
// In local dev, index.js still runs an in-process Socket.io server and calls
// setIo() with it, so publish() also emits there directly for zero-latency
// delivery without waiting on a poller that only exists in the deployed
// realtime service.
import { prisma } from "../db/prisma.js";

let ioInstance = null;

export function setIo(io) {
  ioInstance = io;
}

export function getIo() {
  return ioInstance;
}

function publish(target, event, payload) {
  ioInstance?.to(target).emit(event, payload);
  prisma.realtimeEvent
    .create({ data: { target, event, payload: JSON.stringify(payload) } })
    .catch((err) => console.error(`realtime publish failed (${target}/${event})`, err));
}

export function emitToUser(userId, event, payload) {
  publish(`user:${userId}`, event, payload);
}

export function emitToWorkspace(workspaceId, event, payload) {
  publish(`workspace:${workspaceId}`, event, payload);
}
