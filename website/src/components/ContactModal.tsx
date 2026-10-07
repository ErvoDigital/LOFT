import React, { useState } from 'react';
import { X, Send, Check, MessageSquare, PhoneCall, ShieldCheck } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('Enterprise Demo');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      onShowToast('Support & sales inquiry sent. Expect a reply in < 2 hours.');
      setSubmitted(false);
      setName('');
      setEmail('');
      setMessage('');
      onClose();
    }, 1200);
  };

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
            <MessageSquare className="w-4 h-4" />
            <span>Connect with LOFT</span>
          </div>
          <h3 className="text-xl font-extrabold text-white">
            Contact Support & Enterprise Sales
          </h3>
          <p className="text-xs text-[#8FAFA4] mt-1 mb-6">
            Have questions about multi-tenant security, custom SLAs, or migrating an entire agency? We are here to help.
          </p>

          {submitted ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Message Dispatched</h4>
              <p className="text-xs text-[#8FAFA4]">
                A dedicated specialist has received your inquiry.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-[#12241E] border border-[#1C3B31] rounded-xl text-white placeholder:text-[#527469] focus:outline-none focus:border-[#22C55E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-[#12241E] border border-[#1C3B31] rounded-xl text-white placeholder:text-[#527469] focus:outline-none focus:border-[#22C55E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                  Topic of Discussion
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-[#12241E] border border-[#1C3B31] rounded-xl text-white focus:outline-none focus:border-[#22C55E]"
                >
                  <option value="Enterprise Demo">Schedule Enterprise Product Walkthrough</option>
                  <option value="Agency Pricing">Agency / Multiple Seat Discount</option>
                  <option value="Security Architecture">SOC2, HIPAA & Data Isolation Review</option>
                  <option value="Technical Support">Technical & Integration Support</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#CBD5E1] mb-1">
                  How can we help?
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Tell us about your team setup and tools you are currently using..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[#12241E] border border-[#1C3B31] rounded-xl text-white placeholder:text-[#527469] focus:outline-none focus:border-[#22C55E]"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_16px_rgba(21,128,93,0.35)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Message</span>
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-[#162E25] flex items-center justify-between text-xs text-[#7E9F94]">
            <span className="flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-[#5A7C71]" />
              Direct Support: support@getloft.io
            </span>
            <span className="flex items-center gap-1 text-[#34D399]">
              <ShieldCheck className="w-3.5 h-3.5" />
              SLA Backed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
