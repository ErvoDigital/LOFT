import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { notify } from "../services/notification.service.js";
import { emitToWorkspace } from "../sockets/io.js";
import { randomUUID } from "node:crypto";
import { availableSlots, expandRecurrence, recurrenceSchema } from "../services/calendarScheduling.js";
import { timeZoneSchema } from "../services/preferences.js";

export const eventSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  attendeeIds: z.array(z.string()).optional(),
  recurrence: recurrenceSchema.optional(),
});

export function serialize(event) {
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
    attendees: event.attendees?.map((a) => ({ ...a.user, response: a.response || "PENDING" })),
    seriesId: event.seriesId,
    recurrence: event.recurrence ? JSON.parse(event.recurrence) : null,
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
// calendar" view that is the point of SyncTayo.
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
  attendeeIds = [...new Set(attendeeIds)];
  if (data.attendeeIds?.length) {
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId, userId: { in: attendeeIds } }, select: { userId: true } });
    if (members.length !== attendeeIds.length) throw new ApiError(400, "Every attendee must belong to this workspace");
  }

  const slots = expandRecurrence(data.startTime, data.endTime, data.recurrence);
  const seriesId = slots.length > 1 ? randomUUID() : null;
  const createOne = (db, slot) => db.event.create({
    data: {
      ...(req.assistantActionId ? { id: req.assistantActionId } : {}),
      workspaceId,
      title: data.title,
      description: data.description,
      location: data.location,
      ...slot,
      ...(seriesId ? { seriesId, recurrence: JSON.stringify(data.recurrence) } : {}),
      createdById: req.userId,
      attendees: { create: attendeeIds.map((userId) => ({ userId })) },
    },
    include: {
      workspace: { select: { name: true, color: true } },
      attendees: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
    },
  });
  const created = slots.length === 1 ? [await createOne(prisma, slots[0])] : await prisma.$transaction(async (tx) => {
    const result = [];
    for (const slot of slots) result.push(await createOne(tx, slot));
    return result;
  });
  const event = created[0];

  created.forEach((item) => emitToWorkspace(workspaceId, "event:created", serialize(item)));
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
  const existing = await prisma.event.findUnique({ where: { id: req.params.eventId }, include: { attendees: true } });
  if (!existing || existing.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Event not found");

  if (new Date(data.endTime ?? existing.endTime) <= new Date(data.startTime ?? existing.startTime)) {
    throw new ApiError(400, "End time must be after start time");
  }

  const { attendeeIds, recurrence, ...rest } = data;
  if (recurrence) throw new ApiError(400, "Recurrence is set when creating a series. This edit changes only this occurrence.");
  if (attendeeIds?.length) {
    const members = await prisma.workspaceMember.findMany({ where: { workspaceId: req.params.workspaceId, userId: { in: [...new Set(attendeeIds)] } }, select: { userId: true } });
    if (members.length !== new Set(attendeeIds).size) throw new ApiError(400, "Every attendee must belong to this workspace");
  }
  const event = await prisma.event.update({
    where: { id: req.params.eventId },
    data: {
      ...rest,
      ...(data.startTime && new Date(data.startTime).getTime() !== new Date(existing.startTime).getTime() ? { remindedAt: null } : {}),
      ...(attendeeIds
        ? { attendees: { deleteMany: { userId: { notIn: attendeeIds } }, create: [...new Set(attendeeIds)].filter((id) => !(existing.attendees || []).some((a) => a.userId === id)).map((userId) => ({ userId })) } }
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

export async function respondToEvent(req, res) {
  const { response } = z.object({ response: z.enum(["ACCEPTED", "TENTATIVE", "DECLINED"]) }).strict().parse(req.body);
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event || event.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Event not found");
  const result = await prisma.eventAttendee.updateMany({ where: { eventId: event.id, userId: req.userId }, data: { response, respondedAt: new Date() } });
  if (!result.count) throw new ApiError(403, "Only invited attendees can respond");
  emitToWorkspace(event.workspaceId, "event:attendance", { id: event.id });
  res.json({ response });
}

export async function previewConflicts(req, res) {
  const data = eventSchema.pick({ startTime: true, endTime: true, attendeeIds: true }).extend({ excludeEventId: z.string().optional() }).parse(req.body);
  if (data.endTime <= data.startTime) throw new ApiError(400, "End time must be after start time");
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId: req.params.workspaceId, ...(data.attendeeIds?.length ? { userId: { in: data.attendeeIds } } : {}) }, select: { userId: true, user: { select: { name: true } } } });
  if (data.attendeeIds?.length && members.length !== new Set(data.attendeeIds).size) throw new ApiError(400, "Every attendee must belong to this workspace");
  const events = await prisma.event.findMany({ where: { ...(data.excludeEventId ? { id: { not: data.excludeEventId } } : {}), startTime: { lt: data.endTime }, endTime: { gt: data.startTime }, attendees: { some: { userId: { in: members.map((m) => m.userId) }, response: { not: "DECLINED" } } } }, select: { attendees: { select: { userId: true, response: true } } } });
  const busy = new Set(events.flatMap((event) => event.attendees.filter((a) => a.response !== "DECLINED").map((a) => a.userId)));
  res.json({ conflicts: members.filter((member) => busy.has(member.userId)).map((member) => ({ userId: member.userId, name: member.user.name, message: "Has another commitment at this time" })) });
}

export async function eventAvailability(req, res) {
  const timeZone = timeZoneSchema.parse(req.query.timeZone || "Asia/Manila");
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId }, include: { attendees: true } });
  if (!event || event.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Event not found");
  const now = new Date(), from = new Date(Math.max(+now, +new Date(event.startTime)));
  const busyEvents = await prisma.event.findMany({ where: { id: { not: event.id }, endTime: { gt: from }, startTime: { lt: new Date(+from + 9 * 86400000) }, attendees: { some: { userId: { in: event.attendees.map((a) => a.userId) }, response: { not: "DECLINED" } } } }, select: { startTime: true, endTime: true } });
  res.json({ slots: availableSlots({ ...event, busyEvents, timeZone, now }), timeZone });
}

export async function cancelEvent(req, res) {
  const existing = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!existing || existing.workspaceId !== req.params.workspaceId) throw new ApiError(404, "Event not found");

  await prisma.event.delete({ where: { id: req.params.eventId } });
  emitToWorkspace(req.params.workspaceId, "event:cancelled", { id: req.params.eventId });
  res.json({ message: "Event cancelled" });
}
