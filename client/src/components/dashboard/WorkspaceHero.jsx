import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Building2, CalendarPlus, CheckSquare, Church, GraduationCap, Shapes } from "lucide-react";
import * as workspacesApi from "../../api/workspaces.js";
import { usePresence } from "../../context/PresenceContext.jsx";
import { displayColor } from "../../lib/colors.js";
import Avatar from "../common/Avatar.jsx";
import WorkspaceMark from "../common/WorkspaceMark.jsx";
import { countPhrase } from "./fortnight.js";

const TYPES = {
  school: { label: "School", Icon: GraduationCap },
  work: { label: "Work", Icon: Briefcase },
  org: { label: "Organization", Icon: Building2 },
  church: { label: "Church", Icon: Church },
  other: { label: "Workspace", Icon: Shapes },
};

const STACK_LIMIT = 5;

function timeOf(value) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function whenPhrase(day, event) {
  if (day.index === 0) return `today at ${timeOf(event.startTime)}`;
  if (day.index === 1) return `tomorrow at ${timeOf(event.startTime)}`;
  return `${day.date.toLocaleDateString([], { weekday: "long" })} at ${timeOf(event.startTime)}`;
}

function summarize(summary, days) {
  const open = summary.pending || 0;
  const flags = [];
  if (summary.overdue) flags.push(`${summary.overdue} overdue`);
  if (summary.dueToday) flags.push(`${summary.dueToday} due today`);

  let tasks;
  if (!summary.total) tasks = "No tasks on the board yet.";
  else if (!open) tasks = "Every task on the board is done.";
  else tasks = `${countPhrase(open, "open task")}${flags.length ? `, ${flags.join(" and ")}` : ""}.`;

  const eventCount = days.reduce((n, d) => n + d.meetings.length, 0);
  const nextDay = days.find((d) => d.meetings.length);
  const week = nextDay
    ? `${countPhrase(eventCount, "event")} this week. Next: ${nextDay.meetings[0].title}, ${whenPhrase(nextDay, nextDay.meetings[0])}.`
    : "Nothing on the calendar this week.";

  const sentence = `${tasks} ${week}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

// Who belongs here and who's around right now: online members first, each
// avatar ringed in white so the overlap reads on the brand gradient.
function MemberStack({ workspaceId, fallbackCount }) {
  const { supported, isOnline } = usePresence();
  const [members, setMembers] = useState(null);

  useEffect(() => {
    let cancelled = false;
    workspacesApi
      .getWorkspace(workspaceId)
      .then((ws) => !cancelled && setMembers(ws.members || []))
      .catch(() => !cancelled && setMembers([]));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const list = members || [];
  const count = list.length || fallbackCount || 0;
  const sorted = supported
    ? [...list].sort((a, b) => Number(isOnline(b.user.id)) - Number(isOnline(a.user.id)))
    : list;
  const online = supported ? list.filter((m) => isOnline(m.user.id)).length : 0;

  return (
    <div className="flex items-center gap-3">
      {sorted.length > 0 && (
        <div className="flex -space-x-2">
          {sorted.slice(0, STACK_LIMIT).map((m) => (
            <span
              key={m.id}
              className="relative rounded-full ring-2 ring-white/25"
              title={supported ? `${m.user.name} · ${isOnline(m.user.id) ? "Online" : "Offline"}` : m.user.name}
            >
              <Avatar name={m.user.name} color={m.user.avatarColor} src={m.user.avatarUrl} size={28} />
              {supported && isOnline(m.user.id) && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-brand-800" />
              )}
            </span>
          ))}
          {sorted.length > STACK_LIMIT && (
            <span className="relative flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-white/15 px-1.5 text-[11px] font-semibold text-white ring-2 ring-white/25">
              +{sorted.length - STACK_LIMIT}
            </span>
          )}
        </div>
      )}
      <p className="text-xs text-brand-100">
        <span className="font-semibold text-white">{count}</span> member{count === 1 ? "" : "s"}
        {supported && (
          <>
            <span className="text-brand-100/60"> · </span>
            <span className="font-semibold text-white">{online}</span> online
          </>
        )}
      </p>
    </div>
  );
}

const RING_SIZE = 132;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
// Space left between neighbouring arcs, in the same units as the stroke.
const RING_GAP = 3;

// The board's shape at a glance. Arcs run clockwise from the top in the order
// work moves (done, then what's still ahead, then what's slipping), and the
// legend beside the ring carries every count as text, so no number depends on
// telling the colors apart.
function TaskHealth({ summary }) {
  const total = summary.total || 0;
  const done = summary.done || 0;
  const overdue = summary.overdue || 0;
  const dueToday = summary.dueToday || 0;
  const later = Math.max((summary.pending || 0) - overdue - dueToday, 0);
  const rate = total ? Math.round((done / total) * 100) : 0;

  // Drawn at zero length first, so the arcs sweep in once mounted.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const segments = [
    { key: "done", label: "Done", value: done, stroke: "stroke-brand-300", swatch: "bg-brand-300" },
    { key: "later", label: "Later", value: later, stroke: "stroke-white/40", swatch: "bg-white/40" },
    { key: "today", label: "Due today", value: dueToday, stroke: "stroke-accent-400", swatch: "bg-accent-400" },
    { key: "overdue", label: "Overdue", value: overdue, stroke: "stroke-red-400", swatch: "bg-red-400" },
  ];
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? RING_GAP : 0;

  let offset = 0;
  const arcs = visible.map((s) => {
    const span = (s.value / total) * RING_LENGTH;
    const arc = { ...s, length: Math.max(span - gap, 1), offset };
    offset += span;
    return arc;
  });

  const legend = [...segments].reverse();

  return (
    <div className="flex flex-wrap items-center justify-center gap-5 rounded-2xl bg-ink-950/25 p-4 ring-1 ring-inset ring-white/10 sm:gap-7 sm:p-5">
      <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
          role="img"
          aria-label={
            total
              ? `${rate}% of ${total} tasks done: ${overdue} overdue, ${dueToday} due today, ${later} later, ${done} done`
              : "No tasks yet"
          }
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_STROKE}
            className="stroke-white/10"
          />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={RING_STROKE}
              className={`${a.stroke} transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none`}
              strokeDasharray={`${drawn ? a.length : 0} ${RING_LENGTH}`}
              strokeDashoffset={-a.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span className="text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-white">
            {total ? `${rate}%` : "0"}
          </span>
          <span className="mt-1 text-[11px] font-medium text-brand-100">
            {total ? `${done} of ${total} done` : "tasks yet"}
          </span>
        </div>
      </div>

      <dl className="grid min-w-[9.5rem] flex-1 gap-2.5 text-sm">
        {legend.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${s.swatch}`} aria-hidden="true" />
            <dt className="flex-1 text-brand-100">{s.label}</dt>
            <dd className="font-semibold tabular-nums text-white">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// The overview's banner, in the workspace's own identity: its mark, a glow in
