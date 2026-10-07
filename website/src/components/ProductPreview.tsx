import { useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Bell,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  FileText,
  FolderOpen,
  Home,
  Layers,
  MessageSquare,
  MonitorUp,
  Sparkles,
  Video,
} from "lucide-react";

const views = [
  { id: "overview", label: "Overview", Icon: Home },
  { id: "plan", label: "My Plan", Icon: CalendarRange },
  { id: "tasks", label: "Tasks", Icon: CheckSquare },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "meetings", label: "Meeting", Icon: Video },
  { id: "documents", label: "Docs", Icon: FileText },
  { id: "storage", label: "Storage", Icon: FolderOpen },
] as const;
type PreviewView = (typeof views)[number]["id"];

const tasks = [
  {
    title: "Finish the research proposal",
    team: "School project",
    tag: "school",
    due: "Today · 5 PM",
    priority: "Time-sensitive",
  },
  {
    title: "Review the campaign presentation",
    team: "Client team",
    tag: "work",
    due: "Today · 5 PM",
    priority: "Critical",
  },
  {
    title: "Prepare the volunteer briefing",
    team: "Community group",
    tag: "community",
    due: "Tomorrow",
    priority: "Flexible",
  },
] as const;

function TaskList() {
  return (
    <div className="preview-task-list">
      {tasks.map((task) => (
        <div className="preview-task" key={task.title}>
          <CheckSquare size={17} aria-hidden="true" />
          <div>
            <strong>{task.title}</strong>
            <span className={`workspace-tag ${task.tag}`}>{task.team}</span>
          </div>
          <span>{task.due}</span>
        </div>
      ))}
    </div>
  );
}

