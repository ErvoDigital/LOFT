import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Calendar, 
  MessageSquare, 
  Plus, 
  Clock, 
  Building2, 
  Send,
  SlidersHorizontal
} from 'lucide-react';
import { WORKSPACES, INITIAL_TASKS } from '../data/mockData';
import { TaskItem } from '../types';

interface WorkspaceInteractiveDemoProps {
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onShowToast: (msg: string) => void;
}

export const WorkspaceInteractiveDemo: React.FC<WorkspaceInteractiveDemoProps> = ({
  onOpenAuth,
  onShowToast,
}) => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('all');
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_TASKS);
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'calendar'>('tasks');

  // Interactive mock chat state
  const [chatMessages, setChatMessages] = useState<{
    id: string;
    workspace: string;
    sender: string;
    role: string;
    avatar: string;
    text: string;
    time: string;
    tag?: string;
  }[]>([
    {
      id: 'm1',
      workspace: 'Ervo Digital',
      sender: 'Design Lead',
      role: 'Design Director',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
      text: 'Hey team, client approved the v2.4 component tokens! Can we do a quick review before deploying?',
      time: '10:42 AM',
      tag: 'Figma Sync',
    },
    {
      id: 'm2',
      workspace: 'Acme Global',
      sender: 'VP of Engineering',
      role: 'VP Tech',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
      text: 'Thanks for sending over the security questionnaire. Compliance confirmed we are all set for next week.',
      time: '11:15 AM',
      tag: 'SOC 2 Audit',
    },
    {
      id: 'm3',
      workspace: 'HyperScale AI',
      sender: 'Technical Advisor',
      role: 'Advisor',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
      text: 'Benchmark numbers for vector index are in: 4.2x latency drop. Ready to review whenever you have 10 mins.',
      time: '12:03 PM',
    },
  ]);
  const [newMessage, setNewMessage] = useState('');

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextState = !t.completed;
          onShowToast(nextState ? `Marked "${t.title.slice(0, 24)}..." as completed` : 'Task reopened');
          return { ...t, completed: nextState };
        }
        return t;
      })
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const currentWsName =
      selectedWorkspaceId === 'all'
        ? 'Ervo Digital'
        : WORKSPACES.find((w) => w.id === selectedWorkspaceId)?.name || 'Ervo Digital';

    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      workspace: currentWsName,
      category: 'General',
      priority: 'HIGH',
      deadline: 'Today, 6:00 PM',
      completed: false,
    };

    setTasks([newTask, ...tasks]);
    setNewTaskTitle('');
    onShowToast(`Added task to ${currentWsName}`);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const targetWs =
      selectedWorkspaceId === 'all'
        ? 'Ervo Digital'
        : WORKSPACES.find((w) => w.id === selectedWorkspaceId)?.name || 'Ervo Digital';

    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        workspace: targetWs,
        sender: 'You',
        role: 'Consultant / Lead',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        text: newMessage.trim(),
        time: 'Just now',
      },
    ]);
    setNewMessage('');
    onShowToast(`Message dispatched to ${targetWs}`);
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesWs =
      selectedWorkspaceId === 'all'
        ? true
        : task.workspace === WORKSPACES.find((w) => w.id === selectedWorkspaceId)?.name;
    const matchesPriority =
      priorityFilter === 'ALL' ? true : task.priority === priorityFilter;
    return matchesWs && matchesPriority;
  });

  const activeWorkspace = WORKSPACES.find((w) => w.id === selectedWorkspaceId);

  return (
    <div className="bg-[#0B1713] rounded-2xl shadow-2xl border border-[#1C3B31] overflow-hidden transition-all duration-300">
      {/* Top Application Bar Mockup */}
      <div className="bg-[#07110E] px-4 py-3 flex items-center justify-between text-xs text-[#8FAFA4] border-b border-[#162E25]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-[#FF5F56]/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-[#FFBD2E]/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-[#27C93F]/80 inline-block"></span>
          </div>
          <span className="font-semibold text-white tracking-wide flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#10B981]" />
            LOFT Unified Command Canvas
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <span className="bg-[#11241E] text-[#9FC0B4] px-2 py-0.5 rounded text-[11px] font-mono border border-[#1C3B31]">
            ⌘K Omnisearch
          </span>
          <span className="inline-flex items-center gap-1 text-[#34D399]">
            <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse"></span>
            4 Workspaces Synced
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left Sidebar: Workspace Switcher */}
        <div className="lg:col-span-3 bg-[#0A1612] border-r border-[#162E25] p-3 sm:p-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6D8F83]">
                Your Workspaces
              </span>
              <span className="text-[10px] bg-[#12241E] text-[#9FC0B4] font-bold px-1.5 py-0.5 rounded border border-[#1A382E]">
                4 Active
              </span>
            </div>

            {/* "All Workspaces / Unified" Tab */}
            <button
              id="ws-pill-all"
              onClick={() => {
                setSelectedWorkspaceId('all');
                onShowToast('Switched to Unified Cross-Workspace Feed');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                selectedWorkspaceId === 'all'
                  ? 'bg-[#132A21] border border-[#1F4839] text-white shadow-sm font-semibold'
                  : 'hover:bg-[#0E1F18] text-[#8FAFA4]'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#15805D] to-[#0F684B] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                ALL
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold truncate text-white">Unified Cross-View</p>
                  <span className="text-[10px] bg-[#15805D]/30 text-[#34D399] font-bold px-1.5 py-0.2 rounded-full border border-[#15805D]/40">
                    AI
                  </span>
                </div>
                <p className="text-[11px] text-[#6E9084]">All 4 connected spaces</p>
              </div>
            </button>

            {/* Individual Workspaces */}
            <div className="space-y-1.5">
              {WORKSPACES.map((ws) => {
                const isSelected = selectedWorkspaceId === ws.id;
                return (
                  <button
                    key={ws.id}
                    id={`ws-pill-${ws.id}`}
                    onClick={() => {
                      setSelectedWorkspaceId(ws.id);
                      onShowToast(`Active Workspace: ${ws.name}`);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#132A21] border border-[#1F4839] text-white shadow-sm font-semibold'
                        : 'hover:bg-[#0E1F18] text-[#8FAFA4]'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm"
                      style={{ backgroundColor: ws.color }}
                    >
                      {ws.avatarText}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate text-white">{ws.name}</p>
                        {ws.unreadCount > 0 && (
                          <span className="text-[10px] bg-[#15805D] text-white font-bold px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(21,128,93,0.5)]">
                            {ws.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#6E9084] truncate">
                        {ws.badge} • {ws.role}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Connect New Workspace CTA */}
          <div className="pt-4 border-t border-[#162E25]">
            <button
              onClick={() => onOpenAuth('signup')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-[#CBD5E1] bg-[#0E1F18] hover:bg-[#12261E] rounded-xl border border-[#1C3B31] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#10B981]" />
              Connect Another Org
            </button>
          </div>
        </div>

        {/* Center Canvas */}
        <div className="lg:col-span-9 p-4 sm:p-6 flex flex-col justify-between bg-[#0C1914]">
          <div>
            {/* Top Workspace Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#162E25] gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">
                    {selectedWorkspaceId === 'all'
                      ? 'Unified Priority & Focus Feed'
                      : activeWorkspace?.name}
                  </h3>
                  <span className="text-xs px-2 py-0.5 bg-[#12241E] text-[#9FC0B4] rounded-full font-medium border border-[#1C3B31]">
                    {selectedWorkspaceId === 'all'
                      ? 'Cross-Org Synced'
                      : `${activeWorkspace?.badge} • ${activeWorkspace?.membersCount} members`}
                  </span>
                </div>
                <p className="text-xs text-[#6E9084] mt-0.5">
                  Real-time bi-directional sync active across Slack, Linear, and Google Drive.
                </p>
              </div>

              {/* View Tabs */}
              <div className="flex items-center bg-[#07120E] p-1 rounded-xl border border-[#162E25]">
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    activeTab === 'tasks'
                      ? 'bg-[#15805D] text-white shadow-sm font-semibold'
                      : 'text-[#8FAFA4] hover:text-white'
                  }`}
                >
                  Priority Tasks ({tasks.filter((t) => !t.completed).length})
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'chat'
                      ? 'bg-[#15805D] text-white shadow-sm font-semibold'
                      : 'text-[#8FAFA4] hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Cross-Chat</span>
                </button>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'calendar'
                      ? 'bg-[#15805D] text-white shadow-sm font-semibold'
                      : 'text-[#8FAFA4] hover:text-white'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>Unified Schedule</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT: TASKS */}
            {activeTab === 'tasks' && (
              <div className="pt-4 space-y-4">
                {/* Filter and Add Task Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-xs text-[#6E9084] font-medium flex items-center gap-1 mr-1">
                      <SlidersHorizontal className="w-3 h-3" /> Filter:
                    </span>
                    {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriorityFilter(p)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                          priorityFilter === p
                            ? 'bg-[#15805D] text-white shadow-[0_0_8px_rgba(21,128,93,0.4)]'
                            : 'bg-[#12241E] text-[#8FAFA4] hover:bg-[#162E26] hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleAddTask} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add task across workspace..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="text-xs px-3 py-1.5 bg-[#12241E] border border-[#1C3B31] rounded-xl text-white placeholder:text-[#527469] focus:outline-none focus:border-[#22C55E] w-full sm:w-56"
                    />
                    <button
                      type="submit"
                      className="text-xs bg-[#15805D] hover:bg-[#126D4F] text-white px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 cursor-pointer shadow-sm"
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Task List */}
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {filteredTasks.length === 0 ? (
                    <div className="py-12 text-center text-[#6E9084] text-xs">
                      No tasks found matching this workspace & priority filter.
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 group ${
                          task.completed
                            ? 'bg-[#0E1B15]/70 border-[#152B23] opacity-60'
                            : 'bg-[#11241E] border-[#1C3B31] hover:border-[#265345] hover:bg-[#132A22]'
                        }`}
                      >
                        <button
                          type="button"
                          className="mt-0.5 text-[#5C7E74] group-hover:text-[#34D399] transition-colors"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-xs font-semibold text-white ${
                              task.completed ? 'line-through text-[#6E9084]' : ''
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2.5 mt-1.5 text-[11px] text-[#7E9F94]">
                            <span className="font-medium text-[#A7C4BA] bg-[#162D26] px-2 py-0.5 rounded border border-[#1F3D34]">
                              {task.workspace}
                            </span>
                            <span>•</span>
                            <span>{task.category}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[#7E9F94]">
                              <Clock className="w-3 h-3 text-[#5A7C71]" />
                              {task.deadline}
                            </span>
                          </div>
                        </div>

                        {/* Priority Badge */}
                        <div className="shrink-0">
                          {task.priority === 'CRITICAL' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-950/40 text-rose-300 border border-rose-800/60 rounded-md flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              CRITICAL
                            </span>
                          )}
                          {task.priority === 'HIGH' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-950/40 text-amber-300 border border-amber-800/60 rounded-md">
                              HIGH
                            </span>
                          )}
                          {task.priority === 'MEDIUM' && (
                            <span className="text-[10px] font-medium px-2 py-0.5 bg-teal-950/40 text-teal-300 border border-teal-800/60 rounded-md">
                              MEDIUM
                            </span>
                          )}
                          {task.priority === 'LOW' && (
                            <span className="text-[10px] font-medium px-2 py-0.5 bg-[#152D26] text-[#8FAFA4] rounded-md border border-[#1E3E34]">
                              LOW
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CROSS CHAT */}
            {activeTab === 'chat' && (
              <div className="pt-4 space-y-3">
                <div className="p-2.5 bg-[#12241E] rounded-xl text-xs text-[#9FC0B4] flex items-center justify-between border border-[#1C3B31]">
                  <span>
                    Unified stream across Slack & Teams. Messages route directly to native channels.
                  </span>
                  <span className="font-bold text-[10px] uppercase tracking-wider text-[#34D399] bg-[#15805D]/30 border border-[#15805D]/40 px-2 py-0.5 rounded">
                    Encrypted
                  </span>
                </div>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3 rounded-xl bg-[#11241E] border border-[#1C3B31] flex items-start gap-3"
                    >
                      <img
                        src={msg.avatar}
                        alt={msg.sender}
                        className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-[#1C3B31]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{msg.sender}</span>
                            <span className="text-[10px] text-[#7E9F94]">
                              {msg.workspace} • {msg.role}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#5C7E74]">{msg.time}</span>
                        </div>
                        <p className="text-xs text-[#CBD5E1] mt-1 leading-relaxed">{msg.text}</p>
                        {msg.tag && (
                          <span className="inline-block mt-1.5 text-[10px] font-semibold text-[#34D399] bg-[#15805D]/20 border border-[#15805D]/40 px-2 py-0.5 rounded">
                            {msg.tag}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder={`Reply to ${
                      selectedWorkspaceId === 'all' ? 'Ervo Digital' : activeWorkspace?.name
                    }...`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="text-xs px-3.5 py-2.5 bg-[#11241E] border border-[#1C3B31] text-white placeholder:text-[#527469] rounded-xl focus:outline-none focus:border-[#22C55E] flex-1"
                  />
                  <button
                    type="submit"
                    className="bg-[#15805D] text-white p-2.5 rounded-xl hover:bg-[#126D4F] transition-colors cursor-pointer shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: UNIFIED SCHEDULE */}
            {activeTab === 'calendar' && (
              <div className="pt-4 space-y-3">
                <div className="p-3 bg-[#12241E] border border-[#1C3B31] rounded-xl text-xs text-[#9FC0B4]">
                  LOFT aggregates your Google Calendar & Outlook calendars, displaying busy overlays to external teams without exposing sensitive private client details.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-[#1C3B31] bg-[#11241E]">
                    <span className="text-[10px] font-bold text-[#34D399] uppercase tracking-wider">
                      1:30 PM - 2:00 PM
                    </span>
                    <h5 className="text-xs font-bold text-white mt-1">Design Sync (Figma)</h5>
                    <p className="text-[11px] text-[#7E9F94] mt-0.5">Ervo Digital</p>
                    <span className="inline-block mt-2 text-[10px] bg-[#162D26] text-[#A7C4BA] border border-[#1F3D34] px-2 py-0.5 rounded font-mono">
                      Google Meet
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-[#1C3B31] bg-[#11241E]">
                    <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">
                      3:00 PM - 4:00 PM
                    </span>
                    <h5 className="text-xs font-bold text-white mt-1">Security Architecture Q&A</h5>
                    <p className="text-[11px] text-[#7E9F94] mt-0.5">Acme Global</p>
                    <span className="inline-block mt-2 text-[10px] bg-[#162D26] text-[#A7C4BA] border border-[#1F3D34] px-2 py-0.5 rounded font-mono">
                      Zoom Enterprise
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-[#1C3B31] bg-[#11241E]">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      4:30 PM - 5:15 PM
                    </span>
                    <h5 className="text-xs font-bold text-white mt-1">AI Sprint Pitch Review</h5>
                    <p className="text-[11px] text-[#7E9F94] mt-0.5">HyperScale AI</p>
                    <span className="inline-block mt-2 text-[10px] bg-[#162D26] text-[#A7C4BA] border border-[#1F3D34] px-2 py-0.5 rounded font-mono">
                      Huddle
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Interactive Bar */}
          <div className="pt-4 mt-4 border-t border-[#162E25] flex flex-col sm:flex-row items-center justify-between text-xs text-[#7E9F94] gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#34D399]"></span>
              <span>All 4 workspace tenants cryptographically isolated</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onShowToast('Press Cmd+K anytime to trigger global search')}
                className="hover:text-white font-medium cursor-pointer"
              >
                Try Cmd+K Search
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="text-white bg-[#15805D] hover:bg-[#126D4F] font-semibold px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-[0_2px_8px_rgba(21,128,93,0.3)]"
              >
                Launch Your Loft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
