import React, { useState } from 'react';
import { 
  Zap, 
  Search, 
  ShieldCheck, 
  ArrowRight, 
  Check, 
  Lock, 
  Cpu
} from 'lucide-react';
import { PageType } from '../types';
import { INTEGRATIONS } from '../data/mockData';

interface FeaturesPageProps {
  onNavigate: (page: PageType) => void;
  onGetStarted: () => void;
  onOpenCommandK: () => void;
  onShowToast: (msg: string) => void;
}

export const FeaturesPage: React.FC<FeaturesPageProps> = ({
  onNavigate,
  onGetStarted,
  onOpenCommandK,
  onShowToast,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchSimQuery, setSearchSimQuery] = useState('');

  const sampleSearchItems = [
    { type: 'Task', org: 'Ervo Digital', title: 'Q3 Brand Design token export to GitHub repo' },
    { type: 'Document', org: 'Acme Global', title: 'SOC 2 Type II Final Auditor Certification.pdf' },
    { type: 'Discussion', org: 'HyperScale AI', title: 'Vector index latency drops to 12ms in cluster A' },
    { type: 'Meeting', org: 'Personal & Lab', title: 'Sync with VC partners on Series A deck' },
    { type: 'File', org: 'Ervo Digital', title: 'Figma Design System Components v2.4.fig' },
  ];

  const filteredSearchSim = sampleSearchItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchSimQuery.toLowerCase()) ||
      item.org.toLowerCase().includes(searchSimQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchSimQuery.toLowerCase())
  );

  const categories = ['All', 'Communication', 'Project Tracking', 'Productivity', 'Design', 'Development'];

  const filteredIntegrations =
    activeCategory === 'All'
      ? INTEGRATIONS
      : INTEGRATIONS.filter((i) => i.category === activeCategory);

  return (
    <div className="space-y-24 pb-20 ambient-glow">
      {/* HEADER SECTION */}
      <section className="pt-12 sm:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative">
        <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
          Platform Architecture & Capabilities
        </span>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mt-3 max-w-4xl mx-auto">
          Built for multi-tenant mastery.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#8FAFA4] max-w-2xl mx-auto leading-relaxed">
          Every feature in LOFT is engineered specifically for operators working across boundary lines — multiple clients, joint-ventures, and external projects.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={onGetStarted}
            className="px-6 py-3 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(21,128,93,0.35)] cursor-pointer"
          >
            Start Free 14-Day Trial
          </button>
          <button
            onClick={onOpenCommandK}
            className="px-6 py-3 bg-[#0E201A] hover:bg-[#12241E] text-white text-xs font-bold rounded-xl border border-[#1C3B31] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[#34D399]" />
            <span>Launch Omnisearch (Cmd+K)</span>
          </button>
        </div>
      </section>

      {/* FEATURE 1: SMART PRIORITY MATRIX */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <div className="w-10 h-10 rounded-xl bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
              Unified Focus Engine
            </span>
            <h2 className="text-3xl font-extrabold text-white leading-tight">
              One algorithmic queue for all your organizations.
            </h2>
            <p className="text-sm text-[#8FAFA4] leading-relaxed">
              Instead of manually scanning 5 separate Slack inboxes, Linear backlogs, and email threads, LOFT’s Smart Priority Matrix continuously analyzes urgency, client SLAs, and direct mentions.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-[#15805D]/30 text-[#34D399] mt-0.5 border border-[#15805D]/40">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs text-[#A7C8BD]">
                  <strong className="text-white">Cross-tenant score ranking</strong>: Evaluates deadline imminence and team hierarchy without mixing data.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-[#15805D]/30 text-[#34D399] mt-0.5 border border-[#15805D]/40">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs text-[#A7C8BD]">
                  <strong className="text-white">Contextual quick actions</strong>: Mark done, snooze until afternoon, or reply straight from the card.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-[#15805D]/30 text-[#34D399] mt-0.5 border border-[#15805D]/40">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs text-[#A7C8BD]">
                  <strong className="text-white">Zero context loss</strong>: Clicking an item highlights its origin workspace and channel instantly.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#0B1713] p-6 sm:p-8 rounded-3xl border border-[#1C3B31] shadow-xl">
            <div className="bg-[#0E201A] p-5 rounded-2xl border border-[#1C3B31] space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#162E25]">
                <span className="text-xs font-bold text-white uppercase tracking-wide">
                  Top Priority Cross-Feed
                </span>
                <span className="text-[11px] bg-rose-950/40 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-800/60">
                  2 Critical Today
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-950/60 bg-rose-950/20 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-600 text-white rounded">
                      CRITICAL
                    </span>
                    <span className="text-xs font-bold text-white">
                      Client SOW Milestone Approval
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8FAFA4] mt-1">
                    Ervo Digital • Due in 2 hours • Mentioned by Founder
                  </p>
                </div>
                <button
                  onClick={() => onShowToast('Task prioritized and escalated in Ervo Digital')}
                  className="text-xs font-semibold text-rose-300 hover:underline shrink-0 cursor-pointer"
                >
                  Review
                </button>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-950/60 bg-amber-950/20 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-600 text-white rounded">
                      HIGH
                    </span>
                    <span className="text-xs font-bold text-white">
                      Review Security Auditor Findings
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8FAFA4] mt-1">
                    Acme Global • Due tomorrow 11:00 AM • External Contractor
                  </p>
                </div>
                <button
                  onClick={() => onShowToast('Acme Global security findings opened')}
                  className="text-xs font-semibold text-amber-300 hover:underline shrink-0 cursor-pointer"
                >
                  Review
                </button>
              </div>

              <div className="p-3.5 rounded-xl border border-[#1C3B31] bg-[#12241E] flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-[#172E27] text-[#8FAFA4] rounded border border-[#1E3E34]">
                      MEDIUM
                    </span>
                    <span className="text-xs font-medium text-white">
                      Sync weekly engineering sprint goals
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8FAFA4] mt-1">
                    HyperScale AI • Due Oct 10 • Advisory
                  </p>
                </div>
                <button
                  onClick={() => onShowToast('Sprint goals view opened')}
                  className="text-xs font-medium text-[#7E9F94] hover:text-white shrink-0 cursor-pointer"
                >
                  View
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 2: COMMAND+K OMNISEARCH SIMULATION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 order-2 lg:order-1 bg-[#0A1612] text-white p-6 sm:p-8 rounded-3xl border border-[#1C3B31] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#162E25]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#34D399]">
                <Search className="w-4 h-4" />
                <span>Try LOFT Omnisearch</span>
              </div>
              <span className="text-[11px] font-mono bg-[#11241E] text-[#9FC0B4] px-2 py-0.5 rounded border border-[#1C3B31]">
                Interactive Sim
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Filter by keyword (e.g. 'SOC', 'token', 'Figma')..."
                value={searchSimQuery}
                onChange={(e) => setSearchSimQuery(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-[#12241E] border border-[#1C3B31] rounded-xl text-white placeholder:text-[#527469] focus:outline-none focus:border-[#22C55E]"
              />
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {filteredSearchSim.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6E9084]">
                  No matching files or tasks across the simulated index.
                </div>
              ) : (
                filteredSearchSim.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => onShowToast(`Jumped to: ${item.title}`)}
                    className="p-3 bg-[#11241E] hover:bg-[#152D26] rounded-xl border border-[#1C3B31] cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{item.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-[#7E9F94] mt-1">
                        <span className="bg-[#18332A] px-1.5 py-0.5 rounded text-[#A7C8BD]">
                          {item.org}
                        </span>
                        <span>{item.type}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#34D399] hover:underline shrink-0">Open →</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2 space-y-5">
            <div className="w-10 h-10 rounded-xl bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
              Universal Query Index
            </span>
            <h2 className="text-3xl font-extrabold text-white leading-tight">
              Command+K searching across all 5+ workspaces at once.
            </h2>
            <p className="text-sm text-[#8FAFA4] leading-relaxed">
              When a client says &ldquo;Can you check that document from three weeks ago?&rdquo; you no longer have to wonder which Slack workspace or Google Drive folder it was dropped into.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-[#15805D]/30 text-[#34D399] mt-0.5 border border-[#15805D]/40">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs text-[#A7C8BD]">
                  <strong className="text-white">Indexed locally with SQLite + WebAssembly</strong>: Sub-50 millisecond response times.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-[#15805D]/30 text-[#34D399] mt-0.5 border border-[#15805D]/40">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs text-[#A7C8BD]">
                  <strong className="text-white">Zero cross-contamination</strong>: Search results preserve workspace origin tags clearly.
                </p>
              </div>
            </div>

            <button
              onClick={onOpenCommandK}
              className="text-xs font-bold text-[#34D399] hover:underline inline-flex items-center gap-1.5 cursor-pointer pt-2"
            >
              <span>Test live search modal right now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* FEATURE 3: CRYPTOGRAPHIC ISOLATION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#050C0A] text-white rounded-3xl p-8 sm:p-14 border border-[#162E25]">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#34D399] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero-Leak Architecture</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Enterprise cryptographic tenant segregation.
            </h2>
            <p className="text-sm text-[#8FAFA4] leading-relaxed">
              We know your clients have non-disclosure agreements and strict IP requirements. LOFT was designed from day one with isolated tenant sandboxes so data, tokens, and member directories never touch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <div className="p-6 rounded-2xl bg-[#0A1612] border border-[#162E25]">
              <Lock className="w-6 h-6 text-[#34D399] mb-3" />
              <h4 className="text-sm font-bold text-white mb-1.5">Air-Gapped Vaults</h4>
              <p className="text-xs text-[#7E9F94] leading-relaxed">
                OAuth access tokens and session cookies for each client organization live in dedicated hardware-encrypted keychains.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#0A1612] border border-[#162E25]">
              <ShieldCheck className="w-6 h-6 text-emerald-400 mb-3" />
              <h4 className="text-sm font-bold text-white mb-1.5">SOC 2 Type II Certified</h4>
              <p className="text-xs text-[#7E9F94] leading-relaxed">
                Regular penetration testing and automated vulnerability pipelines verify zero cross-tenant leakage.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#0A1612] border border-[#162E25]">
              <Cpu className="w-6 h-6 text-teal-400 mb-3" />
              <h4 className="text-sm font-bold text-white mb-1.5">No Public AI Training</h4>
              <p className="text-xs text-[#7E9F94] leading-relaxed">
                Your private workspace messages and customer files are never used to train public machine learning models.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS HUB SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
            Seamless Ecosystem
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2">
            Connects with the tools your teams already use.
          </h2>
          <p className="text-[#8FAFA4] mt-3 text-sm">
            Clients don&apos;t need to change their stack. LOFT acts as your client-side bridge.
          </p>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-[#15805D] text-white shadow-[0_0_8px_rgba(21,128,93,0.4)]'
                    : 'bg-[#12241E] text-[#8FAFA4] hover:bg-[#162E26] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredIntegrations.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-[#0B1713] border border-[#1C3B31] hover:border-[#275345] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-[10px] font-semibold text-[#8FAFA4] bg-[#12241E] border border-[#1C3B31] px-2 py-0.5 rounded">
                    {item.category}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{item.name}</h4>
                <p className="text-xs text-[#8FAFA4] mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-[#162E25] flex items-center justify-between text-xs">
                <span className="text-[#34D399] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]"></span>
                  Official Bridge
                </span>
                <button
                  onClick={() => onShowToast(`${item.name} bridge enabled on your account`)}
                  className="font-bold text-[#34D399] hover:underline cursor-pointer"
                >
                  Enable
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BOTTOM CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-[#0B1C16] via-[#102D23] to-[#07130F] rounded-3xl p-8 sm:p-12 text-white text-center space-y-4 shadow-xl border border-[#1F4A3B]">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Experience true cross-team flow today.
          </h2>
          <p className="text-[#A7C8BD] text-sm max-w-xl mx-auto leading-relaxed">
            Free forever for up to 2 connected workspaces. No credit card required. Setup takes under 2 minutes.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="px-8 py-3.5 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(21,128,93,0.4)] cursor-pointer"
            >
              Get Started Free
            </button>
            <button
              onClick={() => {
                onNavigate('pricing');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-6 py-3.5 bg-[#0E201A] hover:bg-[#12241E] text-white text-xs font-bold rounded-xl border border-[#1C3B31] transition-all cursor-pointer"
            >
              Compare Plans & Pricing
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
