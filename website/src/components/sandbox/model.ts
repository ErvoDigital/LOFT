export type View =
  | "dashboard"
  | "plan"
  | "messages"
  | "overview"
  | "calendar"
  | "tasks"
  | "chat"
  | "meeting"
  | "docs"
  | "storage"
  | "settings";
export type Status = "TODO" | "IN_PROGRESS" | "COMPLETED";
export type Priority = "Urgent" | "High" | "Medium" | "Low";
export type WorkspaceId = "school" | "work" | "community";

export const WORKSPACES = [
  {
    id: "school",
    name: "School project",
    initial: "S",
    type: "School",
    color: "#1f9b7d",
  },
  {
    id: "work",
    name: "Client team",
    initial: "W",
    type: "Work",
    color: "#5686d8",
  },
  {
    id: "community",
    name: "Community group",
    initial: "C",
    type: "Community",
    color: "#c89748",
  },
] as const;

export const MEMBERS = [
  { id: "me", name: "Alex Morgan", initials: "AM", role: "Admin" },
  { id: "jamie", name: "Jamie Lee", initials: "JL", role: "Member" },
  { id: "riley", name: "Riley Nguyen", initials: "RN", role: "Member" },
] as const;

export const STATUSES: { id: Status; label: string }[] = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "COMPLETED", label: "Completed" },
];
export const PRIORITIES: Priority[] = ["Urgent", "High", "Medium", "Low"];

export type Task = {
  id: string;
  workspaceId: WorkspaceId;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string;
  assigneeId: string;
  estimate: number;
};
export type CalendarEvent = {
  id: string;
  workspaceId: WorkspaceId;
  title: string;
  day: string;
  start: string;
  end: string;
  description: string;
};
export type Message = {
  id: string;
  workspaceId: WorkspaceId;
  channel: string;
  authorId: string;
  text: string;
  time: string;
};
export type Document = {
  id: string;
  workspaceId: WorkspaceId;
  title: string;
  body: string;
};
export type AssetVersion = {
  id: string;
  name: string;
  size: string;
  file?: File;
};
export type Asset = {
  id: string;
  workspaceId: WorkspaceId;
  name: string;
  versions: AssetVersion[];
};
export type SandboxData = {
  today: string;
  tasks: Task[];
  events: CalendarEvent[];
  messages: Message[];
  documents: Document[];
  assets: Asset[];
};
export type Conflict = {
  id: string;
  title: string;
  day: string;
  tasks: Task[];
  events: CalendarEvent[];
};

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(day: string, count: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + count);
  return dateKey(date);
}
export function formatDay(day: string, today?: string) {
  if (day === today) return "Today";
  if (today && day === addDays(today, 1)) return "Tomorrow";
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
export function formatTime(time: string) {
  return new Date(`2000-01-01T${time}:00`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
export function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}
export function uid() {
  return crypto.randomUUID();
}
export function fileSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : size >= 1024
      ? `${Math.round(size / 1024)} KB`
      : `${size} B`;
}
export function workspaceFor(id: WorkspaceId) {
  return WORKSPACES.find((workspace) => workspace.id === id)!;
}
export function memberFor(id: string) {
  return MEMBERS.find((member) => member.id === id);
}
export function myTasks(data: SandboxData) {
  return data.tasks
    .filter((task) => task.assigneeId === "me" && task.status !== "COMPLETED")
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority),
    );
}
export function conflictsFor(data: SandboxData): Conflict[] {
  const groups = new Map<string, Task[]>();
  for (const task of myTasks(data)) {
    if (!task.dueDate || task.dueDate < data.today) continue;
    groups.set(task.dueDate, [...(groups.get(task.dueDate) || []), task]);
  }
  const conflicts: Conflict[] = [...groups]
    .filter(
      ([, tasks]) => new Set(tasks.map((task) => task.workspaceId)).size > 1,
    )
    .map(([day, tasks]) => ({
      id: `deadline-${day}`,
      title: "Deadlines on the same day",
      day,
      tasks,
      events: [],
    }));
  const events = data.events.filter((event) => event.day >= data.today);
  events.forEach((event, index) => {
    for (const other of events.slice(index + 1)) {
      if (
        event.workspaceId !== other.workspaceId &&
        event.day === other.day &&
        event.start < other.end &&
        other.start < event.end
      ) {
        conflicts.push({
          id: `${event.id}-${other.id}`,
          title: "Overlapping meetings",
          day: event.day,
          tasks: [],
          events: [event, other],
        });
      }
    }
  });
  return conflicts.sort((a, b) => a.day.localeCompare(b.day));
}

