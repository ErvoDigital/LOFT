import {
  Bell,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Palette,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import type { PageType } from "../types";

export const PAGES: {
  id: PageType;
  label: string;
  title: string;
  description: string;
}[] = [
  {
    id: "home",
    label: "Home",
    title: "LOFT — One home for all your teams",
    description:
      "Bring your teams, tasks, calendars, chat, meetings, documents, and files into LOFT. See your whole workload and catch conflicts across workspaces.",
  },
  {
    id: "features",
    label: "Features",
    title: "LOFT features — Plan, collaborate, and stay organized",
    description:
      "Explore LOFT’s shared workspaces, My Plan, task boards, conflict alerts, real-time chat, video meetings, collaborative documents, storage, and Lofty, our AI assistant.",
  },
  {
    id: "pricing",
    label: "Pricing",
    title: "LOFT pricing — Open Beta & Upcoming Freemium Release",
    description:
      "LOFT is currently in open beta with all workspace features unlocked. Experience the platform now ahead of our freemium official release.",
  },
  {
    id: "about",
    label: "About",
    title: "About LOFT — Built for life across teams",
    description:
      "LOFT helps people coordinate school, work, organizations, and community commitments in one place, with a personal view across independent teams.",
  },
];

export const FEATURES = [
  {
    id: "workspaces",
    group: "plan",
    Icon: Layers,
    title: "A space for every team",
    description:
      "Create separate workspaces for school, work, organizations, and community groups. Invite members and switch teams from one account.",
    details: [
      "Workspace overview and member management",
      "Email invitations and invite codes",
      "Admin, Manager, and Member roles",
    ],
  },
  {
    id: "dashboard",
    group: "plan",
    Icon: LayoutDashboard,
    title: "Your whole workload, together",
    description:
      "See upcoming events, pending tasks, recent activity, and files across the workspaces you belong to. Arrange dashboard widgets around what you need.",
    details: [
      "A personal dashboard across teams",
      "A two-week view of meetings and deadlines",
      "Customizable dashboard widgets",
    ],
  },
  {
    id: "conflicts",
    group: "plan",
    Icon: CalendarRange,
    title: "Catch conflicts across teams",
    description:
      "LOFT flags overlapping events, same-day task deadlines, and tasks due on meeting days across different workspaces, with links to the items involved.",
    details: [
      "Cross-workspace meeting overlaps",
      "Deadline clashes between independent teams",
      "Links to review the colliding tasks and events",
    ],
  },
  {
    id: "tasks",
    group: "plan",
    Icon: CheckSquare,
    title: "Tasks with a clear next step",
    description:
      "Organize work on drag-and-drop boards with configurable statuses, assignees, priority tiers, due dates, difficulty, effort estimates, and attachments.",
    details: [
      "Boards with customizable task statuses",
      "Assignments, deadlines, and attachments",
      "Smart Priority based on task and deadline signals",
    ],
  },
  {
    id: "my-plan",
    group: "plan",
    Icon: CalendarDays,
    title: "A plan that fits your day",
    description:
      "My Plan brings tasks and meetings together. Choose your daily work capacity, switch between day, week, and calendar views, and see work at risk.",
    details: [
      "Day-by-day, week, and calendar views",
      "Daily capacity and estimated effort",
      "At-risk tasks and a suggested focus",
    ],
  },
  {
    id: "calendar",
    group: "plan",
    Icon: CalendarDays,
    title: "Keep the team’s calendar close",
    description:
      "Create and update workspace events, add attendees, and browse month or week views. Your personal dashboard brings your teams’ schedules together.",
    details: [
      "Shared workspace calendars",
      "Event details, attendees, and meeting drafts",
      "Upcoming events across your workspaces",
    ],
  },
  {
    id: "chat",
    group: "collaborate",
    Icon: MessageSquare,
    title: "Conversations in context",
    description:
      "Keep discussions in workspace channels or direct messages, with typing indicators, mentions, attachments, and message reactions.",
    details: [
      "Workspace channels and direct messages",
      "Mentions, reactions, and file attachments",
      "Live messages and typing indicators",
    ],
  },
  {
    id: "meetings",
    group: "collaborate",
    Icon: Video,
    title: "Meet without leaving LOFT",
    description:
      "Start a workspace video call, share your screen, and annotate together. A floating mini-player keeps the call close while you visit other pages.",
    details: [
      "Camera and microphone controls",
      "Screen sharing and live annotations",
      "A persistent mini-player while you browse",
    ],
  },
  {
    id: "documents",
    group: "collaborate",
    Icon: FileText,
    title: "Write and edit together",
    description:
      "Collaborate on rich-text documents in real time. Format content, add tables and images, and export your work as PDF, Markdown, or HTML.",
    details: [
      "Shared rich-text editing",
      "Tables, images, and document organization",
      "Workspace-wide or assigned-member access",
    ],
  },
  {
    id: "storage",
    group: "collaborate",
    Icon: FolderOpen,
    title: "Files with their history intact",
    description:
      "Upload and organize files in nested folders. Add a new version to an existing entry and keep earlier versions available for review and download.",
    details: [
      "Drag-and-drop uploads and file previews",
      "Version history and authenticated downloads",
      "Nested folders with member access controls",
    ],
  },
  {
    id: "personalization",
    group: "access",
    Icon: Palette,
    title: "Make LOFT feel like yours",
    description:
      "Update your profile and avatar, choose light or dark mode, and personalize your accent colors. Appearance preferences are saved on your device.",
    details: [
      "Editable profile and avatar",
      "Light and dark appearance modes",
      "Preset and custom accent colors",
    ],
  },
  {
    id: "notifications",
    group: "access",
    Icon: Bell,
    title: "Stay in the loop",
    description:
      "Receive in-app notifications for assignments, events, invitations, meeting activity, and upcoming deadlines so updates stay close to the work.",
    details: [
      "Live in-app notifications",
      "Meeting and deadline reminders",
      "Updates linked to workspace activity",
    ],
  },
  {
    id: "permissions",
    group: "access",
    Icon: ShieldCheck,
    title: "Share with the right people",
    description:
      "Manage roles and feature access within each workspace, restrict folders and documents, and verify sign-in with an emailed code.",
    details: [
      "Workspace roles and member feature access",
      "Restricted folders and assigned documents",
      "Password or Google sign-in with email verification",
    ],
  },
  {
    id: "assistant",
    group: "access",
    Icon: Sparkles,
    title: "Meet Lofty, your AI assistant",
    description:
      "When Lofty, our AI assistant, is enabled, ask about tasks, events, priorities, and conflicts using text or voice. Review task and meeting proposals before confirming them.",
    details: [
      "Questions answered by Lofty about permitted tasks and events",
      "Text and voice interaction with speech services configured",
      "Task, meeting, and meeting-draft proposals you confirm",
    ],
  },
] as const;

export const FAQS = [
  {
    question: "Who is LOFT for?",
    answer:
      "LOFT is for people who belong to more than one team: students, professionals, project groups, organizations, and community groups. Each team gets its own workspace, while you get a personal view across your memberships.",
  },
  {
    question: "Is LOFT free to use?",
    answer:
      "Yes. LOFT is currently in open beta with all workspace features unlocked. When officially released, LOFT will feature a freemium model with a generous free tier alongside premium plans for advanced team and organizational needs.",
  },
  {
    question: "What does “Try for free” open?",
    answer:
      "It opens the LOFT login page to access the open beta. Sign in with your existing account, or choose the registration link to create a new account. LOFT verifies sign-in with an emailed code.",
  },
  {
    question: "Do my teams see each other’s work?",
    answer:
      "Workspace access is based on membership, roles, and feature permissions. Your personal dashboard combines work you can access; it does not grant one team access to another team’s workspace. Folders and documents can have additional member restrictions.",
  },
  {
    question: "How does LOFT spot schedule conflicts?",
    answer:
      "LOFT compares events and unfinished tasks across your workspaces. It flags overlapping events, tasks from different teams due on the same day, and tasks due on days with another team’s meeting. You can review the linked items and decide what to change.",
  },
  {
    question: "Does LOFT connect to other collaboration tools?",
    answer:
      "LOFT provides its own tasks, calendars, chat, meetings, documents, and storage. Google sign-in is supported; syncing Slack, Notion, Jira, or other external workspaces is not currently part of the service.",
  },
  {
    question: "What can Lofty, our AI assistant, do?",
    answer:
      "When enabled, Lofty can read permitted tasks and events, explain priorities and conflicts, and propose tasks, meetings, or meeting drafts. You review and confirm proposals before they are saved. Automatic scheduling and live meeting transcription are not currently available.",
  },
];
