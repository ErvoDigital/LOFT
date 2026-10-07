import React, { useState } from 'react';
import { 
  Check, 
  Calculator, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  Clock 
} from 'lucide-react';
import { PageType } from '../types';
import { PRICING_PLANS, FAQS } from '../data/mockData';

interface PricingPageProps {
  onNavigate: (page: PageType) => void;
  onGetStarted: () => void;
  onOpenContact: () => void;
  onShowToast: (msg: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({
  onNavigate,
  onGetStarted,
  onOpenContact,
  onShowToast,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');
  const [teamSize, setTeamSize] = useState<number>(5);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const hoursSavedMonthly = Math.round(teamSize * 4.5 * 4.2);
  const estimatedDollarsSaved = hoursSavedMonthly * 65;
  const proCostMonthly = billingCycle === 'annually' ? teamSize * 12 : teamSize * 15;
  const netEstimatedRoi = estimatedDollarsSaved - proCostMonthly;

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <div className="space-y-24 pb-20 ambient-glow">
      {/* HEADER SECTION */}
      <section className="pt-12 sm:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative">
        <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
          Predictable & Transparent Pricing
        </span>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mt-3 max-w-3xl mx-auto">
          Invest in flow, not tab switching.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-[#8FAFA4] max-w-2xl mx-auto leading-relaxed">
          Start free with 2 workspaces. Upgrade when you need unlimited tenants, the Smart Priority Matrix, and enterprise compliance.
        </p>

        {/* BILLING TOGGLE */}
        <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-[#0B1713] border border-[#1C3B31]">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-[#15805D] text-white shadow-sm'
                : 'text-[#8FAFA4] hover:text-white'
            }`}
          >
            Billed Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annually')}
            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              billingCycle === 'annually'
                ? 'bg-[#15805D] text-white shadow-sm'
                : 'text-[#8FAFA4] hover:text-white'
            }`}
          >
            <span>Billed Annually</span>
            <span className="text-[10px] bg-[#34D399] text-[#07130F] px-2 py-0.5 rounded-full font-bold">
              Save 20%
            </span>
          </button>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRICING_PLANS.map((plan) => {
            const price = billingCycle === 'annually' ? plan.priceAnnually : plan.priceMonthly;
            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all relative ${
                  plan.popular
                    ? 'bg-[#0E221B] border-2 border-[#10B981] shadow-[0_0_28px_rgba(16,185,129,0.2)]'
                    : 'bg-[#0B1713] border border-[#1C3B31] hover:border-[#275345]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#10B981] text-[#07130F] text-[11px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Most Popular</span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-[#8FAFA4] mt-1 min-h-[34px]">{plan.tagline}</p>

                  <div className="mt-5 pb-5 border-b border-[#162E25] flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white">${price}</span>
                    <span className="text-xs text-[#7E9F94]">
                      {price === 0 ? 'forever' : '/ user / month'}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E9084]">
                      What&apos;s Included:
                    </span>
                    {plan.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2.5 text-xs text-[#CBD5E1]">
                        <Check className="w-4 h-4 text-[#34D399] mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-[#162E25]">
                  <button
                    onClick={() => {
                      if (plan.id === 'enterprise') {
                        onOpenContact();
                      } else {
                        onGetStarted();
                      }
                    }}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white shadow-[0_4px_16px_rgba(21,128,93,0.35)]'
                        : 'bg-[#12241E] hover:bg-[#162E26] text-white border border-[#1C3B31]'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[10px] text-center text-[#5A7C71] mt-2">
                    {plan.priceMonthly === 0 ? 'Free tier never expires' : '14-day free trial • Cancel anytime'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* INTERACTIVE TEAM ROI CALCULATOR */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#081511] text-white rounded-3xl p-6 sm:p-10 border border-[#1C3B31] shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#162E25] gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#34D399] uppercase tracking-wider mb-1">
                <Calculator className="w-4 h-4" />
                <span>Interactive ROI Estimator</span>
              </div>
              <h3 className="text-2xl font-extrabold text-white">
                Calculate your team’s reclaimed billable time.
              </h3>
            </div>
            <span className="text-xs text-[#8FAFA4] max-w-xs">
              Based on empirical surveys across 1,200+ multi-team operators.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mt-8 items-center">
            {/* Slider Column */}
            <div className="md:col-span-6 space-y-6">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-2">
                  <span className="text-[#CBD5E1]">Team Size (Multi-Workspace Users)</span>
                  <span className="text-lg font-black text-[#34D399]">{teamSize} members</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={teamSize}
                  onChange={(e) => setTeamSize(parseInt(e.target.value))}
                  className="w-full h-2 bg-[#162E25] rounded-lg appearance-none cursor-pointer accent-[#10B981]"
                />
                <div className="flex justify-between text-[10px] text-[#5C7E74] mt-1 font-mono">
                  <span>1 Solo</span>
                  <span>10 Agency</span>
                  <span>25 Studio</span>
                  <span>50 Enterprise</span>
                </div>
              </div>

              <div className="p-4 bg-[#0E201A] rounded-2xl border border-[#1C3B31] text-xs text-[#A7C8BD] space-y-2">
                <p>
                  <strong className="text-white">Context Switching Cost:</strong> Each worker loses ~4.5 hours per week hunting across 3+ client organizations, re-logging in, and verifying missed mentions.
                </p>
              </div>
            </div>

            {/* Calculations Column */}
            <div className="md:col-span-6 grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#0E201A] border border-[#1C3B31] text-center">
                <Clock className="w-5 h-5 text-[#34D399] mx-auto mb-1.5" />
                <span className="text-[11px] text-[#8FAFA4]">Hours Saved / Month</span>
                <p className="text-2xl font-black text-white mt-1">~{hoursSavedMonthly} hrs</p>
                <span className="text-[10px] text-[#6E9084]">Across {teamSize} operators</span>
              </div>

              <div className="p-4 rounded-2xl bg-[#0E201A] border border-[#1C3B31] text-center">
                <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
                <span className="text-[11px] text-[#8FAFA4]">Reclaimed Value / Mo</span>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  ${estimatedDollarsSaved.toLocaleString()}
                </p>
                <span className="text-[10px] text-[#6E9084]">Est. billable value</span>
              </div>

              <div className="col-span-2 p-4 rounded-2xl bg-[#122A21] border border-[#235848] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[#A7C8BD]">
                    Net Projected Monthly Value
                  </span>
                  <p className="text-xl font-extrabold text-white mt-0.5">
                    +${netEstimatedRoi.toLocaleString()}/mo
                  </p>
                </div>
                <button
                  onClick={onGetStarted}
                  className="px-4 py-2 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Start Saving Time
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE COMPARISON MATRIX */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
            Feature Matrix
          </span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            Detailed plan feature breakdown.
          </h2>
        </div>

        <div className="bg-[#0B1713] rounded-3xl border border-[#1C3B31] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#08120F] border-b border-[#162E25] text-xs text-[#CBD5E1]">
                  <th className="p-4 sm:p-5 font-bold">Capabilities</th>
                  <th className="p-4 sm:p-5 font-bold text-center">Starter</th>
                  <th className="p-4 sm:p-5 font-bold text-center text-[#34D399]">Professional</th>
                  <th className="p-4 sm:p-5 font-bold text-center">Team & Studio</th>
                  <th className="p-4 sm:p-5 font-bold text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162E25] text-xs text-[#CBD5E1]">
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Connected Workspaces</td>
                  <td className="p-4 sm:p-5 text-center text-[#8FAFA4]">Up to 2</td>
                  <td className="p-4 sm:p-5 text-center font-bold text-[#34D399]">Unlimited</td>
                  <td className="p-4 sm:p-5 text-center">Unlimited</td>
                  <td className="p-4 sm:p-5 text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Smart Priority Matrix (AI Ranking)</td>
                  <td className="p-4 sm:p-5 text-center text-[#5A7C71]">—</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Included</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Included</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Custom tuning</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Command+K Omnisearch</td>
                  <td className="p-4 sm:p-5 text-center text-[#8FAFA4]">Basic (2 orgs)</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Universal (50ms)</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Universal</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Universal + SIEM</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Cross-Calendar Privacy Sync</td>
                  <td className="p-4 sm:p-5 text-center text-[#5A7C71]">—</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Included</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Included</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Multi-domain Exchange</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-medium text-white">Air-Gapped Tenant Encryption</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399]">✓ Local AES-256</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Hardware Keychain</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ SOC 2 Type II</td>
                  <td className="p-4 sm:p-5 text-center text-[#34D399] font-bold">✓ Dedicated HSM</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
            Got Questions?
          </span>
          <h2 className="text-3xl font-extrabold text-white mt-2">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="bg-[#0B1713] rounded-2xl border border-[#1C3B31] overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left font-bold text-white text-sm flex items-center justify-between cursor-pointer hover:bg-[#0E201A] transition-colors"
                >
                  <span>{faq.question}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#34D399] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#5A7C71] shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 text-xs text-[#8FAFA4] leading-relaxed border-t border-[#162E25] pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Additional help teaser */}
        <div className="text-center mt-8">
          <p className="text-xs text-[#7E9F94]">
            Have a unique cross-organization setup or vendor requirements?{' '}
            <button
              onClick={onOpenContact}
              className="text-[#34D399] font-bold hover:underline cursor-pointer"
            >
              Talk directly with our solutions team →
            </button>
          </p>
        </div>
      </section>
    </div>
  );
};
