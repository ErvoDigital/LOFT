import React, { useState } from 'react';
import { 
  Home, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  Settings, 
  Plus, 
  Bell, 
  Sun, 
  Kanban, 
  Video, 
  Search, 
  FileText, 
  Image as ImageIcon,
  CheckCircle2,
  PanelLeftClose,
  ExternalLink
} from 'lucide-react';

interface LoftWorkspaceDashboardProps {
  onShowToast?: (msg: string) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

export const LoftWorkspaceDashboard: React.FC<LoftWorkspaceDashboardProps> = ({
  onShowToast,
  isFullScreen = false,
  onToggleFullScreen,
}) => {
  const [activeNav, setActiveNav] = useState<'home' | 'calendar' | 'chat'>('home');
  const [activeWorkspace, setActiveWorkspace] = useState<'loft' | 'ervo'>('ervo');
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [searchFileQuery, setSearchFileQuery] = useState('');
  const [tasks, setTasks] = useState([
    {
      id: 'task-1',
      title: 'QA application',
      dueDate: 'SEPT 22',
      lateNotice: '11 days late • 1h',
      priority: 'Medium',
      assignee: 'QA',
      assigneeColor: 'bg-[#0D9488]',
      completed: false,
    },
    {
      id: 'task-2',
      title: 'UI/UX Development',
      dueDate: 'SEPT 22',
      lateNotice: '11 days late • 4h',
      priority: 'Medium',
      assignee: 'UI',
      assigneeColor: 'bg-[#10B981]',
      completed: false,
    },
    {
      id: 'task-3',
      title: 'Backend Integration',
      dueDate: 'SEPT 22',
      lateNotice: '11 days late • 4h',
      priority: 'Medium',
      assignee: 'BE',
      assigneeColor: 'bg-[#15805D]',
      completed: false,
    },
  ]);

  const toggleTask = (id: string, title: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const next = !t.completed;
          if (onShowToast) {
            onShowToast(next ? `Completed: ${title}` : `Reopened: ${title}`);
          }
          return { ...t, completed: next };
        }
        return t;
      })
    );
  };

  const files = [
    {
      id: 'f1',
      name: 'Workspace_Asset_Export_2026.png',
      size: '2.1 MB',
      date: '22d ago',
      type: 'image',
    },
    {
      id: 'f2',
      name: 'loft-color-palette-v2.html',
      size: '13.0 KB',
      date: '24d ago',
      type: 'code',
    },
    {
      id: 'f3',
      name: 'Design_System_SplashScreen_v2.4.fig',
      size: '384.2 KB',
      date: '26d ago',
      type: 'doc',
    },
  ];

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchFileQuery.toLowerCase())
  );

  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="bg-[#050C0A] text-white rounded-2xl border border-[#162E25] shadow-2xl overflow-hidden font-sans select-none">
      {/* Browser Bar Mockup */}
      <div className="bg-[#091511] px-4 py-2 flex items-center justify-between text-xs text-[#7E9F94] border-b border-[#142921]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/80 inline-block"></span>
          </div>
          <span className="text-[11px] font-mono text-[#5A7C71] hidden sm:inline truncate">
            loft-client.vercel.app/workspaces/1540545b-2e44-419a-af46-7fddda6af80f/dashboard
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] bg-[#12241E] text-[#34D399] px-2 py-0.5 rounded-full font-mono border border-[#1C3B31]">
            Active Session
          </span>
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="text-[#8FAFA4] hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
            >
              {isFullScreen ? 'Exit Full View' : 'Full Screen'}
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-[720px] bg-[#07130F]">
        {/* Left Sidebar Icon Rail (Matches exact UI) */}
        <aside className="w-16 bg-[#07130F] border-r border-[#142A22] flex flex-col items-center py-4 justify-between shrink-0">
          <div className="flex flex-col items-center gap-4 w-full">
            {/* Top Collapse Button */}
            <button 
              onClick={() => onShowToast && onShowToast('Workspace navigation')}
              className="p-2 text-[#5E8276] hover:text-white transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>

            {/* Selected Workspace (Green "L" square) */}
            <button
              onClick={() => {
                setActiveWorkspace('loft');
                if (onShowToast) onShowToast('Switched to LOFT Main Hub');
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm transition-all cursor-pointer ${
                activeWorkspace === 'loft'
                  ? 'bg-[#15805D] text-white shadow-[0_0_12px_rgba(21,128,93,0.5)] ring-2 ring-[#22C55E]/40'
                  : 'bg-[#10241E] text-[#8FAFA4] hover:text-white'
              }`}
            >
              L
            </button>

            {/* Navigation Icons */}
            <div className="flex flex-col items-center gap-3 pt-2">
              <button
                onClick={() => setActiveNav('home')}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'home'
                    ? 'text-white bg-[#10251E]'
                    : 'text-[#5E8276] hover:text-white hover:bg-[#0E1E18]'
                }`}
                title="Home Dashboard"
              >
                <Home className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setActiveNav('calendar');
                  if (onShowToast) onShowToast('Viewing Week Calendar view');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'calendar'
                    ? 'text-white bg-[#10251E]'
                    : 'text-[#5E8276] hover:text-white hover:bg-[#0E1E18]'
                }`}
                title="Calendar"
              >
                <CalendarIcon className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setActiveNav('chat');
                  if (onShowToast) onShowToast('Opened Team Chat feed');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  activeNav === 'chat'
                    ? 'text-white bg-[#10251E]'
                    : 'text-[#5E8276] hover:text-white hover:bg-[#0E1E18]'
                }`}
                title="Chat"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>

            {/* Workspace Divider */}
            <div className="w-7 h-[1px] bg-[#142A22] my-1" />

            {/* Second Workspace: Ervo Digital Logo */}
            <button
              onClick={() => {
                setActiveWorkspace('ervo');
                if (onShowToast) onShowToast('Active Workspace: Ervo Digital');
              }}
              className={`w-9 h-9 rounded-xl bg-black border flex items-center justify-center p-1 transition-all cursor-pointer ${
                activeWorkspace === 'ervo'
                  ? 'border-[#22C55E] shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                  : 'border-[#1C3B31] opacity-70 hover:opacity-100'
              }`}
              title="Ervo Digital"
            >
              <div className="text-[7px] font-black uppercase text-[#22C55E] leading-tight text-center">
                ERVO
              </div>
            </button>

            {/* Add Workspace Plus Icon */}
            <button
              onClick={() => onShowToast && onShowToast('Connect another workspace')}
              className="w-8 h-8 rounded-full border border-dashed border-[#234A3E] text-[#5E8276] hover:text-white hover:border-[#34D399] flex items-center justify-center transition-all cursor-pointer"
              title="Add workspace"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottom Settings Icon */}
          <button
            onClick={() => onShowToast && onShowToast('Workspace Settings')}
            className="p-2 text-[#5E8276] hover:text-white transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </aside>

        {/* Main Content Dashboard Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Header Bar */}
          <header className="h-14 px-6 border-b border-[#142A22] flex items-center justify-between shrink-0 bg-[#07130F]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-wide">
                Ervo Digital
              </span>
              <span className="text-[#5A7C71]">•</span>
              <span className="text-xs text-[#8FAFA4] font-medium">Overview</span>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => onShowToast && onShowToast('Toggle brightness')}
                className="text-[#6D9185] hover:text-white transition-colors"
                title="Toggle Theme"
              >
                <Sun className="w-4 h-4" />
              </button>

              <button
                onClick={() => onShowToast && onShowToast('1 unread notification')}
                className="relative text-[#6D9185] hover:text-white transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#EF4444] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  1
                </span>
              </button>

              {/* User Avatar */}
              <div
                className="w-7 h-7 rounded-full bg-[#15805D] text-white text-xs font-bold flex items-center justify-center shadow-sm ring-2 ring-[#07130F]"
                title="Workspace Lead"
              >
                WL
              </div>
            </div>
          </header>

          {/* Dashboard Canvas Container */}
          <main className="p-6 space-y-6 flex-1 overflow-x-hidden">
            {/* HERO BANNER CARD (Exact match to design) */}
            <div className="relative rounded-3xl bg-gradient-to-r from-[#0C221A] via-[#0D261D] to-[#0A1D16] border border-[#1C4235] p-6 sm:p-8 overflow-hidden shadow-xl">
              {/* Subtle background graduation cap illustration outline */}
              <div className="absolute right-40 top-1/2 -translate-y-1/2 w-48 h-48 opacity-10 pointer-events-none stroke-[#22C55E]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
              </div>

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Left Section */}
                <div className="flex items-start gap-4">
                  {/* Ervo Digital Brand Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-black border border-[#224C3D] flex items-center justify-center p-2 shrink-0 shadow-md">
                    <span className="text-[10px] font-black uppercase text-[#22C55E] tracking-tight text-center leading-none">
                      ERVO<br />DIGITAL
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#34D399]">
                      SCHOOL • SATURDAY 3 OCTOBER
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      Ervo Digital
                    </h2>
                    <p className="text-xs sm:text-sm text-[#8FAFA4]">
                      {3 - completedCount} open tasks, 3 overdue. Nothing on the calendar this week.
                    </p>

                    {/* Action buttons & members */}
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        onClick={() => {
                          setBoardModalOpen(true);
                          if (onShowToast) onShowToast('Opened Kanban Board view');
                        }}
                        className="px-4 py-2 rounded-xl bg-white text-neutral-900 text-xs font-bold hover:bg-neutral-100 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Kanban className="w-3.5 h-3.5" />
                        <span>Open board</span>
                      </button>

                      <button
                        onClick={() => {
                          setScheduleModalOpen(true);
                          if (onShowToast) onShowToast('Schedule opened');
                        }}
                        className="px-4 py-2 rounded-xl bg-[#142E25]/90 hover:bg-[#18382D] text-white text-xs font-semibold border border-[#21493B] transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CalendarIcon className="w-3.5 h-3.5 text-[#34D399]" />
                        <span>Schedule</span>
                      </button>

                      {/* Overlapping member avatars */}
                      <div className="flex items-center pl-2">
                        <div className="flex -space-x-2">
                          <span className="w-6 h-6 rounded-full bg-[#15805D] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#0C221A]">
                            ED
                          </span>
                          <span className="w-6 h-6 rounded-full bg-[#0D9488] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#0C221A]">
                            UI
                          </span>
                          <span className="w-6 h-6 rounded-full bg-[#10B981] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#0C221A]">
                            QA
                          </span>
                        </div>
                        <span className="text-xs text-[#8FAFA4] ml-2 font-medium">
                          4 members
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Progress Ring & Task Statistics */}
                <div className="flex items-center gap-6 bg-[#081712]/80 border border-[#16362A] p-4 rounded-2xl shrink-0">
                  {/* Circular 0% Progress Gauge */}
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-[#1A382E]"
                        strokeWidth="3.2"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className={progressPercent > 0 ? "text-[#10B981]" : "text-[#EF4444]"}
                        strokeDasharray={`${progressPercent}, 100`}
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-sm font-extrabold text-white">
                        {progressPercent}%
                      </span>
                      <span className="text-[9px] text-[#7E9F94] font-medium leading-none">
                        {completedCount} of 3 done
                      </span>
                    </div>
                  </div>

                  {/* Legend Counts */}
                  <div className="space-y-1.5 text-xs text-[#8FAFA4] min-w-[100px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                        <span>Overdue</span>
                      </span>
                      <span className="font-bold text-white">{3 - completedCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                        <span>Due today</span>
                      </span>
                      <span className="font-bold text-white">0</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#64748B]"></span>
                        <span>Later</span>
                      </span>
                      <span className="font-bold text-white">0</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#34D399]"></span>
                        <span>Done</span>
                      </span>
                      <span className="font-bold text-white">{completedCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MIDDLE ROW: THIS WEEK & MEETING ROOM */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* "This week" Calendar Card (col-span-8) */}
              <div className="lg:col-span-8 bg-[#091712] border border-[#163126] rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">This week</h3>
                    <p className="text-[11px] text-[#6E9084]">3 Oct – 9 • 0 events • 0 due</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#7E9F94]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-[#475569]"></span> Event
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-xs bg-[#EF4444]"></span> Task due, by priority
                    </span>
                    <button
                      onClick={() => onShowToast && onShowToast('Full calendar opened')}
                      className="text-[#34D399] hover:underline font-semibold cursor-pointer"
                    >
                      Full calendar
                    </button>
                  </div>
                </div>

                {/* 7 Days Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* SAT 3 (TODAY) */}
                  <div className="bg-[#0D241C] border border-[#214F3E] rounded-xl p-3 flex flex-col justify-between min-h-[140px] shadow-sm">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#8FAFA4] uppercase">SAT</span>
                        <span className="text-[9px] font-extrabold bg-[#15805D] text-white px-1.5 py-0.2 rounded-full">
                          TODAY
                        </span>
                      </div>
                      <div className="text-xl font-extrabold text-[#34D399] mt-1">3</div>
                    </div>
                    <span className="text-[10px] text-[#5A7C71]">Weekend</span>
                  </div>

                  {/* SUN 4 */}
                  <div className="bg-[#091712] border border-[#142A21] rounded-xl p-3 flex flex-col justify-between min-h-[140px] opacity-80">
                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase">SUN</span>
                      <div className="text-xl font-bold text-[#64748B] mt-1">4</div>
                    </div>
                    <span className="text-[10px] text-[#475569]">Weekend</span>
                  </div>

                  {/* MON 5 */}
                  <div className="bg-[#0A1B15] border border-[#163126] rounded-xl p-3 flex flex-col justify-between min-h-[140px]">
                    <div>
                      <span className="text-[10px] font-bold text-[#8FAFA4] uppercase">MON</span>
                      <div className="text-xl font-bold text-white mt-1">5</div>
                    </div>
                    <span className="text-[10px] text-[#5A7C71]">Open</span>
                  </div>

                  {/* TUE 6 */}
                  <div className="bg-[#0A1B15] border border-[#163126] rounded-xl p-3 flex flex-col justify-between min-h-[140px]">
                    <div>
                      <span className="text-[10px] font-bold text-[#8FAFA4] uppercase">TUE</span>
                      <div className="text-xl font-bold text-white mt-1">6</div>
                    </div>
                    <span className="text-[10px] text-[#5A7C71]">Open</span>
                  </div>

                  {/* WED 7 */}
                  <div className="bg-[#0A1B15] border border-[#163126] rounded-xl p-3 flex flex-col justify-between min-h-[140px]">
                    <div>
                      <span className="text-[10px] font-bold text-[#8FAFA4] uppercase">WED</span>
                      <div className="text-xl font-bold text-white mt-1">7</div>
                    </div>
                    <span className="text-[10px] text-[#5A7C71]">Open</span>
                  </div>

                  {/* THU 8 */}
                  <div className="bg-[#0A1B15] border border-[#163126] rounded-xl p-3 flex flex-col justify-between min-h-[140px]">
                    <div>
                      <span className="text-[10px] font-bold text-[#8FAFA4] uppercase">THU</span>
                      <div className="text-xl font-bold text-white mt-1">8</div>
                    </div>
                    <span className="text-[10px] text-[#5A7C71]">Open</span>
                  </div>

                  {/* FRI 9 */}
                  <div className="bg-[#0A1B15] border border-[#163126] rounded-xl p-3 flex flex-col justify-between min-h-[140px]">
                    <div>
                      <span className="text-[10px] font-bold text-[#8FAFA4] uppercase">FRI</span>
                      <div className="text-xl font-bold text-white mt-1">9</div>
                    </div>
                    <span className="text-[10px] text-[#5A7C71]">Open</span>
                  </div>
                </div>
              </div>

              {/* "Meeting room" Card (col-span-4) */}
              <div className="lg:col-span-4 bg-[#091712] border border-[#163126] rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Meeting room</h3>
                </div>

                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0E241C] text-[#34D399] border border-[#193F31] flex items-center justify-center mx-auto shadow-inner">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">No meeting scheduled</h4>
                    <p className="text-xs text-[#7E9F94] mt-0.5">
                      Nobody&apos;s in the room right now.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMeetingModalOpen(true);
                    if (onShowToast) onShowToast('Instant meeting room launched');
                  }}
                  className="w-full py-2.5 px-4 bg-[#10241D] hover:bg-[#142E25] text-white text-xs font-semibold rounded-xl border border-[#1E4336] transition-all cursor-pointer shadow-sm"
                >
                  Schedule a meeting
                </button>
              </div>
            </div>

            {/* BOTTOM ROW (3 COLUMNS: UP NEXT, TEAM CHAT, RECENT FILES) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 1. "Up next" Tasks Column */}
              <div className="lg:col-span-4 bg-[#091712] border border-[#163126] rounded-2xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">Up next</h3>
                      <p className="text-[11px] text-[#6E9084]">Open tasks by due date, most urgent first</p>
                    </div>
                    <button
                      onClick={() => setBoardModalOpen(true)}
                      className="text-xs text-[#34D399] hover:underline font-semibold cursor-pointer"
                    >
                      View board
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#EF4444] font-bold pt-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                    <span>OVERDUE {tasks.filter((t) => !t.completed).length}</span>
                  </div>

                  <div className="space-y-2.5">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => toggleTask(task.id, task.title)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          task.completed
                            ? 'bg-[#06110D]/50 border-[#12241E] opacity-50'
                            : 'bg-[#0D211A] border-[#18392C] hover:border-[#225542] hover:bg-[#10281F]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Red Date Box */}
                          <div className="w-10 h-10 rounded-lg bg-[#2E1114] border border-[#521C22] flex flex-col items-center justify-center shrink-0">
                            <span className="text-[8px] font-black text-rose-300 uppercase leading-none">
                              SEPT
                            </span>
                            <span className="text-xs font-black text-rose-400 leading-none mt-0.5">
                              22
                            </span>
                          </div>

                          <div className="min-w-0">
                            <h5 className={`text-xs font-bold truncate ${task.completed ? 'line-through text-[#6E9084]' : 'text-white'}`}>
                              {task.title}
                            </h5>
                            <p className="text-[10px] text-[#7E9F94] mt-0.5 truncate">
                              {task.completed ? 'Done' : task.lateNotice}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] bg-[#123126] text-[#34D399] font-semibold px-2 py-0.5 rounded-full border border-[#1B4B39]">
                            {task.priority}
                          </span>
                          <span className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${task.assigneeColor}`}>
                            {task.assignee}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#142A22] text-[11px] text-[#5A7C71] flex items-center justify-between">
                  <span>Click task to mark done</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
                </div>
              </div>

              {/* 2. "Team chat" Column */}
              <div className="lg:col-span-4 bg-[#091712] border border-[#163126] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <h3 className="text-sm font-bold text-white">Team chat</h3>
                  <button
                    onClick={() => onShowToast && onShowToast('Channel chat opened')}
                    className="text-xs text-[#34D399] hover:underline font-semibold cursor-pointer"
                  >
                    Open chat
                  </button>
                </div>

                <div className="space-y-3.5 max-h-[310px] overflow-y-auto pr-1">
                  {/* Message 1 */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#15805D] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      PL
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">
                          Product Lead
                        </span>
                        <span className="text-[10px] text-[#5A7C71]">17d ago</span>
                      </div>
                      <p className="text-xs text-[#CBD5E1] mt-0.5">🚀</p>
                    </div>
                  </div>

                  {/* Message 2 */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#0D9488] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      DS
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">Design Systems</span>
                        <span className="text-[10px] text-[#5A7C71]">17d ago</span>
                      </div>
                      <p className="text-xs text-[#8FAFA4] mt-0.5 leading-relaxed">
                        All deliverables reviewed and approved.
                      </p>
                    </div>
                  </div>

                  {/* Message 3 */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#10B981] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      ENG
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">
                          Engineering Lead
                        </span>
                        <span className="text-[10px] text-[#5A7C71]">17d ago</span>
                      </div>
                      <p className="text-xs text-[#8FAFA4] mt-0.5 leading-relaxed">
                        Did you check the latest release tokens?
                      </p>
                    </div>
                  </div>

                  {/* Message 4 */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#10B981] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      ENG
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">
                          Engineering Lead
                        </span>
                        <span className="text-[10px] text-[#5A7C71]">17d ago</span>
                      </div>
                      <p className="text-xs text-[#8FAFA4] mt-0.5 leading-relaxed">
                        Merged cleanly into production branch.
                      </p>
                    </div>
                  </div>

                  {/* Message 5 */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#059669] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      FE
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate">
                          Frontend Architect
                        </span>
                        <span className="text-[10px] text-[#5A7C71]">17d ago</span>
                      </div>
                      <p className="text-[11px] text-[#6E9084] mt-0.5 truncate font-mono">
                        @[Engineering Lead] confirmed the new design system components.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. "Recent files" Column */}
              <div className="lg:col-span-4 bg-[#091712] border border-[#163126] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <h3 className="text-sm font-bold text-white">Recent files</h3>
                  <button
                    onClick={() => onShowToast && onShowToast('All workspace files')}
                    className="text-xs text-[#34D399] hover:underline font-semibold cursor-pointer"
                  >
                    All files
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#5A7C71] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchFileQuery}
                    onChange={(e) => setSearchFileQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-[#0D211A] border border-[#193F31] rounded-xl text-white placeholder:text-[#527469] focus:outline-none focus:border-[#22C55E]"
                  />
                </div>

                <div className="space-y-2.5">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => onShowToast && onShowToast(`Opened ${file.name}`)}
                      className="p-2.5 rounded-xl bg-[#0D211A] border border-[#193F31] hover:border-[#245B47] hover:bg-[#10271F] transition-all cursor-pointer flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#142F24] text-[#34D399] flex items-center justify-center shrink-0 border border-[#1F493B]">
                        {file.type === 'image' ? (
                          <ImageIcon className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-[#6E9084] mt-0.5">
                          {file.size} • {file.date}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
