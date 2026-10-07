import React, { useState } from 'react';
import { X, Check, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'signin' | 'signup';
  onClose: () => void;
  onSuccess: (userName: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'signin',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [workspaceCount, setWorkspaceCount] = useState('3-5');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setTimeout(() => {
        onSuccess(name || email.split('@')[0] || 'User');
        onClose();
        setSubmitted(false);
      }, 900);
    }, 600);
  };

  const handleGoogleOneClick = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setTimeout(() => {
        onSuccess('Workspace Operator');
        onClose();
        setSubmitted(false);
      }, 700);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050C0A]/85 backdrop-blur-md">
      {/* Ambient background glow matching design */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_rgba(21,128,93,0.18)_0%,_rgba(6,17,14,0.85)_75%)]" />

      <div 
        className="w-full max-w-[420px] relative z-10 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-1.5 rounded-full text-[#6E9084] hover:text-white hover:bg-[#12241E] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Icon & Heading */}
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-[#15805D] rounded-xl mx-auto flex items-center justify-center text-white font-extrabold text-xl shadow-[0_4px_16px_rgba(21,128,93,0.4)] mb-3">
            L
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {mode === 'signin' ? 'Welcome back' : 'Create your workspace'}
          </h2>
          <p className="text-xs text-[#7E9F94] mt-1">
            {mode === 'signin'
              ? 'Sign in to your LOFT workspace'
              : 'One home for all your client & internal teams'}
          </p>
        </div>

        {/* Dark Emerald Container Card */}
        <div className="bg-[#0E201A]/95 border border-[#1C3B31] rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
          {submitted ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#15805D]/20 text-[#34D399] border border-[#15805D]/40 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Authenticated</h4>
              <p className="text-xs text-[#7E9F94]">
                Entering your unified cross-workspace cockpit...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Workspace Lead"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-[#152D25] border border-[#1F4136] rounded-xl text-white placeholder:text-[#527469] focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/30 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-[#152D25] border border-[#1F4136] rounded-xl text-white placeholder:text-[#527469] focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/30 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#CBD5E1]">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => alert ? undefined : null}
                      className="text-xs text-[#2DD4BF] hover:text-[#5EEAD4] font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 pr-10 bg-[#152D25] border border-[#1F4136] rounded-xl text-white placeholder:text-[#527469] focus:outline-none focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#5C7E73] hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
                    How many workspaces do you manage?
                  </label>
                  <select
                    value={workspaceCount}
                    onChange={(e) => setWorkspaceCount(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 bg-[#152D25] border border-[#1F4136] rounded-xl text-white focus:outline-none focus:border-[#22C55E] cursor-pointer"
                  >
                    <option value="1-2">1 - 2 Workspaces</option>
                    <option value="3-5">3 - 5 Workspaces (Agency / Multi-Team)</option>
                    <option value="6+">6+ Workspaces (Advisory / Studio)</option>
                  </select>
                </div>
              )}

              {/* Primary Emerald Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#178564] to-[#14795B] hover:from-[#19946F] hover:to-[#168565] text-white text-xs font-bold rounded-xl shadow-[0_4px_16px_rgba(21,128,93,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <span>{mode === 'signin' ? 'Sign in' : 'Create account'}</span>
                )}
              </button>

              {/* Divider */}
              <div className="relative py-2 flex items-center justify-center">
                <div className="w-full border-t border-[#1C3B31]"></div>
                <span className="absolute bg-[#0E201A] px-3 text-[11px] text-[#5A7C71]">
                  or
                </span>
              </div>

              {/* Google 1-Click Pill */}
              <button
                type="button"
                onClick={handleGoogleOneClick}
                className="w-full bg-white hover:bg-neutral-100 text-neutral-800 p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-3 cursor-pointer border border-neutral-200"
              >
                {/* Google G Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.41 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.59 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span className="text-xs font-bold text-neutral-800">
                  Continue with Google
                </span>
              </button>
            </form>
          )}

          {/* Toggle Sign In / Create One */}
          <div className="mt-5 pt-4 border-t border-[#1C3B31] text-center text-xs text-[#7E9F94]">
            {mode === 'signin' ? (
              <span>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-medium text-[#2DD4BF] hover:text-[#5EEAD4] cursor-pointer"
                >
                  Create one
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-medium text-[#2DD4BF] hover:text-[#5EEAD4] cursor-pointer"
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
