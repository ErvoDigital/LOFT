import React, { useState } from 'react';
import { X, Play, Layers, Bell, Command, CheckCircle2 } from 'lucide-react';

interface VideoDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

export const VideoDemoModal: React.FC<VideoDemoModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
}) => {
  const [activeStep, setActiveStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: '1. Connect All Workspaces in 60 Seconds',
      description: 'Authorize your Slack, Teams, Linear, and Google accounts once. LOFT generates air-gapped cryptographic vaults for each organization.',
      icon: <Layers className="w-5 h-5 text-[#34D399]" />,
      detail: 'Zero client-data leakage. Each tenant is containerized.',
    },
    {
      title: '2. Smart Priority Matrix (No More Ping Fatigue)',
      description: 'Our proprietary attention algorithm analyzes upcoming deadlines and actionable mentions, creating one single focus inbox.',
      icon: <Bell className="w-5 h-5 text-amber-400" />,
      detail: 'Reduces context-switching anxiety by 84%.',
    },
    {
      title: '3. Omnisearch with Cmd+K Across 5+ Tenants',
      description: 'Find any document, message, or ticket across all your client and internal workspaces with sub-50ms latency.',
      icon: <Command className="w-5 h-5 text-teal-400" />,
      detail: 'Never lose a Figma link or Jira ticket again.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050C0A]/85 backdrop-blur-md">
      <div 
        className="bg-[#0B1713] text-white rounded-2xl shadow-2xl border border-[#1C3B31] w-full max-w-3xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-[#6E9084] hover:text-white hover:bg-[#12241E] transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video / Interactive Simulation Banner */}
        <div className="relative bg-gradient-to-tr from-[#07130F] via-[#0E251D] to-[#0A1A14] p-8 border-b border-[#162E25]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#34D399] uppercase tracking-wider mb-2">
            <Play className="w-4 h-4 fill-[#34D399]" />
            <span>Interactive Guided Walkthrough</span>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-white max-w-xl">
            See how high-performing multi-team operators run their day in LOFT.
          </h3>
          <p className="text-xs text-[#8FAFA4] mt-2 max-w-lg">
            Say goodbye to 4 browser profiles, missed mentions, and cross-team scheduling clashes.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-[#081511]/90 border border-[#1C3B31] backdrop-blur-md">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#15805D]/20 rounded-xl border border-[#15805D]/40">
                {steps[activeStep].icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">
                    {steps[activeStep].title}
                  </h4>
                  <span className="text-[11px] bg-[#12241E] text-[#9FC0B4] font-mono px-2 py-0.5 rounded border border-[#1C3B31]">
                    Step {activeStep + 1} of 3
                  </span>
                </div>
                <p className="text-xs text-[#CBD5E1] mt-1.5 leading-relaxed">
                  {steps[activeStep].description}
                </p>
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#34D399] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{steps[activeStep].detail}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-2">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    activeStep === idx
                      ? 'w-8 bg-[#34D399] shadow-[0_0_8px_#34D399]'
                      : 'w-2 bg-[#1C3B31] hover:bg-[#254F42]'
                  }`}
                  aria-label={`Jump to step ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={activeStep === 0}
                onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-lg bg-[#12241E] hover:bg-[#162E26] disabled:opacity-30 text-xs font-semibold cursor-pointer border border-[#1C3B31]"
              >
                Previous
              </button>
              {activeStep < steps.length - 1 ? (
                <button
                  onClick={() => setActiveStep((prev) => Math.min(steps.length - 1, prev + 1))}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAuth('signup');
                  }}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-bold cursor-pointer shadow-md"
                >
                  Start Free Trial Now
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom CTA info */}
        <div className="p-4 bg-[#07110E] flex flex-col sm:flex-row items-center justify-between text-xs text-[#7E9F94] gap-3">
          <span>
            Ready to test LOFT with your own workspaces? Free 14-day full access.
          </span>
          <button
            onClick={() => {
              onClose();
              onOpenAuth('signup');
            }}
            className="text-[#34D399] hover:underline font-bold cursor-pointer"
          >
            Claim 14-Day Free Pro Access →
          </button>
        </div>
      </div>
    </div>
  );
};
