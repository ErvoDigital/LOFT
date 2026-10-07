import React, { useState, useEffect } from 'react';
import { Search, X, CheckCircle, FileText, MessageSquare, ArrowRight, CornerDownLeft } from 'lucide-react';
import { PageType } from '../types';

interface CommandKModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: PageType) => void;
  onShowToast: (msg: string) => void;
}

export const CommandKModal: React.FC<CommandKModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onShowToast,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickItems = [
    {
      id: 'item-1',
      category: 'Cross-Workspace Task',
      title: 'Finalize Q3 Brand Design Guidelines & Token Sync',
      workspace: 'Ervo Digital',
      icon: <CheckCircle className="w-4 h-4 text-[#34D399]" />,
      action: () => {
        onShowToast('Navigated to Ervo Digital > Task #Q3-Brand');
        onClose();
      },
    },
    {
      id: 'item-2',
      category: 'Document',
      title: 'SOC2 Type II Compliance Architecture & Security Matrix.pdf',
      workspace: 'Acme Global',
      icon: <FileText className="w-4 h-4 text-teal-400" />,
      action: () => {
        onShowToast('Opened encrypted document in Acme Global workspace');
        onClose();
      },
    },
    {
      id: 'item-3',
      category: 'Thread',
      title: 'Discussion: 4.2x latency improvement on vector index release',
      workspace: 'HyperScale AI',
      icon: <MessageSquare className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onShowToast('Switched to HyperScale AI discussion thread');
        onClose();
      },
    },
    {
      id: 'item-4',
      category: 'Navigation',
      title: 'Explore All Enterprise & Team Pricing Plans',
      workspace: 'LOFT Platform',
      icon: <ArrowRight className="w-4 h-4 text-[#34D399]" />,
      action: () => {
        onNavigate('pricing');
        onClose();
      },
    },
    {
      id: 'item-5',
      category: 'Navigation',
      title: 'View Engineering & Product Architecture deep-dive',
      workspace: 'LOFT Platform',
      icon: <ArrowRight className="w-4 h-4 text-[#34D399]" />,
      action: () => {
        onNavigate('features');
        onClose();
      },
    },
  ];

  const filteredItems = quickItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.workspace.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-[#050C0A]/80 backdrop-blur-md">
      <div 
        className="bg-[#0B1713] rounded-2xl shadow-2xl border border-[#1C3B31] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-white"
        role="dialog"
        aria-modal="true"
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#162E25] flex items-center gap-3 bg-[#08120F]">
          <Search className="w-5 h-5 text-[#34D399] shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search across all 4 workspaces, files, tasks, or commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full text-sm text-white bg-transparent focus:outline-none placeholder:text-[#527469]"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#5C7E74] hover:text-white hover:bg-[#12241E] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5A7C71]">
            {query ? 'Matching Results' : 'Suggested Cross-Workspace Items'}
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#6E9084]">
              No results found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#12241E] text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-[#12241E] rounded-lg group-hover:bg-[#162E26] border border-[#1C3B31] transition-colors">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[#7E9F94] mt-0.5">
                      <span className="font-medium text-[#A7C8BD] bg-[#162E26] px-1.5 py-0.5 rounded border border-[#1F3D34]">
                        {item.workspace}
                      </span>
                      <span>{item.category}</span>
                    </div>
                  </div>
                </div>
                <CornerDownLeft className="w-3.5 h-3.5 text-[#3E5F55] group-hover:text-[#34D399] shrink-0 ml-2" />
              </button>
            ))
          )}
        </div>

        {/* Bottom Keyboard Hint */}
        <div className="bg-[#07110E] px-4 py-2.5 border-t border-[#162E25] flex items-center justify-between text-[11px] text-[#5C7E74]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-[#12241E] border border-[#1C3B31] rounded text-[10px] font-mono text-[#A7C8BD]">
                ESC
              </kbd>{' '}
              to close
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-[#12241E] border border-[#1C3B31] rounded text-[10px] font-mono text-[#A7C8BD]">
                ↵
              </kbd>{' '}
              to jump
            </span>
          </div>
          <span className="text-[#34D399] font-semibold">LOFT Omnisearch v2.4</span>
        </div>
      </div>
    </div>
  );
};
