/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PageType } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { FeaturesPage } from './pages/FeaturesPage';
import { PricingPage } from './pages/PricingPage';
import { AboutPage } from './pages/AboutPage';
import { CommandKModal } from './components/CommandKModal';
import { ContactModal } from './components/ContactModal';
import { InfoModal } from './components/InfoModal';
import { VideoDemoModal } from './components/VideoDemoModal';
import { LoftWorkspaceDashboard } from './components/LoftWorkspaceDashboard';
import { CheckCircle2, X, ArrowLeft } from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [commandKOpen, setCommandKOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [videoDemoModalOpen, setVideoDemoModalOpen] = useState(false);
  const [fullDashboardView, setFullDashboardView] = useState(false);
  const [infoModal, setInfoModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
  }>({
    isOpen: false,
    title: '',
    content: '',
  });

  // Toast System
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Global keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandKOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Direct Get Started Free action: Launches directly into the workspace dashboard without any sign-in form!
  const handleGetStarted = () => {
    if (currentPage === 'home') {
      const el = document.getElementById('live-workspace-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Welcome! Your Ervo Digital Workspace is ready.');
      } else {
        setFullDashboardView(true);
      }
    } else {
      setCurrentPage('home');
      setTimeout(() => {
        const el = document.getElementById('live-workspace-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      showToast('Welcome to your Ervo Digital Workspace!');
    }
  };

  const handleShowInfoModal = (title: string, content: string) => {
    setInfoModal({
      isOpen: true,
      title,
      content,
    });
  };

  // Full-screen dedicated dashboard view if toggled
  if (fullDashboardView) {
    return (
      <div className="min-h-screen bg-[#07100D] p-4 sm:p-6 text-white flex flex-col">
        <div className="max-w-7xl mx-auto w-full mb-3 flex items-center justify-between">
          <button
            onClick={() => setFullDashboardView(false)}
            className="flex items-center gap-2 text-xs font-semibold text-[#8FAFA4] hover:text-white transition-colors cursor-pointer bg-[#0D211A] border border-[#18392D] px-3.5 py-1.5 rounded-xl shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to LOFT Overview</span>
          </button>
          <span className="text-xs text-[#5A7C71] font-mono">
            loft-client.vercel.app/workspaces/1540545b-2e44-419a-af46-7fddda6af80f
          </span>
        </div>
        <div className="max-w-7xl mx-auto w-full flex-1">
          <LoftWorkspaceDashboard
            isFullScreen={true}
            onToggleFullScreen={() => setFullDashboardView(false)}
            onShowToast={showToast}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07100D] text-[#F1F5F3] selection:bg-[#15805D] selection:text-white">
      {/* Main Navbar (Sign in button removed as requested) */}
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onGetStarted={handleGetStarted}
      />

      {/* Main Content Pages */}
      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage
            onNavigate={setCurrentPage}
            onGetStarted={handleGetStarted}
            onOpenVideoDemo={() => setVideoDemoModalOpen(true)}
            onOpenCommandK={() => setCommandKOpen(true)}
            onShowToast={showToast}
          />
        )}

        {currentPage === 'features' && (
          <FeaturesPage
            onNavigate={setCurrentPage}
            onGetStarted={handleGetStarted}
            onOpenCommandK={() => setCommandKOpen(true)}
            onShowToast={showToast}
          />
        )}

        {currentPage === 'pricing' && (
          <PricingPage
            onNavigate={setCurrentPage}
            onGetStarted={handleGetStarted}
            onOpenContact={() => setContactModalOpen(true)}
            onShowToast={showToast}
          />
        )}

        {currentPage === 'about' && (
          <AboutPage
            onNavigate={setCurrentPage}
            onGetStarted={handleGetStarted}
            onOpenContact={() => setContactModalOpen(true)}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={setCurrentPage}
        onOpenContact={() => setContactModalOpen(true)}
        onShowModal={handleShowInfoModal}
      />

      {/* MODALS */}
      <CommandKModal
        isOpen={commandKOpen}
        onClose={() => setCommandKOpen(false)}
        onNavigate={setCurrentPage}
        onShowToast={showToast}
      />

      <ContactModal
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        onShowToast={showToast}
      />

      <VideoDemoModal
        isOpen={videoDemoModalOpen}
        onClose={() => setVideoDemoModalOpen(false)}
        onOpenAuth={() => handleGetStarted()}
      />

      <InfoModal
        isOpen={infoModal.isOpen}
        title={infoModal.title}
        content={infoModal.content}
        onClose={() => setInfoModal({ isOpen: false, title: '', content: '' })}
      />

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0E201A] text-white px-4 py-3 rounded-xl shadow-2xl border border-[#1C3B31] animate-in fade-in slide-in-from-bottom-3 duration-200 text-xs">
          <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
          <span className="font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[#6E9084] hover:text-white p-0.5 rounded transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
