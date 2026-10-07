import React from 'react';
import { 
  Target, 
  ShieldCheck, 
  Sparkles, 
  Globe2 
} from 'lucide-react';
import { PageType } from '../types';
import { MILESTONES } from '../data/mockData';

interface AboutPageProps {
  onNavigate: (page: PageType) => void;
  onGetStarted: () => void;
  onOpenContact: () => void;
  onShowToast: (msg: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  onNavigate,
  onGetStarted,
  onOpenContact,
  onShowToast,
}) => {
  return (
    <div className="space-y-24 pb-20 ambient-glow">
      {/* HEADER & MANIFESTO */}
      <section className="pt-12 sm:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative">
        <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
          Our Origin & Mission
        </span>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mt-3 max-w-4xl mx-auto">
          We built LOFT because modern work has no single border.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-[#8FAFA4] max-w-2xl mx-auto leading-relaxed">
          The best engineers, designers, advisors, and founders rarely work for just one company anymore. Yet corporate software treats anyone with multiple emails like a foreign intruder.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={onGetStarted}
            className="px-6 py-3 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(21,128,93,0.35)] flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Get Started Free</span>
          </button>
          <button
            onClick={onOpenContact}
            className="px-6 py-3 bg-[#0E201A] hover:bg-[#12241E] text-white text-xs font-bold rounded-xl border border-[#1C3B31] transition-all shadow-sm cursor-pointer"
          >
            Contact Our Team
          </button>
        </div>
      </section>

      {/* MANIFESTO NARRATIVE SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#0B1713] p-8 sm:p-12 rounded-3xl border border-[#1C3B31] shadow-xl space-y-6 text-[#CBD5E1] text-sm sm:text-base leading-relaxed">
          <h2 className="text-2xl font-extrabold text-white">
            The Era of the Multi-Team Knowledge Operator
          </h2>
          <p>
            In 2024, our founders were running a design agency while concurrently acting as fractional technical directors for two venture-backed Silicon Valley startups. On any given Tuesday, our browsers looked like an explosion: 18 pinned tabs across four separate Chrome profiles, three Slack desktop clients open side-by-side, two separate Google Drive accounts, and endless dread of accidentally posting a client update into another client’s internal channel.
          </p>
          <p>
            We realized the software world had a blind spot: every SaaS tool assumes you sit in one headquarters, log in with one corporate email, and talk to one team. But the future of high-leverage work is agile, consultative, and distributed across multiple organizations.
          </p>
          <div className="p-4 bg-[#12241E] border-l-4 border-[#10B981] rounded-r-xl text-xs sm:text-sm text-[#A7C8BD] italic">
            &ldquo;LOFT was built to give multi-team operators a clean, single flight deck: absolute air-gapped cryptographic privacy for your clients, and complete peace of mind for you.&rdquo;
          </div>
          <p>
            Today, over 25,000 agencies, consultants, fractional CTOs, and studio leads start their workday inside LOFT. We are proudly independent, customer-funded, and obsessive about software performance.
          </p>
        </div>
      </section>

      {/* CORE VALUES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
            What We Stand For
          </span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            The principles that guide every pixel.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-[#0B1713] border border-[#1C3B31] hover:border-[#275345] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center mb-4">
              <Target className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Radical Focus</h4>
            <p className="text-xs text-[#8FAFA4] leading-relaxed">
              We eliminate non-urgent alerts. If it doesn’t require your direct decision today, it doesn’t interrupt your deep work.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0B1713] border border-[#1C3B31] hover:border-[#275345] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Zero-Trust Isolation</h4>
            <p className="text-xs text-[#8FAFA4] leading-relaxed">
              No client data ever bleeds into another client’s space. We treat organizational boundaries as sacred cryptographic walls.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0B1713] border border-[#1C3B31] hover:border-[#275345] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">60fps Craft</h4>
            <p className="text-xs text-[#8FAFA4] leading-relaxed">
              Keyboard-first shortcuts, instant local search indexing, and zero spinner wheels. Speed is our primary feature.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0B1713] border border-[#1C3B31] hover:border-[#275345] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center mb-4">
              <Globe2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white mb-2">Remote-First Liberty</h4>
            <p className="text-xs text-[#8FAFA4] leading-relaxed">
              We work from 8 different timezones and design tools that enable people to do their best work from anywhere on Earth.
            </p>
          </div>
        </div>
      </section>

      {/* TIMELINE / MILESTONES */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
            Our Journey
          </span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            Company Milestones
          </h2>
        </div>

        <div className="space-y-6 relative before:absolute before:inset-0 before:left-4 sm:before:left-1/2 before:w-0.5 before:bg-[#162E25]">
          {MILESTONES.map((m, idx) => (
            <div
              key={idx}
              className={`relative flex flex-col sm:flex-row items-start ${
                idx % 2 === 0 ? 'sm:flex-row-reverse' : ''
              }`}
            >
              <div className="hidden sm:block sm:w-1/2"></div>
              {/* Dot */}
              <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#10B981] border-4 border-[#07100D] shadow-[0_0_8px_#10B981] z-10"></div>

              {/* Card */}
              <div className="ml-10 sm:ml-0 sm:w-1/2 sm:px-8">
                <div className="p-5 bg-[#0B1713] rounded-2xl border border-[#1C3B31] shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#34D399]">{m.date}</span>
                    {m.tag && (
                      <span className="text-[10px] bg-[#12241E] text-[#A7C8BD] font-semibold px-2 py-0.5 rounded border border-[#1C3B31]">
                        {m.tag}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">{m.title}</h4>
                  <p className="text-xs text-[#8FAFA4] mt-2 leading-relaxed">
                    {m.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SAAS CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#081511] rounded-3xl p-8 sm:p-14 text-white flex flex-col md:flex-row items-center justify-between gap-8 border border-[#1C3B31]">
          <div className="max-w-xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
              Start Your Free Trial
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Ready to unify your multi-workspace workflow?
            </h3>
            <p className="text-xs sm:text-sm text-[#8FAFA4] leading-relaxed">
              Consolidate your Linear, Jira, GitHub, Slack, and Google Workspace accounts into a single high-performance cockpit in under 60 seconds.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={onGetStarted}
              className="px-6 py-3.5 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(21,128,93,0.35)] cursor-pointer"
            >
              Get Started Free
            </button>
            <button
              onClick={onOpenContact}
              className="px-6 py-3.5 bg-[#0E201A] hover:bg-[#12241E] text-white text-xs font-bold rounded-xl border border-[#1C3B31] transition-all cursor-pointer"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