// its color, and its type drawn large behind everything. The ground stays the
// brand gradient, so the white type on it clears contrast whatever color the
// workspace picked.
export default function WorkspaceHero({ workspace, workspaceId, summary, days }) {
  const type = TYPES[workspace?.type] || TYPES.other;
  const TypeIcon = type.Icon;
  const color = displayColor(workspace?.color);
  const today = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <section className="hero-panel isolate p-5 sm:p-7 lg:p-8">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div
          className="absolute -left-28 -top-36 h-96 w-96 rounded-full opacity-50 blur-3xl"
          style={{ backgroundColor: color }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgb(255 255 255 / 0.22) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
            maskImage: "linear-gradient(to left, black, transparent 60%)",
            WebkitMaskImage: "linear-gradient(to left, black, transparent 60%)",
          }}
        />
        <TypeIcon
          className="absolute -bottom-16 left-[46%] h-72 w-72 -rotate-12 text-white opacity-[0.06]"
          strokeWidth={1.1}
        />
      </div>

      {/* Wraps on the hero's own width, not the viewport's: the sidebar can
          take a third of the screen, so a breakpoint would put the ring beside
          a squeezed name. Side by side needs about 57rem. */}
      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-7">
        <div className="flex min-w-0 flex-[1_1_32rem] flex-col gap-4 sm:flex-row sm:gap-6">
          <WorkspaceMark
            name={workspace?.name}
            color={workspace?.color}
            logoUrl={workspace?.logoUrl}
            className="h-16 w-16 rounded-2xl text-xl shadow-glass-lg ring-4 ring-white/15 sm:h-[4.5rem] sm:w-[4.5rem] sm:text-2xl"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-100">
              {type.label}
              <span className="text-brand-100/60"> · </span>
              {today}
            </p>
            <h2 className="mt-1.5 break-words text-[1.75rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.25rem]">
              {workspace?.name || "Workspace"}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-brand-100 sm:text-[15px]">{summarize(summary, days)}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/workspaces/${workspaceId}/tasks`}
                  className="btn bg-white text-brand-800 shadow-glass hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <CheckSquare className="h-4 w-4" /> Open board
                </Link>
                <Link
                  to={`/workspaces/${workspaceId}/calendar`}
                  className="btn bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <CalendarPlus className="h-4 w-4" /> Schedule
                </Link>
              </div>
              <MemberStack workspaceId={workspaceId} fallbackCount={workspace?.memberCount} />
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-[0_1_23rem]">
          <TaskHealth summary={summary} />
        </div>
      </div>
    </section>
  );
}
