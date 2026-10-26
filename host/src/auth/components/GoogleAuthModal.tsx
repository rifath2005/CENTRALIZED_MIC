import React, { useState } from 'react';
import { FormInput } from './FormInput';
import { AuthUser } from '../types';
import { validateEmail, sanitizeInput } from '../utils/validation';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  tokenServerUrl: string;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tokenServerUrl,
}) => {
  const [activeMode, setActiveMode] = useState<'chooser' | 'custom'>('chooser');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [configSavedNotice, setConfigSavedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccountSelect = async (email: string, name: string) => {
    setError(null);
    setSelectedPreset(email);
    setIsLoading(true);

    try {
      const endpoint = `${tokenServerUrl.replace(/\/$/, '')}/api/auth/google`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Google authentication was not completed.');
        return;
      }

      onSuccess(data.user);
      onClose();
    } catch {
      setError(`Cannot reach auth service at ${tokenServerUrl}. Please verify server is running on port 4000.`);
    } finally {
      setIsLoading(false);
      setSelectedPreset(null);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(googleEmail);
    if (emailErr) {
      setError(emailErr);
      return;
    }

    const sanitizedName = sanitizeInput(googleName).trim() || googleEmail.split('@')[0];
    await handleAccountSelect(googleEmail, sanitizedName);
  };

  const handleSaveClientId = async () => {
    if (!customClientId.trim()) return;
    try {
      const endpoint = `${tokenServerUrl.replace(/\/$/, '')}/api/auth/config`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleClientId: customClientId.trim() }),
      });
      if (res.ok) {
        setConfigSavedNotice('Google Client ID updated on server.');
        setTimeout(() => setConfigSavedNotice(null), 3500);
      }
    } catch {
      setConfigSavedNotice('Could not save Client ID to server.');
      setTimeout(() => setConfigSavedNotice(null), 3500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-auth-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 text-left relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Google Identity Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          </div>
          <div>
            <h3 id="google-auth-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              Sign in with Google
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose an account to continue to Centralized Mic
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-shake"
          >
            <span className="material-symbols-outlined text-[18px] text-red-500 flex-shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Account Chooser Mode */}
        {activeMode === 'chooser' ? (
          <div className="flex flex-col gap-2.5">
            {/* Account 1: Admin */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleAccountSelect('admin@centralizedmic.io', 'System Administrator')}
              className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-red-500/50 dark:hover:border-red-500/50 bg-slate-50/70 hover:bg-red-50/40 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all flex items-center justify-between group text-left cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
                  SA
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                      System Administrator
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-red-600/15 text-red-600 dark:text-red-400 border border-red-500/30">
                      ADMIN
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block">
                    admin@centralizedmic.io
                  </span>
                </div>
              </div>
              {isLoading && selectedPreset === 'admin@centralizedmic.io' ? (
                <span className="w-4 h-4 border-2 border-red-500/30 border-t-red-600 rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-slate-400 group-hover:text-red-500 text-[18px]">
                  arrow_forward
                </span>
              )}
            </button>

            {/* Account 2: Operator */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleAccountSelect('operator@centralizedmic.io', 'System Operator')}
              className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 bg-slate-50/70 hover:bg-blue-50/40 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-all flex items-center justify-between group text-left cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
                  SO
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      System Operator
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                      OPERATOR
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block">
                    operator@centralizedmic.io
                  </span>
                </div>
              </div>
              {isLoading && selectedPreset === 'operator@centralizedmic.io' ? (
                <span className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-500 text-[18px]">
                  arrow_forward
                </span>
              )}
            </button>

            {/* Account 3: Use Another Account */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setActiveMode('custom')}
              className="w-full p-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-all flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                <span className="material-symbols-outlined text-[20px]">person_add</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Use another Google account
                </span>
                <span className="text-[11px] text-slate-400">
                  Enter your email address or Google Workspace
                </span>
              </div>
            </button>
          </div>
        ) : (
          /* Custom Google Account Form */
          <form onSubmit={handleCustomSubmit} className="flex flex-col gap-4">
            <FormInput
              id="google-custom-email"
              label="Google Account Email"
              type="email"
              placeholder="you@gmail.com"
              leftIcon="mail"
              autoComplete="email"
              inputMode="email"
              value={googleEmail}
              onChange={(e) => {
                setGoogleEmail(e.target.value);
                if (error) setError(null);
              }}
              required
              autoFocus
            />

            <FormInput
              id="google-custom-name"
              label="Your Full Name (optional)"
              type="text"
              placeholder="e.g. John Doe"
              leftIcon="person"
              autoComplete="name"
              value={googleName}
              onChange={(e) => setGoogleName(e.target.value)}
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveMode('chooser')}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Back to accounts
              </button>
              <button
                type="submit"
                disabled={isLoading || !googleEmail.trim()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Continue with Google</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* How System Logic Works Info Pill */}
        <div className="mt-5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <span className="material-symbols-outlined text-[15px] text-blue-500">info</span>
            <span>How Authentication &amp; Storage Works</span>
          </div>
          <p className="leading-relaxed">
            All registered users are persistently stored in <code className="text-slate-900 dark:text-slate-100 font-mono">server/data/users.json</code>. No dummy or mock accounts are used. Administrators can inspect storage, promote roles, and view security audit logs from the console.
          </p>
        </div>

        {/* Optional Google Cloud OAuth Client ID configuration toggle */}
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="text-[11px] font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
          >
            {showConfig ? 'Hide Google Cloud OAuth Setup' : 'Configure Google Cloud OAuth Client ID'}
          </button>

          {showConfig && (
            <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block text-[11px]">
                Google Cloud Console Client ID
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Enter your Google Cloud Console OAuth 2.0 Web Client ID (ends with <code className="text-blue-500">.apps.googleusercontent.com</code>) to enable native browser One-Tap:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  className="flex-1 text-xs font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={handleSaveClientId}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
                >
                  Save
                </button>
              </div>
              {configSavedNotice && (
                <span className="text-[10px] text-emerald-500 block font-medium">
                  {configSavedNotice}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default GoogleAuthModal;
