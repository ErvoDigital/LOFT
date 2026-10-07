import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { PageType } from '../types';

interface NavbarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onGetStarted: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onGetStarted,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: PageType; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'features', label: 'Features' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'about', label: 'About' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#07100D]/85 backdrop-blur-md border-b border-[#142B23] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <button
          id="nav-brand-logo"
          onClick={() => {
            onNavigate('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
        >
          <div className="w-8 h-8 bg-[#15805D] rounded-lg flex items-center justify-center text-white font-extrabold text-lg shadow-[0_2px_10px_rgba(21,128,93,0.4)] transition-transform group-hover:scale-105">
            L
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-white">
            LOFT
          </span>
        </button>

        {/* Center Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => {
                  onNavigate(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="relative py-2 text-sm font-medium transition-colors cursor-pointer focus:outline-none"
              >
                <span
                  className={
                    isActive
                      ? 'text-white font-bold'
                      : 'text-[#8FAFA4] hover:text-white'
                  }
                >
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#10B981] rounded-full mx-auto w-5/6 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right CTA Button (No Sign In button required) */}
        <div className="hidden md:flex items-center gap-4">
          <button
            id="nav-getstarted-btn"
            onClick={onGetStarted}
            className="text-sm font-semibold text-white bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] px-5 py-2.5 rounded-xl transition-all shadow-[0_2px_12px_rgba(21,128,93,0.35)] active:scale-95 cursor-pointer border border-[#215E4C]/50"
          >
            Get Started Free
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            id="nav-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#8FAFA4] hover:text-white hover:bg-[#12241E] rounded-lg transition-colors"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#19362D] bg-[#0A1612] px-4 pt-3 pb-6 space-y-3 shadow-2xl">
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-base font-medium flex items-center justify-between ${
                    isActive
                      ? 'bg-[#12241E] text-white font-bold border-l-4 border-[#10B981]'
                      : 'text-[#8FAFA4] hover:bg-[#0E1D18] hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]"></span>}
                </button>
              );
            })}
          </div>
          <div className="pt-3 border-t border-[#19362D] flex flex-col gap-2">
            <button
              onClick={() => {
                onGetStarted();
                setMobileMenuOpen(false);
              }}
              className="w-full text-center py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#178564] to-[#14795B] rounded-xl shadow-md"
            >
              Get Started Free
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
