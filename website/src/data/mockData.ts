import { TaskItem, Founder, Milestone, Testimonial, FAQItem, PricingPlan } from '../types';

export interface Workspace {
  id: string;
  name: string;
  badge: string;
  color: string;
  membersCount: number;
  unreadCount: number;
  role: string;
  avatarText: string;
}

export const WORKSPACES: Workspace[] = [
  {
    id: 'ervo',
    name: 'Ervo Digital',
    badge: 'Design Agency',
    color: '#15805D',
    membersCount: 14,
    unreadCount: 3,
    role: 'Partner & Lead',
    avatarText: 'ED',
  },
  {
    id: 'acme',
    name: 'Acme Global',
    badge: 'Client Corp',
    color: '#0D9488',
    membersCount: 48,
    unreadCount: 7,
    role: 'External Contractor',
    avatarText: 'AG',
  },
  {
    id: 'hyperscale',
    name: 'HyperScale AI',
    badge: 'SaaS Advisory',
    color: '#10B981',
    membersCount: 8,
    unreadCount: 1,
    role: 'Advisor',
    avatarText: 'HA',
  },
  {
    id: 'personal',
    name: 'Personal & Lab',
    badge: 'Private',
    color: '#059669',
    membersCount: 1,
    unreadCount: 0,
    role: 'Owner',
    avatarText: 'PL',
  },
];

export const INITIAL_TASKS: TaskItem[] = [
  {
    id: 't-1',
    title: 'Finalize Q3 Brand Design Guidelines & Figma Token Sync',
    workspace: 'Ervo Digital',
    category: 'Design Systems',
    priority: 'CRITICAL',
    deadline: 'Today, 5:00 PM',
    completed: false,
  },
  {
    id: 't-2',
    title: 'Review SOC2 Type II compliance audit questionnaire',
    workspace: 'Acme Global',
    category: 'Security & Ops',
    priority: 'CRITICAL',
    deadline: 'Tomorrow, 11:00 AM',
    completed: false,
  },
  {
    id: 't-3',
    title: 'Advisory board sprint review: Q4 AI Roadmap feedback',
    workspace: 'HyperScale AI',
    category: 'Strategy',
    priority: 'HIGH',
    deadline: 'Oct 8, 2026',
    completed: false,
  },
  {
    id: 't-4',
    title: 'Audit client billing statements and milestone sign-offs',
    workspace: 'Ervo Digital',
    category: 'Finance',
    priority: 'HIGH',
    deadline: 'Oct 9, 2026',
    completed: true,
  },
  {
    id: 't-5',
    title: 'Update OAuth 2.0 integration tokens for Linear webhook bridge',
    workspace: 'Acme Global',
    category: 'Engineering',
    priority: 'MEDIUM',
    deadline: 'Oct 12, 2026',
    completed: false,
  },
  {
    id: 't-6',
    title: 'Draft weekly newsletter on Async Work & Multi-Tenant Tools',
    workspace: 'Personal & Lab',
    category: 'Writing',
    priority: 'LOW',
    deadline: 'Oct 15, 2026',
    completed: false,
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'I consult for 4 different startups simultaneously. Before LOFT, I had 4 Chrome profiles open with 24 tabs each and constantly missed critical Slack pings. LOFT brought my life back.',
    name: 'Elena Rostova',
    role: 'Fractional Head of Product',
    company: 'Northstar Labs',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    metric: 'Saved 6.5 hours every week',
  },
  {
    quote:
      'The Smart Priority Feed alone is worth 10x the price. It surfaces the 3 things that actually need my attention across all our joint-venture teams without me wading through 400 unread pings.',
    name: 'Marcus Vance',
    role: 'Design Director & Studio Founder',
    company: 'Hyperion Creative Lab',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    metric: 'Zero missed client deliverables in 6 months',
  },
  {
    quote:
      'We require all our external contractors to use LOFT. It isolates sensitive client IP while giving them a unified inbox. Onboarding time dropped from 3 days to 15 minutes.',
    name: 'Sarah Chen',
    role: 'VP of Technology & Security',
    company: 'Apex Cloud Solutions',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    metric: 'Reduced contractor setup by 80%',
  },
];

export const FOUNDERS: Founder[] = [
  {
    name: 'Julian Sterling',
    role: 'Co-Founder & CEO',
    subtitle: 'Ex-Product Lead @ Linear & Stripe',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    bio: 'Spent 8 years battling context switching across multiple portfolio companies before deciding to architect the definitive multi-team OS.',
  },
  {
    name: 'Dr. Kimberly Zhao',
    role: 'Co-Founder & CTO',
    subtitle: 'Distributed Systems & Security Ph.D',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
    bio: 'Architected high-throughput cross-tenant isolation fabrics for cloud infrastructure. Passionate about end-to-end cryptographic workspace segregation.',
  },
  {
    name: 'Arjun Mehta',
    role: 'Head of Product & Design',
    subtitle: 'Former Design Systems Lead @ Figma',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
    bio: 'Obsessed with keyboard-first workflows, micro-interactions, and zero-latency interfaces that keep creative operators in deep flow.',
  },
];

