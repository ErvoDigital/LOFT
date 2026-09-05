import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { emitToWorkspace } from "../sockets/io.js";

const eventSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  attendeeIds: z.array(z.string()).optional(),
});

function serialize(event) {
  return {
    id: event.id,
    workspaceId: event.workspaceId,
    workspaceName: event.workspace?.name,
    workspaceColor: event.workspace?.color,
    title: event.title,
    description: event.description,
    location: event.location,
    startTime: event.startTime,
    endTime: event.endTime,
    createdById: event.createdById,
    attendees: event.attendees?.map((a) => a.user),
    createdAt: event.createdAt,
  };
}

export async function listWorkspaceEvents(req, res) {
  const events = await prisma.event.findMany({
    where: { workspaceId: req.params.workspaceId },
    include: { attendees: { include: { user: { select: { id: true, name: true, avatarColor: true } } } } },
    orderBy: { startTime: "asc" },
  });
  res.json({ events: events.map(serialize) });
}

// Merges events across every workspace the caller belongs to — the "one
// calendar" view that is the point of LOFT.
export async function listMyEvents(req, res) {
  const { from, to } = req.query;
  const where = {
    workspace: { members: { some: { userId: req.userId } } },
    ...(from || to
      ? {
          startTime: {
            ...(from ? { gte: new Date(String(from)) } : {}),
            ...(to ? { lte: new Date(String(to)) } : {}),
          },
        }
      : {}),
  };

  const events = await prisma.event.findMany({
    where,
    include: {
      workspace: { select: { name: true, color: true } },
      attendees: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
    },
    orderBy: { startTime: "asc" },
  });
  res.json({ events: events.map(serialize) });
}

export async function createEvent(req, res) {
  const data = eventSchema.parse(req.body);
  if (data.endTime <= data.startTime) throw new ApiError(400, "End time must be after start time");

  const workspaceId = req.params.workspaceId;
  let attendeeIds = data.attendeeIds;
  if (!attendeeIds || attendeeIds.length === 0) {
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } });
    attendeeIds = members.map((m) => m.userId);
  }

  const event = await prisma.event.create({
    data: {
      workspaceId,
      title: data.title,
      description: data.description,
      location: data.location,
      startTime: data.startTime,
      endTime: data.endTime,
      createdById: req.userId,
      attendees: { create: attendeeIds.map((userId) => ({ userId })) },
    },
    include: {
      workspace: { select: { name: true, color: true } },
      attendees: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
    },
  });

  emitToWorkspace(workspaceId, "event:created", serialize(event));
  await Promise.all(
    attendeeIds
      .filter((id) => id !== req.userId)
      .map((userId) =>
        notify(userId, {
          type: "EVENT_REMINDER",
          title: `New event: ${event.title}`,
          body: `${event.workspace.name} · ${new Date(event.startTime).toLocaleString()}`,
          link: `/workspaces/${workspaceId}/calendar`,
        })
      )
  );

  res.status(201).json({ event: serialize(event) });
}

export async function updateEvent(req, res) {
  const data = eventSchema.partial().parse(req.body);
  const existing = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!existing || existing.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Event not found");

  if (data.startTime && data.endTime && data.endTime <= data.startTime) {
    throw new ApiError(400, "End time must be after start time");
  }

  const { attendeeIds, ...rest } = data;
  const event = await prisma.event.update({
    where: { id: req.params.eventId },
    data: {
      ...rest,
      ...(attendeeIds
        ? { attendees: { deleteMany: {}, create: attendeeIds.map((userId) => ({ userId })) } }
        : {}),
    },
    include: {
      workspace: { select: { name: true, color: true } },
      attendees: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
    },
  });

  emitToWorkspace(req.params.workspaceId, "event:updated", serialize(event));
  res.json({ event: serialize(event) });
}

export async function cancelEvent(req, res) {
  const existing = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!existing || existing.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Event not found");

  await prisma.event.delete({ where: { id: req.params.eventId } });
  emitToWorkspace(req.params.workspaceId, "event:cancelled", { id: req.params.eventId });
  res.json({ message: "Event cancelled" });
}
