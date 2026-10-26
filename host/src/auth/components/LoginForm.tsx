import React, { useState, useRef } from 'react';
import { FormInput } from './FormInput';
import { SocialButtons } from './SocialButtons';
import { LoginFormData, ValidationErrors, AuthUser } from '../types';
import { validateEmail, sanitizeInput } from '../utils/validation';

interface LoginFormProps {
  onSuccess: (user: AuthUser) => void;
  onSwitchTab: () => void;
  onOpenForgotPassword: (email?: string) => void;
  tokenServerUrl?: string;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onSwitchTab,
  onOpenForgotPassword,
  tokenServerUrl = 'http://localhost:4000',
  addToast,
}) => {
  const [formData, setFormData] = useState<LoginFormData>(() => {
    const savedEmail = typeof window !== 'undefined' ? localStorage.getItem('saved_operator_email') || '' : '';
    return {
      email: savedEmail,
      password: '',
      rememberMe: Boolean(savedEmail),
    };
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Validate fields for submit or blur
  const validateField = (field: keyof LoginFormData, val: string): string | undefined => {
    if (field === 'email') {
      return validateEmail(val) || undefined;
    }
    if (field === 'password') {
      if (!val) return 'Password is required';
      return undefined;
    }
    return undefined;
  };

  // Real-time error clearing when correcting
  const handleChange = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setBannerError(null);

    if (touched[field] && typeof value === 'string') {
      const fieldError = validateField(field, value);
      setErrors((prev) => ({
        ...prev,
        [field]: fieldError,
      }));
    }
  };

  const handleBlur = (field: keyof LoginFormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const val = typeof formData[field] === 'string' ? (formData[field] as string) : '';
    const fieldError = validateField(field, val);
    setErrors((prev) => ({
      ...prev,
      [field]: fieldError,
    }));
  };

  // Check if form is valid without showing un-touched errors
  const isFormValid =
    Boolean(formData.email) &&
    !validateEmail(formData.email) &&
    formData.password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerError(null);

    // Mark all touched
    setTouched({ email: true, password: true });

    const emailErr = validateField('email', formData.email);
    const passErr = validateField('password', formData.password);

    if (emailErr || passErr) {
      setErrors({ email: emailErr, password: passErr });
      if (errorSummaryRef.current) {
        errorSummaryRef.current.focus();
      }
      return;
    }

    setIsLoading(true);

    try {
      const sanitizedEmail = sanitizeInput(formData.email).toLowerCase();
      const endpoint = `${tokenServerUrl.replace(/\/$/, '')}/api/auth/login`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sanitizedEmail,
          password: formData.password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429) {
          const retryMessage = data.error || 'Too many attempts. Please try again in 15 minutes.';
          setBannerError(retryMessage);
          addToast('error', retryMessage, 'Rate Limit Exceeded');
        } else {
          // Industry standard: Generic error message to prevent enumeration
          const genericMsg = 'Invalid email or password';
          setBannerError(genericMsg);
          addToast('error', genericMsg, 'Authentication Failed');
        }
        if (errorSummaryRef.current) {
          errorSummaryRef.current.focus();
        }
        return;
      }

      // Remember me handling
      if (formData.rememberMe) {
        localStorage.setItem('saved_operator_email', sanitizedEmail);
      } else {
        localStorage.removeItem('saved_operator_email');
      }

      // Successful login
      addToast('success', `Welcome back, ${data.user?.fullName || 'Operator'}!`, 'Login Successful');
      onSuccess(data.user);
    } catch {
      const errMsg = `Cannot reach authentication service at ${tokenServerUrl}. Please ensure server is running on port 4000.`;
      setBannerError(errMsg);
      addToast('error', errMsg, 'Connection Error');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="w-full flex flex-col text-left">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Welcome back
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Log in to continue to Centralized Mic Console
        </p>
      </div>

      {/* Screen Reader Error Summary Focus Anchor & Inline Banner */}
      {bannerError && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2.5 outline-none focus:ring-2 focus:ring-red-500/40 animate-shake"
        >
          <span className="material-symbols-outlined text-[20px] text-red-500 flex-shrink-0" aria-hidden="true">
            error
          </span>
          <span className="font-medium">{bannerError}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <FormInput
          ref={emailInputRef}
          id="login-email"
          label="Email address"
          type="email"
          placeholder="operator@centralizedmic.io"
          leftIcon="mail"
          autoComplete="email"
          inputMode="email"
          value={formData.email}
          touched={touched.email}
          error={errors.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          required
        />

        {/* Password Field */}
        <FormInput
          id="login-password"
          label="Password"
          isPassword
          placeholder="••••••••••••"
          leftIcon="lock"
          autoComplete="current-password"
          value={formData.password}
          touched={touched.password}
          error={errors.password}
          onChange={(e) => handleChange('password', e.target.value)}
          onBlur={() => handleBlur('password')}
          required
        />

        {/* Row: Remember me & Forgot Password */}
        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              id="login-remember-me"
              checked={formData.rememberMe}
              onChange={(e) => handleChange('rememberMe', e.target.checked)}
              className="w-4 h-4 rounded text-red-600 focus:ring-red-500/40 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
            />
            <span className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Remember me
            </span>
          </label>

          <button
            type="button"
            onClick={() => onOpenForgotPassword(formData.email)}
            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:outline-none focus:underline transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {/* Log In Button */}
        <button
          type="submit"
          disabled={!isFormValid || isLoading}
          className="w-full min-h-[44px] h-11 md:h-12 mt-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white text-sm font-semibold shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Logging in...</span>
            </>
          ) : (
            <span>Log In</span>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6 flex items-center justify-center">
        <div className="w-full border-t border-slate-200 dark:border-slate-800" />
        <span className="absolute bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          OR
        </span>
      </div>

      {/* Native Google Sign-In with Real GIS */}
      <SocialButtons
        tokenServerUrl={tokenServerUrl}
        onSuccess={(user) => {
          addToast('success', `Welcome back, ${user.fullName}!`, 'Google Sign-In');
          onSuccess(user);
        }}
        onError={(err) => {
          setBannerError(err);
          addToast('error', err, 'Google Sign-In');
        }}
      />

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onSwitchTab}
          className="font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:outline-none focus:underline transition-colors ml-1"
        >
          Sign up
        </button>
      </div>
    </div>
  );
};
