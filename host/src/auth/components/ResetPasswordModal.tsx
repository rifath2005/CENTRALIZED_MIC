import React, { useState, useEffect } from 'react';
import { FormInput } from './FormInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { calculatePasswordStrength, validatePassword } from '../utils/validation';

export interface ResetPasswordModalProps {
  isOpen: boolean;
  token: string;
  initialEmail?: string;
  tokenServerUrl?: string;
  onClose: () => void;
  onSuccess: (email: string) => void;
  onRequestNewLink: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  token,
  initialEmail = '',
  tokenServerUrl = 'http://localhost:4000',
  onClose,
  onSuccess,
  onRequestNewLink,
}) => {
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>(initialEmail);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordTouched, setNewPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate token against backend API when opened
  useEffect(() => {
    let isMounted = true;
    if (!isOpen || !token) {
      setIsValidatingToken(false);
      return;
    }

    setIsValidatingToken(true);
    setTokenError(null);

    fetch(`${tokenServerUrl}/api/auth/verify-reset-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json().then((data) => ({ status: res.status, ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!isMounted) return;
        if (ok && data.valid) {
          setTokenValid(true);
          if (data.email) {
            setEmail(data.email);
          }
        } else {
          setTokenValid(false);
          setTokenError(data.error || 'This password reset link is invalid or has expired.');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setTokenValid(false);
        setTokenError('Unable to connect to the authentication server to verify reset token.');
      })
      .finally(() => {
        if (isMounted) setIsValidatingToken(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, token, tokenServerUrl]);

  if (!isOpen) return null;

  const strength = calculatePasswordStrength(newPassword);

  const handlePasswordChange = (val: string) => {
    setNewPassword(val);
    setServerError(null);
    if (newPasswordTouched) {
      setPasswordError(validatePassword(val) || undefined);
    }
    if (confirmPasswordTouched && confirmPassword) {
      setConfirmError(val !== confirmPassword ? 'Passwords do not match' : undefined);
    }
  };

  const handleConfirmChange = (val: string) => {
    setConfirmPassword(val);
    setServerError(null);
    if (confirmPasswordTouched) {
      setConfirmError(val !== newPassword ? 'Passwords do not match' : undefined);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewPasswordTouched(true);
    setConfirmPasswordTouched(true);
    setServerError(null);

    const passErr = validatePassword(newPassword);
    if (passErr) {
      setPasswordError(passErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${tokenServerUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setServerError(data.error || 'Failed to reset password. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      // Clean up URL hash without full reload
      if (typeof window !== 'undefined' && window.location.hash) {
        try {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {}
      }

      setTimeout(() => {
        onSuccess(email);
        onClose();
      }, 1500);
    } catch {
      setServerError('Network error while resetting password. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-password-modal-title"
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

        {isValidatingToken ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <span className="w-8 h-8 border-3 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Verifying security token...
            </p>
          </div>
        ) : tokenValid === false ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[32px]">link_off</span>
            </div>
            <h3 id="reset-password-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Reset Link Invalid or Expired
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed max-w-sm">
              {tokenError || 'This password reset link has expired or has already been used.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full mt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[42px] py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
              >
                Back to Login
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestNewLink();
                }}
                className="flex-1 min-h-[42px] py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shadow-sm"
              >
                Request New Link
              </button>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
            </div>
            <h3 id="reset-password-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
              Password Reset Complete!
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed max-w-sm">
              Your password has been securely updated. Redirecting you to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400 mb-3">
                <span className="material-symbols-outlined text-[24px]">vpn_key</span>
              </div>
              <h3 id="reset-password-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Choose a new password
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Updating credentials for <strong className="text-slate-900 dark:text-slate-100">{email}</strong>
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

            {/* New Password */}
            <div className="flex flex-col gap-1">
              <FormInput
                id="reset-new-password"
                label="New password"
                isPassword
                autoComplete="new-password"
                placeholder="••••••••••••"
                leftIcon="lock"
                value={newPassword}
                error={passwordError}
                touched={newPasswordTouched}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => {
                  setNewPasswordTouched(true);
                  setPasswordError(validatePassword(newPassword) || undefined);
                }}
                required
              />
              <PasswordStrengthMeter strength={strength} password={newPassword} />
            </div>

            {/* Confirm Password */}
            <FormInput
              id="reset-confirm-password"
              label="Confirm new password"
              isPassword
              autoComplete="new-password"
              placeholder="••••••••••••"
              leftIcon="lock_clock"
              value={confirmPassword}
              error={confirmError}
              touched={confirmPasswordTouched}
              onChange={(e) => handleConfirmChange(e.target.value)}
              onBlur={() => {
                setConfirmPasswordTouched(true);
                setConfirmError(
                  confirmPassword !== newPassword ? 'Passwords do not match' : undefined
                );
              }}
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
                disabled={isSubmitting || strength.score < 4}
                className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Set New Password</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
