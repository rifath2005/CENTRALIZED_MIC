import React, { useState } from 'react';
import { FormInput } from './FormInput';
import { validateEmail, normalizeEmail } from '../utils/validation';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  tokenServerUrl?: string;
  onResetLinkTriggered?: (token: string, email: string) => void;
}

interface ResetResponse {
  success: boolean;
  emailSent?: boolean;
  message?: string;
  resetLink?: string;
  error?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  tokenServerUrl = 'http://localhost:4000',
  onResetLinkTriggered,
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetResponse, setResetResponse] = useState<ResetResponse | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Sync initialEmail if modal opens with a pre-filled email
  React.useEffect(() => {
    if (initialEmail) {
      setEmail(normalizeEmail(initialEmail));
    }
  }, [initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerError(null);

    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }
    setError(undefined);
    setIsLoading(true);

    try {
      const normalized = normalizeEmail(email);
      const res = await fetch(`${tokenServerUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      });

      const data: ResetResponse = await res.json().catch(() => ({
        success: false,
        error: 'Invalid response from authentication server',
      }));

      if (!res.ok) {
        if (res.status === 429) {
          setServerError('Too many reset requests. Please wait a few moments before trying again.');
        } else {
          setServerError(data.error || 'Failed to request password reset. Please try again.');
        }
        return;
      }

      setResetResponse(data);
      setIsSubmitted(true);
    } catch (err: any) {
      // In case of network failure connecting to token server
      setServerError(`Unable to reach authentication server (${tokenServerUrl}). Please ensure the server is running.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validateEmail(email) || undefined);
  };

  const handleCopyLink = async () => {
    if (!resetResponse?.resetLink) return;
    try {
      await navigator.clipboard.writeText(resetResponse.resetLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback if clipboard API is restricted
      setIsCopied(false);
    }
  };

  const handleOpenDirectReset = () => {
    if (!resetResponse?.resetLink) return;
    try {
      const parsedUrl = new URL(resetResponse.resetLink);
      const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
      const token = hashParams.get('reset-token');
      const resetEmail = hashParams.get('email') || email;
      if (token && onResetLinkTriggered) {
        onResetLinkTriggered(token, resetEmail);
        onClose();
        return;
      }
    } catch {}
    window.location.href = resetResponse.resetLink;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 text-left relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {isSubmitted ? (
          <div className="flex flex-col items-center text-center py-2">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-inner ${
              resetResponse?.emailSent
                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
            }`}>
              <span className="material-symbols-outlined text-[32px]">
                {resetResponse?.emailSent ? 'mark_email_read' : 'key'}
              </span>
            </div>

            <h3 id="forgot-password-title" className="text-xl font-bold text-slate-900 dark:text-white">
              {resetResponse?.emailSent ? 'Check Your Inbox' : 'Reset Link Generated'}
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed max-w-sm">
              {resetResponse?.emailSent ? (
                <>
                  We sent an email with password reset instructions to{' '}
                  <strong className="text-slate-900 dark:text-slate-100">{email}</strong>.
                  Please check your inbox (and spam/junk folder) within the next 60 minutes.
                </>
              ) : (
                <>
                  A secure 60-minute password reset link was created for{' '}
                  <strong className="text-slate-900 dark:text-slate-100">{email}</strong>.
                </>
              )}
            </p>

            {/* Direct Link Box if SMTP is not active or direct link is available */}
            {resetResponse?.resetLink && (
              <div className="w-full mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-amber-500">info</span>
                    Direct Reset Link
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Valid 60m</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={resetResponse.resetLink}
                    className="flex-1 bg-white dark:bg-slate-900 text-[11px] font-mono text-slate-800 dark:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 truncate select-all focus:outline-none"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1 flex-shrink-0"
                    title="Copy reset link"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {isCopied ? 'check' : 'content_copy'}
                    </span>
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {resetResponse.emailSent ? 'Also sent via SMTP' : 'SMTP is offline; use link directly'}
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenDirectReset}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                  >
                    <span>Open Reset Page</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 w-full mt-6">
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setResetResponse(null);
                }}
                className="flex-1 min-h-[42px] py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
              >
                Send to Another Email
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[42px] py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>Back to Login</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400 mb-3">
                <span className="material-symbols-outlined text-[24px]">lock_reset</span>
              </div>
              <h3 id="forgot-password-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Reset your password
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Enter your registered operator email address. We will dispatch a secure link to reset your account password.
              </p>
            </div>

            {serverError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5"
              >
                <span className="material-symbols-outlined text-[18px] text-red-600 flex-shrink-0 mt-0.5">
                  error
                </span>
                <span className="leading-relaxed">{serverError}</span>
              </div>
            )}

            <FormInput
              id="reset-email"
              label="Email address"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@company.com"
              leftIcon="mail"
              value={email}
              error={error}
              touched={touched}
              onChange={(e) => {
                const lower = normalizeEmail(e.target.value);
                setEmail(lower);
                if (touched) setError(validateEmail(lower) || undefined);
              }}
              onBlur={handleBlur}
              required
            />

            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
