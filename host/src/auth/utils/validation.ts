import { PasswordStrength, PasswordRequirements, PasswordStrengthScore } from '../types';

/**
 * Basic XSS sanitization and whitespace trimming.
 */
export function sanitizeInput(value: string): string {
  if (!value) return '';
  return value
    .trim()
    .replace(/[<>]/g, ''); // Strip direct HTML opening and closing brackets
}

/**
 * Standard RFC 5322 compliant email regex check
 */
export function validateEmail(email: string): string | null {
  const sanitized = email.trim();
  if (!sanitized) {
    return 'Email address is required';
  }
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    return 'Please enter a valid email address (e.g. name@domain.com)';
  }

  if (sanitized.length > 254) {
    return 'Email address is too long';
  }

  return null;
}

/**
 * Full name validation (min 2 characters, sensible human name format)
 */
export function validateFullName(name: string): string | null {
  const sanitized = name.trim();
  if (!sanitized) {
    return 'Full name is required';
  }

  if (sanitized.length < 2) {
    return 'Full name must be at least 2 characters';
  }

  if (sanitized.length > 70) {
    return 'Full name must be less than 70 characters';
  }

  // Ensure name does not consist only of numbers or special characters
  if (!/[a-zA-Z]/.test(sanitized)) {
    return 'Please enter a valid human name';
  }

  return null;
}

/**
 * Password requirement & strength analyzer
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  const requirements: PasswordRequirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
  };

  const metCount = (requirements.minLength ? 1 : 0) +
    (requirements.hasUppercase ? 1 : 0) +
    (requirements.hasNumber ? 1 : 0) +
    (requirements.hasSpecialChar ? 1 : 0);

  const score = metCount as PasswordStrengthScore;

  if (score <= 1) {
    return {
      score,
      label: 'Weak',
      color: 'text-red-500 dark:text-red-400',
      barColor: 'bg-red-500',
      requirements,
    };
  }

  if (score === 2) {
    return {
      score,
      label: 'Fair',
      color: 'text-amber-500 dark:text-amber-400',
      barColor: 'bg-amber-500',
      requirements,
    };
  }

  if (score === 3) {
    return {
      score,
      label: 'Good',
      color: 'text-blue-500 dark:text-blue-400',
      barColor: 'bg-blue-500',
      requirements,
    };
  }

  return {
    score: 4,
    label: 'Strong',
    color: 'text-emerald-500 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
    requirements,
  };
}

/**
 * Password validation rule check for submission / blur
 */
export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }

  const { requirements } = calculatePasswordStrength(password);

  if (!requirements.minLength) {
    return 'Password must be at least 8 characters long';
  }
  if (!requirements.hasUppercase) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!requirements.hasNumber) {
    return 'Password must contain at least one number';
  }
  if (!requirements.hasSpecialChar) {
    return 'Password must contain at least one special character';
  }

  return null;
}

/**
 * Utility debounce implementation with cancel method
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}
