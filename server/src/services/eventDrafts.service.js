import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { can } from "./permissions.js";

export const EVENT_DRAFT_FIELDS = ["title", "description", "location", "startTime", "endTime", "attendeeIds"];
const isoDate = z.string().datetime({ offset: true });
const draftShape = {
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  startTime: isoDate.nullable().optional(),
  endTime: isoDate.nullable().optional(),
  attendeeIds: z.array(z.string().uuid()).max(100).nullable().optional(),
  deferredFields: z.array(z.enum(EVENT_DRAFT_FIELDS)).max(6).optional(),
};
const validTimes = (data) => !data.startTime || !data.endTime || new Date(data.endTime) > new Date(data.startTime);
const draftSchema = z.object(draftShape).strict().refine(validTimes, "End time must be after start time");
const updateSchema = z.object(draftShape).partial().strict();
const scheduleSchema = z.object({
  title: draftShape.title,
  description: draftShape.description,
  location: draftShape.location,
  startTime: isoDate,
  endTime: isoDate,
  attendeeIds: z.array(z.string().uuid()).min(1).max(100),
}).strict().refine(validTimes, "End time must be after start time");

async function membershipFor(userId, workspaceId, db) {
  const membership = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!membership) throw new ApiError(403, "You are not a member of this workspace");
  return membership;
}

function assertCanManage(record, userId, membership) {
  if (record.createdById !== userId && !can(membership, "events.manage")) {
    throw new ApiError(403, "You can only manage your own meeting drafts");
  }
}

async function checkAttendees(ids, workspaceId, db) {
  for (const userId of ids || []) {
    if (!await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } })) {
      throw new ApiError(400, "Attendee is not a member of this workspace");
    }
  }
}

export function serializeEventDraft(draft) {
  return { ...draft, attendeeIds: draft.attendeeIds ? JSON.parse(draft.attendeeIds) : [], deferredFields: draft.deferredFields ? draft.deferredFields.split(",") : [], isDraft: true };
}

function storedData(data) {
  const stored = { ...data };
  for (const field of ["startTime", "endTime"]) if (field in data) stored[field] = data[field] ? new Date(data[field]) : null;
  if ("attendeeIds" in data) stored.attendeeIds = data.attendeeIds ? JSON.stringify([...new Set(data.attendeeIds)]) : null;
  if ("deferredFields" in data) stored.deferredFields = [...new Set(data.deferredFields)].join(",");
  return stored;
}

export async function createMeetingDraft({ userId, workspaceId, data: raw, actionId }, db = prisma) {
  const data = draftSchema.parse(raw);
  await membershipFor(userId, workspaceId, db);
  await checkAttendees(data.attendeeIds, workspaceId, db);
  const draft = await db.eventDraft.create({ data: { ...storedData(data), ...(actionId ? { id: actionId } : {}), workspaceId, createdById: userId } });
  return serializeEventDraft(draft);
}

export async function listMeetingDrafts(userId, workspaceId, db = prisma) {
  const membership = await membershipFor(userId, workspaceId, db);
  const drafts = await db.eventDraft.findMany({ where: { workspaceId, ...(!can(membership, "events.manage") ? { createdById: userId } : {}) }, orderBy: { updatedAt: "desc" }, take: 100 });
  return drafts.map(serializeEventDraft);
}

async function getManageableDraft(userId, workspaceId, draftId, db) {
  const membership = await membershipFor(userId, workspaceId, db);
  const draft = await db.eventDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.workspaceId !== workspaceId) throw new ApiError(404, "Meeting draft not found");
  assertCanManage(draft, userId, membership);
  return draft;
}

export async function updateMeetingDraft(userId, workspaceId, draftId, raw, db = prisma) {
  const patch = updateSchema.parse(raw);
  const draft = await getManageableDraft(userId, workspaceId, draftId, db);
  const combined = { ...draft, ...storedData(patch) };
  if (!validTimes(combined)) throw new ApiError(400, "End time must be after start time");
  await checkAttendees(patch.attendeeIds, workspaceId, db);
  return serializeEventDraft(await db.eventDraft.update({ where: { id: draftId }, data: storedData(patch) }));
}

export async function deleteMeetingDraft(userId, workspaceId, draftId, db = prisma) {
  await getManageableDraft(userId, workspaceId, draftId, db);
  await db.eventDraft.delete({ where: { id: draftId } });
}

const eventIncludes = { workspace: { select: { name: true, color: true } }, attendees: { include: { user: { select: { id: true, name: true, avatarColor: true } } } } };

// The draft's UUID becomes the event's UUID. Retrying scheduling can therefore
// recover an existing event, while creation and draft removal are atomic.
export async function scheduleMeetingDraft(userId, workspaceId, draftId, raw, db = prisma) {
  const data = scheduleSchema.parse(raw);
  const existingResult = async (client) => {
    const membership = await membershipFor(userId, workspaceId, client);
    const event = await client.event.findUnique({ where: { id: draftId }, include: eventIncludes });
    if (!event || event.workspaceId !== workspaceId) throw new ApiError(404, "Meeting draft not found");
    assertCanManage(event, userId, membership);
    return { event, alreadyScheduled: true };
  };
  try {
    return await db.$transaction(async (tx) => {
      const membership = await membershipFor(userId, workspaceId, tx);
      const draft = await tx.eventDraft.findUnique({ where: { id: draftId } });
      if (!draft) return existingResult(tx);
      if (draft.workspaceId !== workspaceId) throw new ApiError(404, "Meeting draft not found");
      assertCanManage(draft, userId, membership);
      const attendeeIds = [...new Set(data.attendeeIds)];
      await checkAttendees(attendeeIds, workspaceId, tx);
      const { attendeeIds: _ids, ...fields } = data;
      const event = await tx.event.create({ data: { ...fields, startTime: new Date(data.startTime), endTime: new Date(data.endTime), id: draftId, workspaceId, createdById: draft.createdById, attendees: { create: attendeeIds.map((id) => ({ userId: id })) } }, include: eventIncludes });
      await tx.eventDraft.delete({ where: { id: draftId } });
      return { event, alreadyScheduled: false };
    });
  } catch (err) {
    if (!["P2002", "P2025"].includes(err.code)) throw err;
    return existingResult(db);
  }
}
