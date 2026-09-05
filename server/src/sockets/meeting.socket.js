import { prisma } from "../db/prisma.js";
import { notify } from "../services/notification.service.js";

// In-memory only — meetings are ephemeral, no DB persistence needed.
// workspaceId -> Map<userId, { socketId, userId, name, avatarColor }>
const rooms = new Map();

export function registerMeetingHandlers(io, socket) {
  socket.on("meeting:status", (workspaceId, ack) => {
    const room = rooms.get(workspaceId);
    ack?.({
      count: room?.size || 0,
      participants: room ? Array.from(room.values()).map((p) => ({ userId: p.userId, name: p.name, avatarColor: p.avatarColor })) : [],
    });
  });

  socket.on("meeting:join", async (workspaceId, ack) => {
    try {
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: socket.userId } },
      });
      if (!member) return ack?.({ error: "Not a member of this workspace" });

      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: { id: true, name: true, avatarColor: true },
      });

      let room = rooms.get(workspaceId);
      const wasEmpty = !room || room.size === 0;
      if (!room) {
        room = new Map();
        rooms.set(workspaceId, room);
      }

      const existingPeers = Array.from(room.values());

      room.set(socket.userId, {
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        avatarColor: user.avatarColor,
      });
      socket.join(`meeting:${workspaceId}`);
      socket.data.meetingWorkspaceId = workspaceId;

      ack?.({ peers: existingPeers });
      socket.to(`meeting:${workspaceId}`).emit("meeting:peer-joined", {
        userId: user.id,
        name: user.name,
        avatarColor: user.avatarColor,
      });
      io.to(`workspace:${workspaceId}`).emit("meeting:activity", { workspaceId, active: true, count: room.size });

      if (wasEmpty) {
        const [others, workspace] = await Promise.all([
          prisma.workspaceMember.findMany({ where: { workspaceId, userId: { not: socket.userId } } }),
          prisma.workspace.findUnique({ where: { id: workspaceId } }),
        ]);
        await Promise.all(
          others.map((m) =>
            notify(m.userId, {
              type: "MEETING_STARTED",
              title: `${user.name} started a meeting`,
              body: workspace.name,
              link: `/workspaces/${workspaceId}/meeting`,
            })
          )
        );
      }
    } catch (err) {
      console.error("meeting:join failed", err);
      ack?.({ error: "Failed to join meeting" });
    }
  });

  socket.on("meeting:signal", ({ toUserId, data }) => {
    const workspaceId = socket.data.meetingWorkspaceId;
    if (!workspaceId) return;
    const target = rooms.get(workspaceId)?.get(toUserId);
    if (target) {
      io.to(target.socketId).emit("meeting:signal", { fromUserId: socket.userId, data });
    }
  });

  // Tells peers whether this user's screen-share track is starting or stopping,
  // so they know to render it as a distinct tile rather than guessing from the
  // WebRTC track/stream ids alone.
  socket.on("meeting:screen-share", ({ sharing }) => {
    const workspaceId = socket.data.meetingWorkspaceId;
    if (!workspaceId) return;
    socket.to(`meeting:${workspaceId}`).emit("meeting:screen-share", { userId: socket.userId, sharing: !!sharing });
  });

  // Presenter's screen-share annotations (drawn shapes) — plain relay, same
  // trust model as signaling: the server doesn't police who "should" be
  // presenting, it just fans the shape out to the rest of the room.
  socket.on("meeting:annotation-add", (shape) => {
    const workspaceId = socket.data.meetingWorkspaceId;
    if (!workspaceId) return;
    socket.to(`meeting:${workspaceId}`).emit("meeting:annotation-add", shape);
  });

  socket.on("meeting:annotation-undo", (shapeId) => {
    const workspaceId = socket.data.meetingWorkspaceId;
    if (!workspaceId) return;
    socket.to(`meeting:${workspaceId}`).emit("meeting:annotation-undo", shapeId);
  });

  // A shape being dragged to a new position — same room-wide relay as add/undo.
  socket.on("meeting:annotation-update", (payload) => {
    const workspaceId = socket.data.meetingWorkspaceId;
    if (!workspaceId) return;
    socket.to(`meeting:${workspaceId}`).emit("meeting:annotation-update", payload);
  });

  socket.on("meeting:annotation-clear", () => {
    const workspaceId = socket.data.meetingWorkspaceId;
    if (!workspaceId) return;
    socket.to(`meeting:${workspaceId}`).emit("meeting:annotation-clear");
  });

  // Targeted (not room-wide) so only a peer who just joined mid-presentation
  // gets caught up on marks that were already there — same targeting pattern
  // as meeting:signal.
  socket.on("meeting:annotation-sync", ({ toUserId, shapes }) => {
    const workspaceId = socket.data.meetingWorkspaceId;
    if (!workspaceId) return;
    const target = rooms.get(workspaceId)?.get(toUserId);
    if (target) {
      io.to(target.socketId).emit("meeting:annotation-sync", shapes);
    }
  });

  function leaveMeeting() {
    const workspaceId = socket.data.meetingWorkspaceId;
    if (!workspaceId) return;

    const room = rooms.get(workspaceId);
    let remaining = 0;
    if (room) {
      room.delete(socket.userId);
      remaining = room.size;
      if (room.size === 0) rooms.delete(workspaceId);
    }
    socket.leave(`meeting:${workspaceId}`);
    socket.to(`meeting:${workspaceId}`).emit("meeting:peer-left", { userId: socket.userId });
    io.to(`workspace:${workspaceId}`).emit("meeting:activity", { workspaceId, active: remaining > 0, count: remaining });
    socket.data.meetingWorkspaceId = null;
  }

  socket.on("meeting:leave", leaveMeeting);
  socket.on("disconnecting", leaveMeeting);
}
