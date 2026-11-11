import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FormInput } from './FormInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { SocialButtons } from './SocialButtons';
import { SignupFormData, ValidationErrors, AuthUser } from '../types';
import {
  validateEmail,
  normalizeEmail,
  validateFullName,
  validatePassword,
  calculatePasswordStrength,
  sanitizeInput,
  debounce,
  suggestEmailDomain,
  generateSecurePassword,
} from '../utils/validation';

interface SignupFormProps {
  onSuccess: (user: AuthUser) => void;
  onSwitchTab: () => void;
  onOpenTerms: (tab: 'terms' | 'privacy') => void;
  tokenServerUrl?: string;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({
  onSuccess,
  onSwitchTab,
  onOpenTerms,
  tokenServerUrl = 'http://localhost:4000',
  addToast,
}) => {
  // 2-Step Guided Flow: 1 = Identity & Email, 2 = Password & Security
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const [formData, setFormData] = useState<SignupFormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'available' | 'taken' | null>(null);
  const [suggestedDomain, setSuggestedDomain] = useState<string | null>(null);
  const [isPasswordGenerated, setIsPasswordGenerated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Live password strength calculation
  const passwordStrength = useMemo(
    () => calculatePasswordStrength(formData.password),
    [formData.password]
  );

  // Debounced email availability checker
  const checkEmailAvailability = useMemo(
    () =>
      debounce(async (emailToTest: string) => {
        const formatErr = validateEmail(emailToTest);
        if (formatErr || !emailToTest) {
          setIsCheckingEmail(false);
          setEmailStatus(null);
          return;
        }

        setIsCheckingEmail(true);
        try {
          const endpoint = `${tokenServerUrl.replace(/\/$/, '')}/api/auth/check-email`;
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailToTest.trim().toLowerCase() }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            if (data.available === false) {
              setEmailStatus('taken');
              setErrors((prev) => ({ ...prev, email: 'This email address is already registered' }));
            } else {
              setEmailStatus('available');
              setErrors((prev) => ({ ...prev, email: undefined }));
            }
          }
        } catch {
          setEmailStatus(null);
        } finally {
          setIsCheckingEmail(false);
        }
      }, 450),
    [tokenServerUrl]
  );

  useEffect(() => {
    return () => {
      checkEmailAvailability.cancel();
    };
  }, [checkEmailAvailability]);

  // Validation engine for single fields
  const validateField = (field: keyof SignupFormData, val: string | boolean): string | undefined => {
    switch (field) {
      case 'fullName':
        return validateFullName(String(val)) || undefined;
      case 'email':
        return (
          validateEmail(String(val)) ||
          (emailStatus === 'taken' ? 'This email address is already registered' : undefined)
        );
      case 'password':
        return validatePassword(String(val)) || undefined;
      case 'confirmPassword':
        if (!val) return 'Please confirm your password';
        if (val !== formData.password) return 'Passwords do not match';
        return undefined;
      case 'agreeTerms':
        if (!val) return 'You must agree to the Terms of Service to continue';
        return undefined;
      default:
        return undefined;
    }
  };

