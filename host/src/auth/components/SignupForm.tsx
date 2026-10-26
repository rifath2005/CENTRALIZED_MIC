import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FormInput } from './FormInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { SocialButtons } from './SocialButtons';
import { SignupFormData, ValidationErrors, AuthUser } from '../types';
import {
  validateEmail,
  validateFullName,
  validatePassword,
  calculatePasswordStrength,
  sanitizeInput,
  debounce,
} from '../utils/validation';

interface SignupFormProps {
  onSuccess: (user: AuthUser) => void;
  onSwitchTab: () => void;
  onOpenTerms: (tab: 'terms' | 'privacy') => void;
  onOpenGoogleModal?: () => void;
  tokenServerUrl?: string;
  addToast: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({
  onSuccess,
  onSwitchTab,
  onOpenTerms,
  onOpenGoogleModal,
  tokenServerUrl = 'http://localhost:4000',
  addToast,
}) => {
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
  const [isLoading, setIsLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  // Live password strength
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
              setErrors((prev) => ({ ...prev, email: 'This email is already in use' }));
            } else {
              setEmailStatus('available');
              setErrors((prev) => ({ ...prev, email: undefined }));
            }
          }
        } catch {
          // If server check fails or offline, ignore and rely on standard validation
          setEmailStatus(null);
        } finally {
          setIsCheckingEmail(false);
        }
      }, 500),
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
        return validateEmail(String(val)) || (emailStatus === 'taken' ? 'This email is already in use' : undefined);
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
    setFormData((prev) => ({ ...prev, [field]: value }));
    setBannerError(null);

    // If typing email, trigger debounced availability check
    if (field === 'email' && typeof value === 'string') {
      setEmailStatus(null);
      if (value.includes('@') && value.includes('.')) {
        checkEmailAvailability(value);
      }
    }

    // Revalidate if touched
    if (touched[field]) {
      const fieldError = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: fieldError }));
    }

    // If changing password, also revalidate confirmPassword if touched
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

  // Form validity for submit button state
  const isFormValid =
    formData.fullName.trim().length >= 2 &&
    !validateEmail(formData.email) &&
    passwordStrength.score >= 3 && // Requires Good or Strong
    formData.confirmPassword === formData.password &&
    formData.agreeTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerError(null);

    // Mark all as touched
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

      addToast('success', 'Your account has been created successfully!', 'Welcome to Centralized Mic');
      onSuccess(data.user);
    } catch {
      const errMsg = `Cannot reach registration service at ${tokenServerUrl}. Please verify server is running on port 4000.`;
      setBannerError(errMsg);
      addToast('error', errMsg, 'Connection Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const cfgRes = await fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/auth/config`);
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        const googleObj = (window as any).google;
        if (cfgData.googleClientId && googleObj?.accounts?.oauth2) {
          setIsLoading(true);
          const client = googleObj.accounts.oauth2.initTokenClient({
            client_id: cfgData.googleClientId,
            scope: 'email profile openid',
            callback: async (tokenResponse: any) => {
              setIsLoading(false);
              if (tokenResponse?.access_token) {
                try {
                  const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                  }).then((r) => r.json());

                  const apiRes = await fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/auth/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: userInfo.email,
                      name: userInfo.name,
                      picture: userInfo.picture,
                    }),
                  });
                  const resData = await apiRes.json();
                  if (apiRes.ok && resData.user) {
                    addToast('success', `Welcome, ${resData.user.fullName}!`, 'Google Signup Complete');
                    onSuccess(resData.user);
                    return;
                  }
                } catch (e: any) {
                  setBannerError(e.message || 'Google signup failed');
                }
              }
            },
          });
          client.requestAccessToken();
          return;
        }
      }
    } catch (_) {}

    if (onOpenGoogleModal) {
      onOpenGoogleModal();
    }
  };

  return (
    <div className="w-full flex flex-col text-left">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Create your account
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Set up your operator profile for Centralized Mic PA system
        </p>
      </div>

      {/* Screen Reader Error Summary Focus Anchor & Inline Banner */}
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

      {/* Signup Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
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

        {/* Password */}
        <div>
          <FormInput
            id="signup-password"
            label="Password"
            isPassword
            placeholder="At least 8 characters"
            leftIcon="lock"
            autoComplete="new-password"
            value={formData.password}
            touched={touched.password}
            error={errors.password}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            required
          />

          {/* Live Strength Meter and Checklist */}
          <PasswordStrengthMeter
            strength={passwordStrength}
            password={formData.password}
          />
        </div>

        {/* Confirm Password */}
        <FormInput
          id="signup-confirm-password"
          label="Confirm password"
          isPassword
          placeholder="Re-enter password"
          leftIcon="lock"
          autoComplete="new-password"
          value={formData.confirmPassword}
          touched={touched.confirmPassword}
          error={errors.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          onBlur={() => handleBlur('confirmPassword')}
          required
        />

        {/* Terms Checkbox */}
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid || isLoading}
          className="w-full min-h-[44px] h-11 md:h-12 mt-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white text-sm font-semibold shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-5 flex items-center justify-center">
        <div className="w-full border-t border-slate-200 dark:border-slate-800" />
        <span className="absolute bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          OR
        </span>
      </div>

      {/* Social Google Signup */}
      <SocialButtons
        isLoading={isLoading}
        onGoogleClick={handleGoogleSignup}
        buttonText="Sign up with Google"
      />

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
