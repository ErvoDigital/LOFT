import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as tasksApi from "../../api/tasks.js";
import { apiErrorMessage } from "../../api/client.js";
import { useSocket } from "../../context/SocketContext.jsx";

export default function TaskCollaboration({ task, workspaceId }) {
  const [data, setData] = useState(null), [tab, setTab] = useState("Comments"), [text, setText] = useState(""), [blocker, setBlocker] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const { socket } = useSocket();
  useEffect(() => {
    let current = true; setError("");
    tasksApi.getTaskDetails(workspaceId, task.id).then((result) => { if (current) setData(result); }).catch((err) => { if (current) setError(apiErrorMessage(err)); });
    return () => { current = false; };
  }, [workspaceId, task.id, revision]);
  useEffect(() => {
    if (!socket) return;
    const onUpdate = (event) => { if (event.id === task.id || event.parentTaskId === task.id) setRevision((value) => value + 1); };
    socket.on("task:collaboration", onUpdate); socket.on("task:updated", onUpdate); socket.on("task:created", onUpdate);
    return () => { socket.off("task:collaboration", onUpdate); socket.off("task:updated", onUpdate); socket.off("task:created", onUpdate); };
  }, [socket, task.id]);
  async function run(action) { if (busy) return; setBusy(true); setError(""); try { await action(); setRevision((value) => value + 1); } catch (err) { setError(apiErrorMessage(err)); } finally { setBusy(false); } }
  const taskLink = (item) => <Link className="text-brand-600 hover:underline" to={`/workspaces/${workspaceId}/tasks?task=${item.id}`}>{item.title}</Link>;
  return <section className="space-y-3 border-t border-ink-200 pt-4 dark:border-ink-700">
    <div className="flex flex-wrap gap-1" role="group" aria-label="Task collaboration">{["Comments", "Subtasks", "Dependencies", "History"].map((name) => <button type="button" key={name} aria-pressed={tab === name} className={`rounded-lg px-2 py-1.5 text-xs ${tab === name ? "bg-brand-500/10 text-brand-600" : "text-ink-500"}`} onClick={() => { setTab(name); setText(""); }}>{name}</button>)}</div>
    {error && <p role="alert" className="text-xs text-red-600">{error} <button className="underline" onClick={() => setRevision((value) => value + 1)}>Retry</button></p>}
    {data && <>
      {tab === "Comments" && <><div className="max-h-60 space-y-3 overflow-y-auto">{data.comments.length ? data.comments.map((comment) => <div key={comment.id} className="rounded-lg bg-ink-500/5 p-3"><p className="text-xs text-ink-500">{comment.author} · {new Date(comment.createdAt).toLocaleString()}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.content}</p></div>) : <p className="text-xs text-ink-400">Discuss requirements and decisions here.</p>}</div><form onSubmit={(event) => { event.preventDefault(); run(async () => { await tasksApi.addComment(workspaceId, task.id, text); setText(""); }); }}><textarea aria-label="Task comment" className="input" maxLength={4000} required value={text} onChange={(event) => setText(event.target.value)} /><button className="btn-primary mt-2 !text-xs" disabled={busy || !text.trim()}>Add comment</button></form></>}
      {tab === "Subtasks" && <><ul className="space-y-2 text-sm">{data.subtasks.map((item) => <li key={item.id}>{taskLink(item)} <span className="text-xs text-ink-400">{data.statuses.find((status) => status.id === item.status)?.label || item.status}</span></li>)}</ul><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); run(async () => { await tasksApi.createTask(workspaceId, { title: text, parentTaskId: task.id, assigneeId: task.assignee?.id || null }); setText(""); }); }}><input className="input" aria-label="New subtask title" placeholder="Add a subtask" maxLength={160} required value={text} onChange={(event) => setText(event.target.value)} /><button className="btn-primary !text-xs" disabled={busy || !text.trim()}>Add</button></form></>}
      {tab === "Dependencies" && <><p className="text-xs text-ink-500">This task is blocked until the tasks below are completed.</p><ul className="space-y-2 text-sm">{data.dependencies.map((item) => <li key={item.id} className="flex items-center justify-between gap-2"><span>{taskLink(item)} <span className="text-xs text-ink-400">{item.completed ? "Completed" : "Blocking"}</span></span><button type="button" className="text-xs text-red-600" disabled={busy} onClick={() => run(() => tasksApi.removeDependency(workspaceId, task.id, item.id))}>Remove</button></li>)}</ul><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); run(async () => { await tasksApi.addDependency(workspaceId, task.id, blocker); setBlocker(""); }); }}><select className="input" aria-label="Blocking task" required value={blocker} onChange={(event) => setBlocker(event.target.value)}><option value="">Choose a blocking task</option>{data.availableTasks.filter((item) => !data.dependencies.some((edge) => edge.id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button className="btn-primary !text-xs" disabled={busy || !blocker}>Add</button></form></>}
      {tab === "History" && <ul className="max-h-72 space-y-3 overflow-y-auto">{data.changes.map((change) => <li key={change.id} className="text-xs"><p className="font-medium">{change.author} · {new Date(change.createdAt).toLocaleString()}</p>{Object.entries(change.changes).map(([field, value]) => <p key={field} className="mt-1 break-words text-ink-500">{field}: {String(value.before ?? "—")} → {String(value.after ?? "—")}</p>)}</li>)}</ul>}
    </>}
  </section>;
}
