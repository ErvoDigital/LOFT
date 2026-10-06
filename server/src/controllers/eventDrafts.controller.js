import { createMeetingDraft, listMeetingDrafts, updateMeetingDraft, deleteMeetingDraft, scheduleMeetingDraft } from "../services/eventDrafts.service.js";
import { serialize as serializeEvent } from "./events.controller.js";
import { emitToWorkspace } from "../sockets/io.js";
import { notify } from "../services/notification.service.js";

export async function createEventDraft(req, res) {
  const workspaceId = req.params.workspaceId;
  const draft = await createMeetingDraft({ userId: req.userId, workspaceId, data: req.body, actionId: req.assistantActionId });
  emitToWorkspace(workspaceId, "event:draft-created", { id: draft.id });
  res.status(201).json({ draft });
}

export async function listEventDrafts(req, res) {
  res.json({ drafts: await listMeetingDrafts(req.userId, req.params.workspaceId) });
}

export async function updateEventDraft(req, res) {
  const { workspaceId, draftId } = req.params;
  const draft = await updateMeetingDraft(req.userId, workspaceId, draftId, req.body);
  emitToWorkspace(workspaceId, "event:draft-updated", { id: draftId });
  res.json({ draft });
}

export async function deleteEventDraft(req, res) {
  const { workspaceId, draftId } = req.params;
  await deleteMeetingDraft(req.userId, workspaceId, draftId);
  emitToWorkspace(workspaceId, "event:draft-deleted", { id: draftId });
  res.json({ message: "Meeting draft discarded" });
}

export async function scheduleEventDraft(req, res) {
  const { workspaceId, draftId } = req.params;
  const { event, alreadyScheduled } = await scheduleMeetingDraft(req.userId, workspaceId, draftId, req.body);
  if (!alreadyScheduled) {
    emitToWorkspace(workspaceId, "event:draft-deleted", { id: draftId });
    emitToWorkspace(workspaceId, "event:created", serializeEvent(event));
    await Promise.all(event.attendees.filter((a) => a.user.id !== req.userId).map(({ user }) => notify(user.id, {
      type: "EVENT_REMINDER", title: `New event: ${event.title}`, body: `${event.workspace.name} · ${new Date(event.startTime).toLocaleString()}`, link: `/workspaces/${workspaceId}/calendar`,
    })));
  }
  res.json({ event: serializeEvent(event), alreadyScheduled });
}
