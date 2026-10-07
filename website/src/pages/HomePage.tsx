import React from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  Play, 
  ShieldCheck, 
  Zap, 
  Layers, 
  Search, 
  CheckCircle2, 
  Command 
} from 'lucide-react';
import { PageType } from '../types';
import { LoftWorkspaceDashboard } from '../components/LoftWorkspaceDashboard';

interface HomePageProps {
  onNavigate: (page: PageType) => void;
  onGetStarted: () => void;
  onOpenVideoDemo: () => void;
  onOpenCommandK: () => void;
  onShowToast: (msg: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onGetStarted,
  onOpenVideoDemo,
  onOpenCommandK,
  onShowToast,
}) => {
  return (
    <div className="space-y-24 pb-20 ambient-glow">
      {/* HERO SECTION */}
      <section className="pt-12 sm:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative">
        {/* Glow backdrop behind hero */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#15805D]/15 blur-[120px] pointer-events-none rounded-full" />

        {/* Release Pill */}
        <div 
          onClick={() => onShowToast('v2.4 features: Omnisearch, Slack 2-way bridge, & SOC2 vault isolation')}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0E201A] border border-[#1C3B31] shadow-md text-xs font-semibold text-[#CBD5E1] mb-8 hover:border-[#10B981] transition-all cursor-pointer relative z-10"
        >
          <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]"></span>
          <span>v2.4 Release: Universal Cross-Workspace Omnisearch</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#5C7E74]" />
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] max-w-4xl mx-auto relative z-10">
          One home for all your teams.{' '}
          <span className="text-[#34D399] block sm:inline">
            No more app switching.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-[#8FAFA4] max-w-2xl mx-auto leading-relaxed relative z-10">
          LOFT pulls chats, tasks, schedules, and files into one unified workspace.
          Engineered for consultants, agency operators, and builders who belong to multiple organizations.
        </p>

        {/* Action Buttons (Get Started Free with no sign-in required) */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto relative z-10">
          <button
            id="hero-getstarted-cta"
            onClick={onGetStarted}
            className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white font-bold text-sm rounded-xl transition-all shadow-[0_4px_20px_rgba(21,128,93,0.35)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer border border-[#235848]/50"
          >
            <span>Get Started Free</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            id="hero-watchdemo-cta"
            onClick={onOpenVideoDemo}
            className="w-full sm:w-auto px-6 py-3.5 bg-[#0E201A] hover:bg-[#12241E] text-white font-semibold text-sm rounded-xl border border-[#1C3B31] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Play className="w-4 h-4 fill-[#34D399] text-[#34D399]" />
            <span>Interactive Tour</span>
          </button>
        </div>

        {/* Quick Micro-Trust Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-[#7E9F94] relative z-10">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
            <span>Instant setup • No sign in needed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>SOC 2 Type II Encrypted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Command className="w-3.5 h-3.5 text-[#5C7E74]" />
            <span>Press Cmd+K anytime</span>
          </div>
        </div>

        {/* REPLACED SANDBOX WITH THE EXACT LOFT WORKSPACE DASHBOARD */}
        <div id="live-workspace-section" className="mt-14 max-w-6xl mx-auto relative z-10">
          <div className="text-left mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6E9084]">
              <Sparkles className="w-3.5 h-3.5 text-[#34D399]" />
              <span>Ervo Digital Workspace • Overview</span>
            </div>
            <button
              onClick={onOpenCommandK}
              className="text-xs font-semibold text-[#34D399] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Try Command+K Omnisearch</span>
              <Command className="w-3 h-3" />
            </button>
          </div>

          {/* Real Workspace Dashboard Component */}
          <LoftWorkspaceDashboard onShowToast={onShowToast} />
        </div>
      </section>

      {/* LOGO STRIP SECTION */}
      <section className="border-y border-[#12241E] bg-[#050C0A]/70 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[#5C7E74] mb-6">
            Empowering cross-team leaders, agencies, and fractional executives worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 opacity-60 hover:opacity-100 transition-all duration-300">
            <span className="font-extrabold text-xl tracking-tighter text-white">FIGMA</span>
            <span className="font-extrabold text-xl tracking-tighter text-white">LINEAR</span>
            <span className="font-extrabold text-xl tracking-tighter text-white">STRIPE</span>
            <span className="font-extrabold text-xl tracking-tighter text-white">NOTION</span>
            <span className="font-extrabold text-xl tracking-tighter text-white">VERCEL</span>
            <span className="font-extrabold text-xl tracking-tighter text-white">FRAMER</span>
          </div>
        </div>
      </section>

      {/* THE MULTI-WORKSPACE CHAOS PROBLEM VS LOFT SOLUTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
            The Multi-Tenant Problem
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
            Why managing 3+ teams feels like a full-time logistical crisis.
          </h2>
          <p className="text-[#8FAFA4] mt-4 text-sm sm:text-base leading-relaxed">
            Existing collaboration tools were built around a single corporate domain. When you work across client accounts, you pay the cognitive tax.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* The Old Way */}
          <div className="bg-[#120B0D] border border-rose-950/60 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <span>✕ The Exhausting Reality</span>
            </div>
            <h3 className="text-xl font-bold text-white">
              Tab bankruptcy, missed pings, and cross-posting dread.
            </h3>
            <ul className="space-y-3 text-xs sm:text-sm text-[#A89FA2]">
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-white">4 separate Chrome profiles</strong> hogging 12GB of RAM just to stay logged into different client Slacks.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-white">Missed high-priority deliverables</strong> buried under hundreds of non-urgent channels and random banter.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-white">Accidental cross-client leaks</strong>: Sending a confidential proposal into the wrong Slack org.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-white">Calendar collisions</strong>: Client A schedules over Client B because neither sees your real availability.
                </span>
              </li>
            </ul>
          </div>

          {/* The LOFT Way */}
          <div className="bg-[#0A1A14] border border-[#1C4436] rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#34D399] font-bold text-xs uppercase tracking-wider">
              <span>✓ The LOFT Standard</span>
            </div>
            <h3 className="text-xl font-bold text-white">
              One unified cockpit with air-gapped cryptographic security.
            </h3>
            <ul className="space-y-3 text-xs sm:text-sm text-[#A7C8BD]">
              <li className="flex items-start gap-2.5">
                <span className="text-[#34D399] font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-white">Single unified login</strong>: Switch between 10 client or internal workspaces in under 100 milliseconds.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#34D399] font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-white">Smart Priority Engine</strong>: Surfaces the 5 tasks and mentions that truly matter across all workspaces.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#34D399] font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-white">Zero-Leak Architecture</strong>: Tenant tokens are isolated in local secure enclaves with zero shared state.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#34D399] font-bold mt-0.5">•</span>
                <span>
                  <strong className="text-white">Privacy-Preserving Cross-Calendar</strong>: Shows your real availability across orgs without leaking event titles.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
            Engineered For Focus
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
            Every layer built for cross-team high performers.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0B1713] p-6 sm:p-8 rounded-2xl border border-[#1C3B31] shadow-sm hover:border-[#275345] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center mb-5">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">
              Cross-Org Priority Matrix
            </h4>
            <p className="text-xs sm:text-sm text-[#8FAFA4] leading-relaxed">
              Don’t check 5 inboxes every morning. LOFT aggregates your deadlines and direct mentions into a singular prioritized daily queue.
            </p>
          </div>

          <div className="bg-[#0B1713] p-6 sm:p-8 rounded-2xl border border-[#1C3B31] shadow-sm hover:border-[#275345] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center mb-5">
              <Search className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">
              Command+K Omnisearch
            </h4>
            <p className="text-xs sm:text-sm text-[#8FAFA4] leading-relaxed">
              Query files, Jira tickets, Notion pages, and Slack threads across every tenant simultaneously. Sub-50ms instant local indexing.
            </p>
          </div>

          <div className="bg-[#0B1713] p-6 sm:p-8 rounded-2xl border border-[#1C3B31] shadow-sm hover:border-[#275345] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center mb-5">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">
              Instant Workspace Dock
            </h4>
            <p className="text-xs sm:text-sm text-[#8FAFA4] leading-relaxed">
              Jump from your agency workspace to your enterprise client in a single keystroke. Clean notification badges without noise.
            </p>
          </div>
        </div>

        {/* Deep Dive Action */}
        <div className="text-center mt-10">
          <button
            onClick={() => {
              onNavigate('features');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-xs font-bold text-[#34D399] hover:text-[#5EEAD4] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Explore full platform capabilities and integrations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* FINAL HIGH IMPACT CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-gradient-to-br from-[#0B1C16] via-[#0E271F] to-[#07130F] rounded-3xl p-8 sm:p-14 text-white overflow-hidden shadow-2xl border border-[#1F4A3B] text-center sm:text-left flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="max-w-xl space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
              Early Access • Built for Modern Agile Teams
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to stop drowning in 14 open browser tabs?
            </h2>
            <p className="text-[#A7C8BD] text-sm leading-relaxed">
              Connect your first 2 workspaces for free. Experience what true cross-org focus feels like in 5 minutes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white font-bold text-sm rounded-xl transition-all shadow-[0_4px_20px_rgba(21,128,93,0.4)] cursor-pointer"
            >
              Get Started Free Now
            </button>
            <button
              onClick={() => {
                onNavigate('pricing');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#0E201A] hover:bg-[#12241E] text-white font-semibold text-sm rounded-xl border border-[#1C3B31] transition-all cursor-pointer"
            >
              View Pricing & ROI
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
