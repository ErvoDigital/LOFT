import React from 'react';
import { X, Info, Check } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  title,
  content,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050C0A]/85 backdrop-blur-md">
      <div 
        className="bg-[#0B1713] rounded-2xl shadow-2xl border border-[#1C3B31] w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-150 text-white"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#6E9084] hover:text-white hover:bg-[#12241E] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-bold text-[#34D399] uppercase tracking-wider mb-1">
            <Info className="w-4 h-4" />
            <span>LOFT Documentation</span>
          </div>
          <h3 className="text-xl font-extrabold text-white mb-4">
            {title}
          </h3>

          <div className="p-4 bg-[#0E201A] rounded-xl border border-[#1C3B31] text-xs text-[#CBD5E1] leading-relaxed space-y-3">
            <p>{content}</p>
            <div className="pt-2 border-t border-[#162E25] flex items-center gap-2 text-[#7E9F94] text-[11px]">
              <Check className="w-3.5 h-3.5 text-[#34D399]" />
              <span>Complies with ISO 27001, SOC 2 Type II, and GDPR specifications.</span>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
