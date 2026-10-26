import React, { useState } from 'react';
import { FormInput } from './FormInput';
import { validateEmail } from '../utils/validation';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }
    setError(undefined);
    setIsLoading(true);

    try {
      // Simulate/call API
      await new Promise((resolve) => setTimeout(resolve, 800));
      setIsSubmitted(true);
    } catch {
      // Security standard: Always display the generic message regardless
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validateEmail(email) || undefined);
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
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
              <span className="material-symbols-outlined text-[28px]">mark_email_read</span>
            </div>
            <h3 id="forgot-password-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Check your inbox
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed max-w-sm">
              If an account exists with <strong className="text-slate-800 dark:text-slate-200">{email}</strong>, we have sent password reset instructions to that address.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shadow-sm"
            >
              Back to Login
            </button>
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
                Enter your email address and we will send you a secure link to reset your account password.
              </p>
            </div>

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
                setEmail(e.target.value);
                if (touched) setError(validateEmail(e.target.value) || undefined);
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
                    <span>Sending...</span>
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