  const handleChange = (field: keyof SignupFormData, value: string | boolean) => {
    if (field === 'email' && typeof value === 'string') {
      value = normalizeEmail(value);
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
    setBannerError(null);

    // If editing email, check domain typos and trigger live availability lookup
    if (field === 'email' && typeof value === 'string') {
      setEmailStatus(null);
      const suggestion = suggestEmailDomain(value);
      setSuggestedDomain(suggestion);

      if (value.includes('@') && value.includes('.')) {
        checkEmailAvailability(value);
      }
    }

    // Revalidate if field was already blurred
    if (touched[field]) {
      const fieldError = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: fieldError }));
    }

    // Live confirm password check
    if (field === 'password' && touched.confirmPassword) {
      if (formData.confirmPassword && value !== formData.confirmPassword) {
        setErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      } else if (formData.confirmPassword) {
        setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
      }
    }
  };

  const handleBlur = (field: keyof SignupFormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const val = formData[field];
    const fieldError = validateField(field, val);
    setErrors((prev) => ({ ...prev, [field]: fieldError }));
  };

  // Step 1 Validity Check
  const isNameValid = formData.fullName.trim().length >= 2 && !validateFullName(formData.fullName);
  const isEmailValid = Boolean(
    formData.email && !validateEmail(formData.email) && emailStatus !== 'taken' && !isCheckingEmail
  );
  const isStep1Ready = isNameValid && isEmailValid;

  // Step 2 Validity Check
  const isPasswordValid = Boolean(
    formData.password && !validatePassword(formData.password) && passwordStrength.score >= 3
  );
  const isConfirmValid = Boolean(
    formData.confirmPassword && formData.confirmPassword === formData.password
  );
  const isFormValid = isStep1Ready && isPasswordValid && isConfirmValid && formData.agreeTerms;

  // Advance from Step 1 to Step 2
  const handleProceedToStep2 = () => {
    setTouched((prev) => ({ ...prev, fullName: true, email: true }));
    const nameErr = validateField('fullName', formData.fullName);
    const emailErr = validateField('email', formData.email);

    if (nameErr || emailErr || !isStep1Ready) {
      setErrors((prev) => ({ ...prev, fullName: nameErr, email: emailErr }));
      return;
    }

    setCurrentStep(2);
    // Smooth auto-focus into password field on step change
    setTimeout(() => {
      if (passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
    }, 150);
  };

  // One-click apply domain suggestion (e.g. user@gmai.com -> user@gmail.com)
  const handleApplySuggestion = () => {
    if (!suggestedDomain) return;
    handleChange('email', suggestedDomain);
    setSuggestedDomain(null);
  };

  // One-click generate cryptographically secure password
  const handleGeneratePassword = () => {
    const generated = generateSecurePassword();
    setFormData((prev) => ({
      ...prev,
      password: generated,
      confirmPassword: generated,
    }));
    setTouched((prev) => ({
      ...prev,
      password: true,
      confirmPassword: true,
    }));
    setErrors((prev) => ({
      ...prev,
      password: undefined,
      confirmPassword: undefined,
    }));
    setIsPasswordGenerated(true);
    setTimeout(() => setIsPasswordGenerated(false), 3000);

    try {
      navigator.clipboard.writeText(generated);
      addToast(
        'info',
        'Strong password generated & copied to your clipboard!',
        'Password Generated'
      );
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerError(null);

    // If on Step 1, advance to Step 2
    if (currentStep === 1) {
      handleProceedToStep2();
      return;
    }

    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
      agreeTerms: true,
    });

    const nameErr = validateField('fullName', formData.fullName);
    const emailErr = validateField('email', formData.email);
    const passErr = validateField('password', formData.password);
    const confErr = validateField('confirmPassword', formData.confirmPassword);
    const termsErr = validateField('agreeTerms', formData.agreeTerms);

    if (nameErr || emailErr || passErr || confErr || termsErr) {
      setErrors({
        fullName: nameErr,
        email: emailErr,
        password: passErr,
        confirmPassword: confErr,
        agreeTerms: termsErr,
      });

      // If email or name had errors, bounce back to Step 1
      if (nameErr || emailErr) {
        setCurrentStep(1);
      }

      if (errorSummaryRef.current) {
        errorSummaryRef.current.focus();
      }
      return;
    }

    setIsLoading(true);

    try {
      const sanitizedName = sanitizeInput(formData.fullName);
      const sanitizedEmail = sanitizeInput(formData.email).toLowerCase();
      const endpoint = `${tokenServerUrl.replace(/\/$/, '')}/api/auth/signup`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: sanitizedName,
          email: sanitizedEmail,
          password: formData.password,
          agreeTerms: formData.agreeTerms,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          const conflictMsg = 'An account with this email address already exists';
          setErrors((prev) => ({ ...prev, email: conflictMsg }));
          setBannerError(conflictMsg);
          setCurrentStep(1);
          addToast('error', conflictMsg, 'Account Exists');
        } else if (response.status === 429) {
          const rateMsg = data.error || 'Too many signup attempts. Please try again later.';
          setBannerError(rateMsg);
          addToast('error', rateMsg, 'Rate Limit');
        } else {
          const genErr = data.error || 'Failed to create account. Please try again.';
          setBannerError(genErr);
          addToast('error', genErr, 'Registration Failed');
        }
        if (errorSummaryRef.current) {
          errorSummaryRef.current.focus();
        }
        return;
      }

      if (data.user?.status === 'pending') {
        addToast(
          'info',
          'Registration submitted! Your operator account is currently awaiting administrator approval.',
          'Approval Pending'
        );
      } else {
        addToast('success', 'Your account has been created successfully!', 'Welcome to Centralized Mic');
      }
      onSuccess(data.user);
    } catch {
      const errMsg = `Cannot reach registration service at ${tokenServerUrl}. Please verify server is running on port 4000.`;
      setBannerError(errMsg);
      addToast('error', errMsg, 'Connection Error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col text-left">
      {/* ─── STEP PROGRESS INDICATOR ─── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
            Step {currentStep} of 2
          </span>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {currentStep === 1 ? '1. Operator Identity & Email' : '2. Password & Security'}
          </span>
        </div>

        {/* 2-Segment Step Bar */}
        <div className="grid grid-cols-2 gap-2 h-1.5 w-full">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              currentStep >= 1 ? 'bg-red-600' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          />
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              currentStep === 2 ? 'bg-red-600' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          />
        </div>
      </div>

      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {currentStep === 1 ? 'Create your operator account' : 'Set your account password'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {currentStep === 1
            ? 'Enter your name and registered email to begin operator verification.'
            : 'Choose a strong password to protect your live broadcasting access.'}
        </p>
      </div>

      {/* Inline Banner Alert */}
      {bannerError && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center gap-2.5 outline-none focus:ring-2 focus:ring-red-500/40 animate-shake"
        >
          <span className="material-symbols-outlined text-[20px] text-red-500 flex-shrink-0" aria-hidden="true">
            error
          </span>
          <span className="font-medium">{bannerError}</span>
        </div>
      )}

      {/* ─── FORM ─── */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        {/* ═══════════════ STEP 1: IDENTITY & EMAIL ═══════════════ */}
        {currentStep === 1 ? (
          <div className="space-y-3.5 animate-fadeIn">
            {/* Full Name */}
            <FormInput
              id="signup-fullName"
              label="Full name"
              type="text"
              placeholder="Jane Doe"
              leftIcon="person"
              autoComplete="name"
              value={formData.fullName}
              touched={touched.fullName}
              error={errors.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              onBlur={() => handleBlur('fullName')}
              required
            />

            {/* Email Address with Availability Indicator */}
            <div>
              <FormInput
                id="signup-email"
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isStep1Ready) {
                    e.preventDefault();
                    handleProceedToStep2();
                  }
                }}
                required
                rightAction={
                  isCheckingEmail ? (
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin" />
                  ) : emailStatus === 'available' ? (
                    <span
                      className="material-symbols-outlined text-[18px] text-emerald-500"
                      title="Email is available"
                    >
                      check_circle
                    </span>
                  ) : null
                }
              />

              {/* Domain Typo Suggestion Pill */}
              {suggestedDomain && (
                <div className="mt-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-500/20 text-xs flex items-center justify-between text-amber-800 dark:text-amber-200">
                  <span className="text-[11px] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-amber-500">
                      lightbulb
                    </span>
                    <span>Did you mean <strong>{suggestedDomain}</strong>?</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleApplySuggestion}
                    className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline px-1.5 py-0.5 rounded"
                  >
                    Apply Fix
                  </button>
                </div>
              )}
            </div>

            {/* Continue to Step 2 Button */}
            <button
              type="button"
              onClick={handleProceedToStep2}
              disabled={!isStep1Ready}
              className="w-full min-h-[44px] h-11 md:h-12 mt-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white text-sm font-semibold shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Continue to Password Setup</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        ) : (
          /* ═══════════════ STEP 2: PASSWORD & SECURITY ═══════════════ */
          <div className="space-y-3.5 animate-fadeIn">
            {/* Verified Email Summary Pill with Edit Action */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                    Signing up as
                  </span>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {formData.fullName} ({formData.email})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 flex-shrink-0 ml-2"
              >
                <span>Edit</span>
                <span className="material-symbols-outlined text-[14px]">edit</span>
              </button>
            </div>

            {/* Password Creation Field with "Generate Password" Toolbar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Account Password <span className="text-red-500">*</span>
                </span>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {isPasswordGenerated ? 'check' : 'auto_fix_high'}
                  </span>
                  <span>{isPasswordGenerated ? 'Generated & Copied!' : 'Suggest Strong Password'}</span>
                </button>
              </div>

              <FormInput
                ref={passwordInputRef}
                id="signup-password"
                label=""
                isPassword
                placeholder="At least 8 characters (Upper, number, symbol)"
                leftIcon="lock"
                autoComplete="new-password"
                value={formData.password}
                touched={touched.password}
                error={errors.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                required
              />

              {/* Password Strength Meter */}
              <PasswordStrengthMeter
                strength={passwordStrength}
                password={formData.password}
              />
            </div>

            {/* Confirm Password Field with Live Matching Feedback */}
            <div>
              <FormInput
                id="signup-confirm-password"
                label="Confirm password"
                isPassword
                placeholder="Re-enter password"
                leftIcon="lock_clock"
                autoComplete="new-password"
                value={formData.confirmPassword}
                touched={touched.confirmPassword}
                error={errors.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                required
              />

              {formData.confirmPassword && (
                <div className="mt-1 text-left">
                  {formData.confirmPassword === formData.password ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Passwords match
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 font-medium">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      Passwords do not match yet
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Terms & Privacy Agreement */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  id="signup-agree-terms"
                  checked={formData.agreeTerms}
                  onChange={(e) => handleChange('agreeTerms', e.target.checked)}
                  onBlur={() => handleBlur('agreeTerms')}
                  className="w-4 h-4 mt-0.5 rounded text-red-600 focus:ring-red-500/40 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer flex-shrink-0"
                  required
                />
                <span className="leading-relaxed">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => onOpenTerms('terms')}
                    className="text-red-600 dark:text-red-400 font-semibold underline hover:text-red-700"
                  >
                    Terms of Service
                  </button>{' '}
                  &amp;{' '}
                  <button
                    type="button"
                    onClick={() => onOpenTerms('privacy')}
                    className="text-red-600 dark:text-red-400 font-semibold underline hover:text-red-700"
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
              {touched.agreeTerms && errors.agreeTerms && (
                <div
                  id="signup-agree-terms-error"
                  role="alert"
                  className="flex items-center gap-1.5 mt-1 text-xs text-red-600 dark:text-red-400"
                >
                  <span className="material-symbols-outlined text-[16px] flex-shrink-0">error</span>
                  <span>{errors.agreeTerms}</span>
                </div>
              )}
            </div>

            {/* Navigation & Submit Action Row */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="min-h-[44px] h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={!isFormValid || isLoading}
                className="flex-1 min-h-[44px] h-11 md:h-12 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white text-sm font-semibold shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Operator Account</span>
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* ─── SOCIAL SIGN-UP DIVIDER & BUTTONS (Always accessible on Step 1) ─── */}
      {currentStep === 1 && (
        <>
          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            <span className="absolute bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              OR
            </span>
          </div>

          <SocialButtons
            tokenServerUrl={tokenServerUrl}
            onSuccess={(user) => {
              addToast('success', `Welcome, ${user.fullName}!`, 'Google Sign-Up');
              onSuccess(user);
            }}
            onError={(err) => {
              setBannerError(err);
              addToast('error', err, 'Google Sign-Up');
            }}
          />
        </>
      )}

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchTab}
          className="font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:outline-none focus:underline transition-colors ml-1"
        >
          Log in
        </button>
      </div>
    </div>
  );
};