export function createSandbox(): SandboxData {
  const today = dateKey(new Date());
  const tomorrow = addDays(today, 1);
  return {
    today,
    tasks: [
      {
        id: "proposal",
        workspaceId: "school",
        title: "Finish the research proposal",
        description:
          "Review the introduction in Docs, add the sources, and prepare the proposal for submission.",
        status: "IN_PROGRESS",
        priority: "High",
        dueDate: today,
        assigneeId: "me",
        estimate: 60,
      },
      {
        id: "references",
        workspaceId: "school",
        title: "Collect reference material",
        description: "Add the research sources to workspace Storage.",
        status: "TODO",
        priority: "Medium",
        dueDate: tomorrow,
        assigneeId: "jamie",
        estimate: 45,
      },
      {
        id: "topic",
        workspaceId: "school",
        title: "Confirm the project topic",
        description: "Agree on the research question as a team.",
        status: "COMPLETED",
        priority: "Low",
        dueDate: today,
        assigneeId: "riley",
        estimate: 30,
      },
      {
        id: "campaign",
        workspaceId: "work",
        title: "Review the campaign presentation",
        description:
          "Review Presentation.pdf in Storage and share your feedback in the team chat.",
        status: "TODO",
        priority: "Urgent",
        dueDate: today,
        assigneeId: "me",
        estimate: 120,
      },
      {
        id: "brief",
        workspaceId: "work",
        title: "Update the campaign brief",
        description: "Keep the goals and deliverables up to date in Docs.",
        status: "IN_PROGRESS",
        priority: "Medium",
        dueDate: addDays(today, 2),
        assigneeId: "jamie",
        estimate: 60,
      },
      {
        id: "volunteers",
        workspaceId: "community",
        title: "Prepare the volunteer briefing",
        description:
          "Read the volunteer handbook and prepare the team briefing.",
        status: "TODO",
        priority: "Medium",
        dueDate: tomorrow,
        assigneeId: "me",
        estimate: 60,
      },
      {
        id: "venue",
        workspaceId: "community",
        title: "Confirm the venue",
        description: "Share the confirmed venue with the group.",
        status: "COMPLETED",
        priority: "High",
        dueDate: today,
        assigneeId: "riley",
        estimate: 30,
      },
    ],
    events: [
      {
        id: "check-in",
        workspaceId: "work",
        title: "Project check-in",
        day: today,
        start: "10:00",
        end: "10:30",
        description: "Review the campaign presentation and confirm next steps.",
      },
      {
        id: "research-review",
        workspaceId: "school",
        title: "Research review",
        day: today,
        start: "14:00",
        end: "14:30",
        description: "Bring the proposal draft and research sources.",
      },
      {
        id: "planning",
        workspaceId: "community",
        title: "Volunteer planning",
        day: tomorrow,
        start: "14:00",
        end: "15:00",
        description: "Walk through the volunteer briefing together.",
      },
    ],
    messages: WORKSPACES.flatMap((workspace) => [
      {
        id: `${workspace.id}-hello`,
        workspaceId: workspace.id,
        channel: "general",
        authorId: "jamie",
        text:
          workspace.id === "school"
            ? "The proposal draft is ready in Docs. Could you review the introduction?"
            : workspace.id === "work"
              ? "The latest presentation is in Storage. Let's review it at the check-in."
              : "The volunteer handbook is ready. I'll bring the venue details to our planning meeting.",
        time: "9:15 AM",
      },
      {
        id: `${workspace.id}-reply`,
        workspaceId: workspace.id,
        channel: "general",
        authorId: "me",
        text: "Thanks, Jamie. I'll take a look before our meeting.",
        time: "9:18 AM",
      },
      {
        id: `${workspace.id}-project`,
        workspaceId: workspace.id,
        channel: "project-updates",
        authorId: "riley",
        text: "I've added our next steps to the task board. Everything is in the workspace.",
        time: "9:22 AM",
      },
    ]),
    documents: WORKSPACES.map((workspace) => ({
      id: `${workspace.id}-doc`,
      workspaceId: workspace.id,
      title:
        workspace.id === "school"
          ? "Research proposal"
          : workspace.id === "work"
            ? "Campaign brief"
            : "Volunteer plan",
      body:
        workspace.id === "school"
          ? "Our objective\nUnderstand how students coordinate deadlines across their project groups and everyday commitments.\n\nNext steps\nReview the introduction together.\nGather sources and research notes.\nPrepare the final presentation."
          : workspace.id === "work"
            ? "Campaign objective\nMake the launch clear, consistent, and easy to follow.\n\nDeliverables\nReview the presentation.\nConfirm the launch timeline.\nShare the final assets with the client."
            : "Volunteer briefing\nHelp everyone arrive prepared and know where they can contribute.\n\nNext steps\nConfirm the venue.\nShare the volunteer handbook.\nReview responsibilities at the planning meeting.",
    })),
    assets: [
      {
        id: "sources",
        workspaceId: "school",
        name: "Research sources.pdf",
        versions: [
          { id: "sources-v1", name: "Research sources.pdf", size: "1.2 MB" },
        ],
      },
      {
        id: "presentation",
        workspaceId: "work",
        name: "Presentation.pdf",
        versions: [
          { id: "presentation-v1", name: "Presentation.pdf", size: "2.1 MB" },
          { id: "presentation-v2", name: "Presentation.pdf", size: "2.4 MB" },
        ],
      },
      {
        id: "project-brief",
        workspaceId: "work",
        name: "Project brief.docx",
        versions: [
          { id: "brief-v1", name: "Project brief.docx", size: "84 KB" },
        ],
      },
      {
        id: "handbook",
        workspaceId: "community",
        name: "Volunteer handbook.pdf",
        versions: [
          { id: "handbook-v1", name: "Volunteer handbook.pdf", size: "640 KB" },
        ],
      },
    ],
  };
}
