import React from 'react';
import { PageType } from '../types';

interface FooterProps {
  onNavigate: (page: PageType) => void;
  onOpenContact?: () => void;
  onShowModal?: (title: string, content: string) => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onOpenContact,
  onShowModal,
}) => {
  const handleInfoModal = (title: string, content: string) => {
    if (onShowModal) {
      onShowModal(title, content);
    }
  };

  return (
    <footer className="bg-[#050B09] text-white pt-20 pb-12 border-t border-[#12241E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-[#12241E]">
          {/* Brand Col */}
          <div className="md:col-span-4 space-y-4">
            <button
              onClick={() => {
                onNavigate('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
            >
              <div className="w-8 h-8 bg-[#15805D] rounded-lg flex items-center justify-center text-white font-black text-lg shadow-[0_2px_10px_rgba(21,128,93,0.4)] transition-transform group-hover:scale-105">
                L
              </div>
              <span className="font-extrabold text-2xl tracking-tight text-white">
                LOFT
              </span>
            </button>
            <p className="text-[#7E9F94] text-sm leading-relaxed max-w-sm">
              The all-in-one workspace built for people who belong to multiple teams. One
              home for all your spaces, chats, files, and tasks.
            </p>
            <div className="pt-2 flex items-center gap-3 text-xs text-[#7E9F94]">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#15805D]/20 text-[#34D399] font-medium border border-[#15805D]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] mr-1.5 animate-pulse"></span>
                All Systems Operational
              </span>
              <span>SOC2 Type II Certified</span>
            </div>
          </div>

          {/* Nav Columns */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
            {/* Column 1: PLATFORM */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#A5C8BC] mb-4">
                Platform
              </h4>
              <ul className="space-y-3 text-sm text-[#7E9F94]">
                <li>
                  <button
                    onClick={() => {
                      onNavigate('features');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Features Overview
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      onNavigate('features');
                      window.scrollTo({ top: 600, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Smart Priority Feed
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      onNavigate('home');
                      window.scrollTo({ top: 1200, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Supported Integrations
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      onNavigate('pricing');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Pricing Plans & ROI
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 2: RESOURCES */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#A5C8BC] mb-4">
                Resources
              </h4>
              <ul className="space-y-3 text-sm text-[#7E9F94]">
                <li>
                  <button
                    onClick={() =>
                      handleInfoModal(
                        'Blog & Guides',
                        'Discover how top remote and agency operators manage across multiple client workspaces, optimize cross-team asynchronous communication, and defeat context switching.'
                      )
                    }
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Blog & Guides
                  </button>
                </li>
                <li>
                  <button
                    onClick={() =>
                      handleInfoModal(
                        'Help Center & Knowledge Base',
                        'Comprehensive onboarding guides for multi-organization setup, keyboard shortcuts (Cmd+K), notification rules, and custom webhooks.'
                      )
                    }
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Help Center
                  </button>
                </li>
                <li>
                  <button
                    onClick={() =>
                      handleInfoModal(
                        'Community Discord & Forum',
                        'Join 12,000+ cross-team practitioners on our community server. Share custom templates, request integrations, and talk directly with our product team.'
                      )
                    }
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Community
                  </button>
                </li>
                <li>
                  <button
                    onClick={() =>
                      handleInfoModal(
                        'Developer API & Webhooks',
                        'REST API and GraphQL endpoints available with OAuth 2.0. Export unified tasks, push events, or trigger automated cross-workspace actions.'
                      )
                    }
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Developer API
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: COMPANY */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#A5C8BC] mb-4">
                Company
              </h4>
              <ul className="space-y-3 text-sm text-[#7E9F94]">
                <li>
                  <button
                    onClick={() => {
                      onNavigate('about');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      onNavigate('about');
                      window.scrollTo({ top: 500, behavior: 'smooth' });
                    }}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Our Mission
                  </button>
                </li>
                <li>
                  <button
                    onClick={() =>
                      handleInfoModal(
                        'Security & Trust',
                        'LOFT is SOC-2 Type II compliant with end-to-end encryption, multi-tenant isolation, and zero-retention privacy protocols for enterprise data.'
                      )
                    }
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Security & Trust
                  </button>
                </li>
                <li>
                  <button
                    onClick={onOpenContact}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Contact Support
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom copyright bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C7E74]">
          <p>© 2026 Ervo Digital Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <button
              onClick={() =>
                handleInfoModal(
                  'Privacy Policy',
                  'LOFT enforces rigorous data encryption in transit (TLS 1.3) and at rest (AES-256). We never train public AI models on your private workspace files or conversations.'
                )
              }
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              onClick={() =>
                handleInfoModal(
                  'Terms of Service',
                  'LOFT subscription agreements grant standard non-exclusive commercial licenses with 99.9% uptime SLA commitments for Pro and Enterprise plans.'
                )
              }
              className="hover:text-white transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
            <button
              onClick={() =>
                handleInfoModal(
                  'Security & Compliance',
                  'Independently audited for SOC 2 Type II, GDPR, and CCPA compliance. Dedicated regional data residency available upon request.'
                )
              }
              className="hover:text-white transition-colors cursor-pointer"
            >
              Security
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