export function ProductPreview() {
  const [activeView, setActiveView] = useState<PreviewView>("overview");

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % views.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + views.length) % views.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = views.length - 1;
    else return;
    event.preventDefault();
    setActiveView(views[next].id);
    document.getElementById(`preview-tab-${views[next].id}`)?.focus();
  }

  return (
    <figure className="product-preview">
      <div className="preview-topbar">
        <span>
          <span className="brand-mark small">L</span>LOFT
          <span className="preview-topbar-divider">/</span>
          <span className="muted">Your teams, together</span>
        </span>
        <span className="preview-sample-badge">
          Product preview · Sample data
        </span>
      </div>
      <div className="preview-layout">
        <aside className="preview-rail" aria-label="Illustrative workspaces">
          <span className="rail-home">
            <Layers size={18} aria-hidden="true" />
          </span>
          <span className="workspace-avatar school" title="School project">
            S
          </span>
          <span className="workspace-avatar work" title="Client team">
            W
          </span>
          <span className="workspace-avatar community" title="Community group">
            C
          </span>
        </aside>
        <div className="preview-main">
          <div
            className="preview-tabs"
            role="tablist"
            aria-label="Explore LOFT views"
          >
            {views.map(({ id, label, Icon }, index) => (
              <button
                key={id}
                id={`preview-tab-${id}`}
                role="tab"
                aria-selected={activeView === id}
                aria-controls="preview-panel"
                tabIndex={activeView === id ? 0 : -1}
                onClick={() => setActiveView(id)}
                onKeyDown={(event) => handleTabKey(event, index)}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id="preview-panel"
            aria-labelledby={`preview-tab-${activeView}`}
            tabIndex={0}
            className="preview-content"
          >
            {activeView === "overview" && (
              <>
                <div className="preview-greeting">
                  <div>
                    <p className="eyebrow">
                      Your personal dashboard · 3 workspaces
                    </p>
                    <h2>Your day, in view.</h2>
                    <p>One place for the work that belongs to you.</p>
                  </div>
                  <span className="preview-clash-pill">
                    <CalendarRange size={14} aria-hidden="true" />1 deadline
                    clash
                  </span>
                </div>
                <div className="preview-two-col">
                  <div className="preview-card">
                    <h3>Pending tasks</h3>
                    <TaskList />
                  </div>
                  <div className="preview-card">
                    <h3>Upcoming events</h3>
                    <div className="preview-event">
                      <span className="event-time">10:00</span>
                      <div>
                        <strong>Project check-in</strong>
                        <span className="workspace-tag work">Client team</span>
                        <p>Today · 10:00–10:30 AM</p>
                      </div>
                    </div>
                    <div className="preview-event">
                      <span className="event-time">14:00</span>
                      <div>
                        <strong>Volunteer planning</strong>
                        <span className="workspace-tag community">
                          Community group
                        </span>
                        <p>Tomorrow · 2:00–3:00 PM</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="preview-warning">
                  <CalendarRange size={19} aria-hidden="true" />
                  <div>
                    <strong>Two deadlines land today</strong>
                    <p>
                      Your school proposal and client presentation are both due
                      at 5 PM.
                    </p>
                  </div>
                </div>
              </>
            )}
            {activeView === "plan" && (
              <>
                <div className="preview-greeting">
                  <div>
                    <p className="eyebrow">My Plan</p>
                    <h2>Make room for your focus.</h2>
                    <p>Tasks and meetings, planned around your capacity.</p>
                  </div>
                  <span className="preview-clash-pill">4h daily capacity</span>
                </div>
                <div className="preview-two-col">
                  <div className="preview-card plan-focus">
                    <p className="eyebrow">Up first today</p>
                    <h3>Review the campaign presentation</h3>
                    <p>Client team · Critical · 2h estimated</p>
                    <div className="capacity-bar">
                      <span />
                    </div>
                    <p>3h tasks + 30m meeting · 4h capacity</p>
                  </div>
                  <div className="preview-card">
                    <h3>Today’s plan</h3>
                    <div className="plan-row">
                      <span>10:00</span>
                      <strong>Project check-in</strong>
                      <span>30m</span>
                    </div>
                    <div className="plan-row">
                      <span>Focus</span>
                      <strong>Campaign presentation</strong>
                      <span>2h</span>
                    </div>
                    <div className="plan-row">
                      <span>Next</span>
                      <strong>Research proposal</strong>
                      <span>1h</span>
                    </div>
                  </div>
                </div>
                <div className="preview-warning">
                  <CalendarRange size={19} aria-hidden="true" />
                  <div>
                    <strong>Keep both deadlines in view</strong>
                    <p>
                      My Plan brings tasks from your teams into one personal
                      schedule.
                    </p>
                  </div>
                </div>
              </>
            )}
            {activeView === "tasks" && (
              <>
                <div className="preview-greeting">
                  <div>
                    <p className="eyebrow">School project / Tasks</p>
                    <h2>A clear path to done.</h2>
                    <p>Statuses, priorities, and assignees in one board.</p>
                  </div>
                </div>
                <div className="preview-board">
                  {[
                    {
                      title: "To Do",
                      task: "Collect reference material",
                      priority: "Flexible",
                      initials: "AM",
                    },
                    {
                      title: "In Progress",
                      task: "Finish the research proposal",
                      priority: "Time-sensitive",
                      initials: "JL",
                    },
                    {
                      title: "Completed",
                      task: "Confirm the project topic",
                      priority: "Flexible",
                      initials: "RN",
                    },
                  ].map((column) => (
                    <div className="board-column" key={column.title}>
                      <h3>
                        {column.title}
                        <span>1</span>
                      </h3>
                      <div className="board-task">
                        <p>{column.task}</p>
                        <span className="task-priority">{column.priority}</span>
                        <div>
                          <span>Project team</span>
                          <span className="mini-avatar">{column.initials}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {activeView === "calendar" && (
              <>
                <div className="preview-greeting">
                  <div>
                    <p className="eyebrow">Workspace calendar</p>
                    <h2>See the week ahead.</h2>
                    <p>Shared events with your team’s schedule in view.</p>
                  </div>
                </div>
                <div className="preview-week">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => (
                    <div key={day}>
                      <h3>{day}</h3>
                      {index === 1 && (
                        <div className="calendar-sample-event">
                          <strong>Project check-in</strong>
                          <span>10–10:30 AM</span>
                        </div>
                      )}
                      {index === 3 && (
                        <div className="calendar-sample-event">
                          <strong>Team review</strong>
                          <span>2–3 PM</span>
                        </div>
                      )}
                      {index === 4 && (
                        <div className="calendar-sample-event deadline">
                          <strong>Proposal due</strong>
                          <span>5 PM</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            {activeView === "chat" && (
              <>
                <div className="preview-greeting">
                  <div>
                    <p className="eyebrow">School project / Chat</p>
                    <h2>Keep the team in the loop.</h2>
                    <p>Channels, mentions, reactions, and shared files.</p>
                  </div>
                </div>
                <div className="preview-card chat-example">
                  <h3># general</h3>
                  <div className="chat-message">
                    <span className="mini-avatar">AM</span>
                    <div>
                      <strong>
                        Alex<span>9:15 AM</span>
                      </strong>
                      <p>
                        The proposal draft is ready in Docs. Could you review
                        the introduction?
                      </p>
                      <span className="chat-reaction">2 acknowledgements</span>
                    </div>
                  </div>
                  <div className="chat-message">
                    <span className="mini-avatar second">JL</span>
                    <div>
                      <strong>
                        Jamie<span>9:18 AM</span>
                      </strong>
                      <p>
                        I’ll add my notes before our check-in. The research
                        files are in Storage.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
            {activeView === "meetings" && (
              <>
                <div className="preview-greeting">
                  <div>
                    <p className="eyebrow">Workspace meeting</p>
                    <h2>Get everyone on the same page.</h2>
                    <p>Video, screen sharing, and annotations together.</p>
                  </div>
                </div>
                <div className="meeting-example">
                  <div className="shared-screen">
                    <MonitorUp size={30} aria-hidden="true" />
                    <h3>Presentation review</h3>
                    <p>Example shared screen</p>
                    <div className="screen-lines">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                  <div className="meeting-people">
                    {["Alex", "Jamie", "Riley"].map((person) => (
                      <div key={person}>
                        <span className="mini-avatar">
                          {person.slice(0, 1)}
                        </span>
                        <span>{person}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            {activeView === "documents" && (
              <>
                <div className="preview-greeting">
                  <div>
                    <p className="eyebrow">School project / Docs</p>
                    <h2>Build the draft together.</h2>
                    <p>Shared rich-text documents with controlled access.</p>
                  </div>
                  <span className="preview-sample-badge">Workspace access</span>
                </div>
                <div className="document-example">
                  <div className="document-toolbar">
                    <strong>B</strong>
                    <em>I</em>
                    <span>Heading</span>
                    <span>Table</span>
                    <span>Image</span>
                    <span className="document-editors">AM · JL</span>
                  </div>
                  <div className="document-paper">
                    <h3>Research proposal</h3>
                    <p className="document-subtitle">
                      Project team · Working draft
                    </p>
                    <h4>Our objective</h4>
                    <p>
                      Understand how students coordinate deadlines across their
                      project groups and everyday commitments.
                    </p>
                    <h4>Next steps</h4>
                    <ul>
                      <li>Review the introduction together</li>
                      <li>Gather sources and research notes</li>
                      <li>Prepare the final presentation</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
            {activeView === "storage" && (
              <>
                <div className="preview-greeting">
                  <div>
                    <p className="eyebrow">Client team / Storage</p>
                    <h2>The right file. The latest version.</h2>
                    <p>Organized folders, previews, and version history.</p>
                  </div>
                </div>
                <div className="preview-files">
                  <div className="preview-file folder">
                    <FolderOpen size={30} aria-hidden="true" />
                    <strong>Campaign assets</strong>
                    <span>Workspace folder</span>
                  </div>
                  <div className="preview-file">
                    <FileText size={30} aria-hidden="true" />
                    <strong>Presentation.pdf</strong>
                    <span>
                      2.4 MB · <b>V2</b>
                    </span>
                    <span>Previous version available</span>
                  </div>
                  <div className="preview-file">
                    <FileText size={30} aria-hidden="true" />
                    <strong>Project brief.docx</strong>
                    <span>84 KB · V1</span>
                    <span>Team reference file</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="preview-statusbar">
            <span>
              <Bell size={13} aria-hidden="true" />
              Updates across your teams
            </span>
            <span>
              <Sparkles size={13} aria-hidden="true" />
              Plan with your whole workload in view
            </span>
          </div>
        </div>
      </div>
      <figcaption>
        Illustrative preview of LOFT features using sample data. Sign in to use
        your own workspaces.
      </figcaption>
    </figure>
  );
}