export const MILESTONES: Milestone[] = [
  {
    date: 'January 2024',
    title: 'The Inception & First Prototype',
    description: 'Frustrated by juggling 5 Slack workspaces and 3 Notion orgs, the team built a lightweight local CLI proxy.',
    tag: 'Origin',
  },
  {
    date: 'September 2024',
    title: 'Seed Round & Private Alpha',
    description: 'Secured $4.2M seed funding backed by venture leaders in future-of-work software. 500 alpha teams onboarded.',
    tag: 'Funding',
  },
  {
    date: 'June 2025',
    title: 'SOC 2 Type II & Enterprise Isolation',
    description: 'Achieved stringent compliance standards with zero-trust cross-workspace isolation architecture.',
    tag: 'Security',
  },
  {
    date: 'Early 2026',
    title: 'LOFT 2.0 & 25,000+ Active Teams',
    description: 'Launched Universal Priority Matrix, Command+K Omnisearch, and native desktop bridges with 99.99% uptime.',
    tag: 'Scale',
  },
];

export const FAQS: FAQItem[] = [
  {
    category: 'General',
    question: 'How is LOFT different from Slack or Microsoft Teams?',
    answer:
      'Slack and Teams force you to keep multiple desktop instances open or constantly switch orgs in a dropdown, losing your draft messages and search context. LOFT is engineered from the ground up to treat multiple workspaces as first-class citizens in a single, unified command center with cross-workspace search and smart priority aggregation.',
  },
  {
    category: 'Security',
    question: 'Can my different clients or employers see each other’s data?',
    answer:
      'Never. LOFT uses strict cryptographic tenant segregation. Data from Workspace A is completely air-gapped from Workspace B. Permissions, member lists, and document keys never cross workspace boundaries.',
  },
  {
    category: 'Integrations',
    question: 'Do my clients also need to have LOFT installed?',
    answer:
      'No! LOFT integrates with your existing tools via native bridges (Slack, Google Workspace, Linear, Jira, GitHub, Notion). When you respond to a message or update a task in LOFT, it syncs directly back to the original platform.',
  },
  {
    category: 'Pricing',
    question: 'Can I try LOFT without entering a credit card?',
    answer:
      'Yes. Our Starter tier is completely free forever for up to 2 active workspaces. We also provide a full-featured 14-day free trial of our Pro plan with zero payment details required upfront.',
  },
  {
    category: 'Pricing',
    question: 'What happens if our team grows or we need custom billing?',
    answer:
      'You can dynamically add or remove seats at any time. We prorate all billing automatically. For teams larger than 50 users or organizations with custom vendor agreements, our Enterprise team provides custom invoice billing.',
  },
];

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Ideal for solo freelancers & independent contractors.',
    priceMonthly: 0,
    priceAnnually: 0,
    popular: false,
    ctaText: 'Get Started Free',
    features: [
      'Up to 2 connected workspaces',
      'Unified Task & Priority inbox',
      'Basic Command+K search',
      '5GB secure cloud storage',
      'Standard Slack & Google sync',
      'Community support forum',
    ],
  },
  {
    id: 'pro',
    name: 'Professional',
    tagline: 'For multi-client consultants, fractional leads & power users.',
    priceMonthly: 15,
    priceAnnually: 12,
    popular: true,
    ctaText: 'Start 14-Day Free Trial',
    features: [
      'Unlimited connected workspaces',
      'Smart Priority Feed (AI ranking)',
      'Global cross-workspace search',
      '100GB secure cloud storage',
      'Real-time bi-directional sync (Slack, Jira, Linear)',
      'Multi-Calendar cross-busy overlay',
      'Priority email & chat support',
    ],
  },
  {
    id: 'team',
    name: 'Team & Studio',
    tagline: 'For digital agencies, consultancies & distributed studios.',
    priceMonthly: 32,
    priceAnnually: 26,
    popular: false,
    ctaText: 'Start Team Trial',
    features: [
      'Everything in Pro, plus:',
      'Centralized team billing & seat manager',
      'Shared project spaces & guest portals',
      'Custom role-based permissions (RBAC)',
      'Activity audit trails & export',
      '1TB encrypted storage',
      'Dedicated Customer Success Manager',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For regulated enterprises requiring custom security & SLAs.',
    priceMonthly: 60,
    priceAnnually: 49,
    popular: false,
    ctaText: 'Talk to Enterprise Sales',
    features: [
      'Everything in Team, plus:',
      'SAML 2.0 / Okta / Azure SSO',
      'Custom Data Residency (EU, US, APAC)',
      '99.99% Uptime SLA agreement',
      'SIEM log streaming & DLP integration',
      'Custom API rate limits & webhooks',
      'Dedicated security review & BAA',
    ],
  },
];

export const INTEGRATIONS = [
  { name: 'Slack', category: 'Communication', icon: '💬', desc: 'Sync channels, DMs, and mentions across multiple instances without org hopping.' },
  { name: 'Linear', category: 'Project Tracking', icon: '📐', desc: 'Pull issues, cycles, and roadmaps directly into your daily priority view.' },
  { name: 'Google Workspace', category: 'Productivity', icon: '📂', desc: 'Aggregate Google Docs, Drive files, and Calendar events into one schedule.' },
  { name: 'Figma', category: 'Design', icon: '🎨', desc: 'Receive design comments, version approvals, and file shares in real-time.' },
  { name: 'GitHub', category: 'Development', icon: '🐙', desc: 'Track PR reviews, issues, and release notifications across multi-org repos.' },
  { name: 'Jira Software', category: 'Enterprise', icon: '⚡', desc: 'Bridge enterprise sprint tickets alongside freelance tasks seamlessly.' },
  { name: 'Notion', category: 'Knowledge Base', icon: '📝', desc: 'Search and link Notion wikis from distinct company workspaces.' },
  { name: 'Zoom', category: 'Video Calls', icon: '📹', desc: 'One-click meet launch across all team calendars with automatic mute sync.' },
];
