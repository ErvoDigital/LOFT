import { useState } from "react";
import * as messagesApi from "../../api/messages.js";
import * as tasksApi from "../../api/tasks.js";
import { useWorkspaces } from "../../context/WorkspaceContext.jsx";
import { apiErrorMessage } from "../../api/client.js";
import Modal from "../common/Modal.jsx";

export default function MessageActions({ message, userId, workspaceId, onReply, onUpdated }) {
  const [mode, setMode] = useState(null), [content, setContent] = useState(""), [workspace, setWorkspace] = useState(workspaceId || ""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [created, setCreated] = useState(null);
  const { workspaces } = useWorkspaces();
  async function run(action) { setBusy(true); setError(""); try { await action(); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); } }
  return <><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] opacity-80">
    <button type="button" onClick={() => onReply(message)}>Reply</button>
    <button type="button" disabled={busy} onClick={() => run(async () => onUpdated(await messagesApi.updateMessage(message.conversationId, message.id, { isPinned: !message.isPinned })))}>{message.isPinned ? "Unpin" : "Pin"}</button>
    {message.sender.id === userId && message.content && <button type="button" onClick={() => { setMode("edit"); setContent(message.content); setError(""); }}>Edit</button>}
    <button type="button" onClick={() => { setMode("task"); setContent(((message.content || "").replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1") || message.attachment?.name || "").slice(0, 160)); setCreated(null); setError(""); }}>Create task</button>
  </div>{error && !mode && <p role="alert" className="text-xs">{error}</p>}
  <Modal open={!!mode} onClose={() => setMode(null)} title={mode === "edit" ? "Edit message" : "Create task from message"} width="max-w-lg">
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); run(async () => {
      if (mode === "edit") { onUpdated(await messagesApi.updateMessage(message.conversationId, message.id, { content })); setMode(null); }
      else { const task = await tasksApi.createTask(workspace, { title: content.trim(), description: (message.content || "").slice(0, 2000), sourceMessageId: message.id, assigneeId: userId, tier: "TIER_3" }); setCreated(task); }
    }); }}>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {created ? <p role="status" className="text-sm">Task created. <a className="text-brand-600 underline" href={`/workspaces/${workspace}/tasks?task=${created.id}`}>Open task</a></p> : <>
        {mode === "task" && <><label className="block text-sm">Workspace<select className="input mt-1" required value={workspace} onChange={(event) => setWorkspace(event.target.value)}><option value="">Choose workspace</option>{workspaces.filter((item) => !workspaceId || item.id === workspaceId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="text-xs text-ink-500">Assigned to you, with Medium priority. The original message is linked to the task.</p></>}
        <label className="block text-sm">{mode === "edit" ? "Message" : "Task title"}<textarea className="input mt-1" required maxLength={mode === "edit" ? 4000 : 160} value={content} onChange={(event) => setContent(event.target.value)} /></label><button className="btn-primary" disabled={busy || !content.trim() || (mode === "task" && !workspace)}>{busy ? "Saving…" : mode === "edit" ? "Save changes" : "Create task"}</button>
      </>}
    </form>
  </Modal></>;
}
