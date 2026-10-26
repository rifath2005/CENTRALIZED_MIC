export type AuthTab = 'login' | 'signup';

export type ThemeMode = 'light' | 'dark';

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignupFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

export interface ValidationErrors {
  [key: string]: string | undefined;
}

export interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  score: PasswordStrengthScore;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  barColor: string;
  requirements: PasswordRequirements;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: 'operator' | 'admin' | 'presenter';
  authProvider?: 'password' | 'google';
  picture?: string;
  token: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AdminUserSummary {
  id: string;
  fullName: string;
  email: string;
  role: 'operator' | 'admin';
  authProvider: 'password' | 'google';
  picture?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  email: string;
  ip?: string;
  status: 'success' | 'failure';
  details?: string;
}
