// Holds the Socket.io server instance so services can emit events
// without importing the full socket bootstrap (avoids circular imports).
let ioInstance = null;

export function setIo(io) {
  ioInstance = io;
}

export function getIo() {
  return ioInstance;
}

export function emitToUser(userId, event, payload) {
  ioInstance?.to(`user:${userId}`).emit(event, payload);
}

export function emitToWorkspace(workspaceId, event, payload) {
  ioInstance?.to(`workspace:${workspaceId}`).emit(event, payload);
}
