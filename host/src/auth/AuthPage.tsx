import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { SignupForm } from './components/SignupForm';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import { TermsModal } from './components/TermsModal';
import { ToastContainer } from './components/Toast';
import { AuthTab, AuthUser, ToastMessage } from './types';

interface AuthPageProps {
  onAuthSuccess?: (user: AuthUser) => void;
  onClose?: () => void;
  tokenServerUrl?: string;
  initialTab?: AuthTab;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthSuccess,
  onClose,
  tokenServerUrl = 'http://localhost:4000',
  initialTab = 'login',
}) => {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme_mode');
      if (savedTheme) return savedTheme === 'dark';
      return document.documentElement.classList.contains('dark') || true;
    }
    return true;
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [termsModalState, setTermsModalState] = useState<{
    isOpen: boolean;
    tab: 'terms' | 'privacy';
  }>({
    isOpen: false,
    tab: 'terms',
  });

  // Sync theme with HTML document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme_mode', 'light');
    }
  }, [isDarkMode]);

  const addToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    title?: string
  ) => {
    const newToast: ToastMessage = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      title,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleOpenForgotPassword = (email?: string) => {
    setForgotEmail(email || '');
    setIsForgotModalOpen(true);
  };

  const handleOpenTerms = (tab: 'terms' | 'privacy') => {
    setTermsModalState({ isOpen: true, tab });
  };

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-300 flex items-center justify-center p-4 sm:p-6 md:p-10 select-none ${
        isDarkMode
          ? 'bg-slate-950 text-slate-100 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black'
          : 'bg-slate-50 text-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-indigo-50/50 to-slate-200'
      }`}
    >
      {/* Top Bar Controls (Theme Toggle & Optional Close) */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-40 flex items-center gap-2">
        {/* Dark/Light Mode Toggle Button */}
        <button
          type="button"
          onClick={() => setIsDarkMode((prev) => !prev)}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl border border-slate-300/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500/40 flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDarkMode ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Close / Return to Host Console Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to Operator Console"
            title="Back to Console"
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl border border-slate-300/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500/40 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {/* Main Split-Card Container */}
      <div className="w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900 flex flex-col md:flex-row transition-all duration-300 animate-fadeInUp">
        {/* ═══════════════ LEFT PANEL (45% Branding) ═══════════════ */}
        <div className="md:w-[45%] bg-gradient-to-br from-red-600 via-rose-700 to-slate-950 p-6 sm:p-8 md:p-10 flex flex-col justify-between text-white relative overflow-hidden">
          {/* Subtle Ambient Wave Background Graphic */}
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <svg
              className="w-full h-full object-cover"
              viewBox="0 0 400 600"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="200" cy="300" r="180" stroke="white" strokeWidth="2" strokeDasharray="6 6" />
              <circle cx="200" cy="300" r="140" stroke="white" strokeWidth="2" />
              <circle cx="200" cy="300" r="100" stroke="white" strokeWidth="2" strokeDasharray="4 4" />
              <circle cx="200" cy="300" r="60" stroke="white" strokeWidth="3" />
            </svg>
          </div>

          {/* Top Logo & System Title */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-[24px]">graphic_eq</span>
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-wider uppercase">Centralized Mic</h1>
              <p className="text-[10px] text-white/70 font-mono tracking-widest uppercase">
                Enterprise PA Console
              </p>
            </div>
          </div>

          {/* Middle Value Proposition & Subtle Illustration */}
          <div className="relative z-10 my-8 md:my-auto text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white/90 mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>48kHz HD Audio Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-3">
              Studio-grade meeting room audio control.
            </h2>
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-normal">
              Seamlessly multiplex smartphones into wireless conference microphones with automated transient suppression, feedback prevention, and zero-latency floor arbitration.
            </p>

            {/* Feature Pills */}
            <div className="mt-6 flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5 text-xs text-white/90">
                <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                </span>
                <span>Ultra-low latency SFU audio pipeline</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-white/90">
                <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px]">shield</span>
                </span>
                <span>Automated sneeze guard &amp; acoustic limiter</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-white/90">
                <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px]">cell_merge</span>
                </span>
                <span>QR phone sync for web and mobile attendees</span>
              </div>
            </div>
          </div>

          {/* Bottom Security Badge */}
          <div className="relative z-10 pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-white/70">
            <span className="flex items-center gap-1.5 font-mono">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              AES-256 Encrypted Session
            </span>
            <span className="font-mono">v2.4.0</span>
          </div>
        </div>

        {/* ═══════════════ RIGHT PANEL (55% Auth Form) ═══════════════ */}
        <div className="md:w-[55%] p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center bg-white dark:bg-slate-900 transition-colors">
          <div className="w-full max-w-[448px] flex flex-col">
            {/* Tab Switcher with Animated Sliding Indicator */}
            <div className="relative w-full bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl mb-6 flex items-center border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
              {/* Sliding Active Pill */}
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-slate-900 shadow-sm transition-all duration-300 ease-in-out ${
                  activeTab === 'login' ? 'left-1' : 'left-[calc(50%+2px)]'
                }`}
              />

              {/* Login Tab Button */}
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className={`relative z-10 flex-1 py-2 text-xs font-bold text-center transition-colors rounded-lg focus:outline-none min-h-[38px] flex items-center justify-center ${
                  activeTab === 'login'
                    ? 'text-red-600 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Log In
              </button>

              {/* Sign Up Tab Button */}
              <button
                type="button"
                onClick={() => setActiveTab('signup')}
                className={`relative z-10 flex-1 py-2 text-xs font-bold text-center transition-colors rounded-lg focus:outline-none min-h-[38px] flex items-center justify-center ${
                  activeTab === 'signup'
                    ? 'text-red-600 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Forms with Smooth Fade Transition */}
            <div className="w-full transition-opacity duration-300">
              {activeTab === 'login' ? (
                <LoginForm
                  onSuccess={(user) => {
                    if (onAuthSuccess) onAuthSuccess(user);
                  }}
                  onSwitchTab={() => setActiveTab('signup')}
                  onOpenForgotPassword={handleOpenForgotPassword}
                  tokenServerUrl={tokenServerUrl}
                  addToast={addToast}
                />
              ) : (
                <SignupForm
                  onSuccess={(user) => {
                    if (onAuthSuccess) onAuthSuccess(user);
                  }}
                  onSwitchTab={() => setActiveTab('login')}
                  onOpenTerms={handleOpenTerms}
                  tokenServerUrl={tokenServerUrl}
                  addToast={addToast}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        initialEmail={forgotEmail}
        onClose={() => setIsForgotModalOpen(false)}
      />

      <TermsModal
        isOpen={termsModalState.isOpen}
        defaultTab={termsModalState.tab}
        onClose={() => setTermsModalState({ isOpen: false, tab: 'terms' })}
      />

      {/* Accessible Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
export default AuthPage;
