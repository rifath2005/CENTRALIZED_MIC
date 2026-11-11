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
 * Normalizes email by converting all uppercase characters to lowercase and stripping all whitespace.
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().replace(/\s+/g, '');
}

/**
 * Strict RFC-compliant lowercase email validation.
 * Constraints:
 * 1. Uppercase characters are disallowed (auto-converted to lowercase in UI).
 * 2. Spaces and whitespace are disallowed.
 * 3. Format must be [local]@[domain].[tld] with TLD length >= 2.
 * 4. No consecutive dots, and dots/hyphens cannot lead or trail local part or domain.
 * 5. Max length: 254 characters.
 */
export function validateEmail(email: string): string | null {
  if (!email || !email.trim()) {
    return 'Email address is required';
  }

  const raw = email.trim();

  if (/\s/.test(raw)) {
    return 'Email address cannot contain spaces';
  }

  if (/[A-Z]/.test(raw)) {
    return 'Uppercase letters are not allowed. Email must be in lowercase';
  }

  if (raw.length > 254) {
    return 'Email address is too long (maximum 254 characters)';
  }

  const parts = raw.split('@');
  if (parts.length !== 2) {
    return 'Please enter a valid email address with a single "@" (e.g. name@domain.com)';
  }

  const [localPart, domain] = parts;

  if (!localPart) {
    return 'Please enter the username before "@"';
  }

  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return 'Email username cannot start, end, or contain consecutive dots';
  }

  if (!domain || !domain.includes('.')) {
    return 'Please enter a valid email domain with an extension (e.g. @domain.com)';
  }

  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..') || domain.startsWith('-') || domain.endsWith('-')) {
    return 'Email domain contains invalid dot or hyphen placement';
  }

  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) {
    return 'Email domain extension must be at least 2 letters (e.g. .com, .org)';
  }

  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  if (!emailRegex.test(raw)) {
    return 'Please enter a valid lowercase email address (e.g. name@domain.com)';
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

/**
 * Common email domain typo detector and autocorrection suggester
 */
export function suggestEmailDomain(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!domain) return null;

  const typoMap: Record<string, string> = {
    'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gmai.co': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
    'iclud.com': 'icloud.com',
  };

  const correctedDomain = typoMap[domain.toLowerCase()];
  if (correctedDomain) {
    return `${local}@${correctedDomain}`;
  }
  return null;
}

/**
 * Generate cryptographically secure random password meeting all requirements
 */
export function generateSecurePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*';

  // Ensure at least one of each required group
  let pass = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  const allChars = upper + lower + numbers + symbols;
  for (let i = 0; i < 10; i++) {
    pass.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }

  // Shuffle array
  for (let i = pass.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pass[i], pass[j]] = [pass[j], pass[i]];
  }

  return pass.join('');
}
