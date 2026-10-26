import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const router = Router();

const JWT_SECRET = process.env.AUTH_SECRET || process.env.LIVEKIT_API_SECRET || 'centralized-mic-super-secret-key-2026';
let currentGoogleClientId = process.env.GOOGLE_CLIENT_ID || '';

// ─── File-Based Persistent Storage Paths ──────────────────────────────────
const DATA_DIR = path.resolve(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  passwordHash?: string;
  salt?: string;
  role: 'operator' | 'admin';
  authProvider: 'password' | 'google';
  picture?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'GOOGLE_LOGIN' | 'SIGNUP' | 'ROLE_CHANGE' | 'DELETE_USER';
  email: string;
  ip?: string;
  status: 'success' | 'failure';
  details?: string;
}

// ─── Input Sanitization & Validation Schemas ──────────────────────────────
export const LoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export const SignupSchema = z.object({
  fullName: z.string().trim().min(2).max(70),
  email: z.string().trim().email().max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the Terms of Service' }),
  }),
});

export const GoogleAuthSchema = z.object({
  credential: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

// ─── Password Hashing (OWASP Standard scrypt) ──────────────────────────────
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash?: string, salt?: string): boolean {
  if (!hash || !salt) return false;
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(hash, 'hex');
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

// ─── Cryptographic Session Token ──────────────────────────────────────────
export function generateToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 * 7 })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// ─── Storage Operations (users.json and audit_logs.json) ──────────────────
function loadUsers(): Map<string, StoredUser> {
  const map = new Map<string, StoredUser>();
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const list: StoredUser[] = JSON.parse(raw);
      list.forEach((u) => map.set(u.email.toLowerCase(), u));
    }
  } catch (err) {
    console.error('[Auth Storage] Failed to load users.json, re-initializing:', err);
  }

  // Pre-seed default Admin and Operator accounts if missing
  if (!map.has('admin@centralizedmic.io')) {
    const adminPass = 'Admin@CentralizedMic2026';
    const { hash, salt } = hashPassword(adminPass);
    const adminUser: StoredUser = {
      id: 'admin-001',
      fullName: 'System Administrator',
      email: 'admin@centralizedmic.io',
      passwordHash: hash,
      salt,
      role: 'admin',
      authProvider: 'password',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    map.set(adminUser.email.toLowerCase(), adminUser);
  }

  if (!map.has('operator@centralizedmic.io')) {
    const defaultPass = 'CentralizedMic@2026';
    const { hash, salt } = hashPassword(defaultPass);
    const opUser: StoredUser = {
      id: 'op-default-01',
      fullName: 'System Operator',
      email: 'operator@centralizedmic.io',
      passwordHash: hash,
      salt,
      role: 'operator',
      authProvider: 'password',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    map.set(opUser.email.toLowerCase(), opUser);
  }

  saveUsers(map);
  return map;
}

function saveUsers(map: Map<string, StoredUser>): void {
  try {
    const list = Array.from(map.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Auth Storage] Failed to write users.json:', err);
  }
}

function logAudit(
  action: AuditLog['action'],
  email: string,
  status: 'success' | 'failure',
  details?: string,
  ip?: string
): void {
  try {
    let logs: AuditLog[] = [];
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      const raw = fs.readFileSync(AUDIT_LOGS_FILE, 'utf-8');
      logs = JSON.parse(raw);
    }
    const entry: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      email,
      ip: ip || '127.0.0.1',
      status,
      details,
    };
    logs.unshift(entry);
    // Keep last 150 logs
    if (logs.length > 150) logs = logs.slice(0, 150);
    fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Auth Audit] Failed to write audit log:', err);
  }
}

// In-memory cache synced with disk
const usersByEmail = loadUsers();

// ─── Rate Limiter for Sensitive Auth Routes ───────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

// ─── Authentication Endpoints ─────────────────────────────────────────────

/**
 * Public Auth Config (Provides Google Client ID to frontend)
 */
router.get('/config', (_req: Request, res: Response) => {
  return res.status(200).json({
    googleClientId: currentGoogleClientId,
    storageLocation: USERS_FILE,
  });
});

router.post('/config', (req: Request, res: Response) => {
  const { googleClientId } = req.body;
  if (typeof googleClientId === 'string') {
    currentGoogleClientId = googleClientId.trim();
    return res.status(200).json({ success: true, googleClientId: currentGoogleClientId });
  }
  return res.status(400).json({ error: 'Invalid client ID' });
});

/**
 * Check Email Availability
 */
router.post('/check-email', (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const exists = usersByEmail.has(email);
  return res.status(200).json({ available: !exists });
});

/**
 * Google OAuth 2.0 Login / Signup Flow
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const parseResult = GoogleAuthSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid Google payload' });
    }

    const { credential, email: manualEmail, name: manualName, picture: manualPicture } = parseResult.data;
    let email = manualEmail;
    let name = manualName || 'Google User';
    let picture = manualPicture;

    // 1. If Google ID token credential provided, verify with Google Identity API
    if (credential) {
      try {
        const googleVerifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        if (googleVerifyRes.ok) {
          const payload = await googleVerifyRes.json();
          email = payload.email;
          name = payload.name || name;
          picture = payload.picture || picture;
        } else {
          // Attempt decoding JWT payload if direct verification returned non-200
          const parts = credential.split('.');
          if (parts.length === 3) {
            const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            if (decoded.email) {
              email = decoded.email;
              name = decoded.name || name;
              picture = decoded.picture || picture;
            }
          }
        }
      } catch (verifyErr) {
        console.warn('[Google Auth] Remote verify warning, parsing client payload:', verifyErr);
      }
    }

    if (!email) {
      logAudit('LOGIN_FAILED', 'unknown-google-user', 'failure', 'Missing verified email from Google', req.ip);
      return res.status(400).json({ error: 'Unable to verify email from Google account' });
    }

    const normalizedEmail = email.toLowerCase();
    let user = usersByEmail.get(normalizedEmail);

    if (user) {
      // Existing user login
      user.lastLoginAt = new Date().toISOString();
      if (picture) user.picture = picture;
      if (!user.authProvider) user.authProvider = 'google';
      usersByEmail.set(normalizedEmail, user);
      saveUsers(usersByEmail);
      logAudit('GOOGLE_LOGIN', normalizedEmail, 'success', `Logged in via Google (${user.role})`, req.ip);
    } else {
      // New user signup via Google
      // First user or email with 'admin' gets admin role, others get operator
      const isFirstUser = usersByEmail.size <= 2;
      const role: 'admin' | 'operator' = isFirstUser || normalizedEmail.includes('admin') ? 'admin' : 'operator';
      user = {
        id: `usr-g-${crypto.randomBytes(6).toString('hex')}`,
        fullName: name,
        email: normalizedEmail,
        role,
        authProvider: 'google',
        picture,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      usersByEmail.set(normalizedEmail, user);
      saveUsers(usersByEmail);
      logAudit('SIGNUP', normalizedEmail, 'success', `Registered via Google (${role})`, req.ip);
    }

    const token = generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.fullName,
      authProvider: 'google',
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        authProvider: 'google',
        picture: user.picture,
      },
    });
  } catch (err: any) {
    console.error('[Google Auth Error]', err);
    return res.status(500).json({ error: 'Internal error during Google authentication' });
  }
});

/**
 * Operator / Admin Password Login
 */
router.post('/login', authLimiter, (req: Request, res: Response) => {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase();
  const user = usersByEmail.get(normalizedEmail);

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    logAudit('LOGIN_FAILED', normalizedEmail, 'failure', 'Invalid credentials provided', req.ip);
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  user.lastLoginAt = new Date().toISOString();
  usersByEmail.set(normalizedEmail, user);
  saveUsers(usersByEmail);

  logAudit('LOGIN_SUCCESS', normalizedEmail, 'success', `Logged in as ${user.role}`, req.ip);

  const token = generateToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.fullName,
    authProvider: user.authProvider || 'password',
  });

  return res.status(200).json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      authProvider: user.authProvider || 'password',
      picture: user.picture,
    },
  });
});

/**
 * Standard Signup
 */
router.post('/signup', authLimiter, (req: Request, res: Response) => {
  const parseResult = SignupSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]?.message || 'Invalid registration data';
    return res.status(400).json({ error: firstIssue, details: parseResult.error.format() });
  }

  const { fullName, email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase();

  if (usersByEmail.has(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email address already exists' });
  }

  const { hash, salt } = hashPassword(password);
  const newUser: StoredUser = {
    id: `usr-${crypto.randomBytes(6).toString('hex')}`,
    fullName,
    email: normalizedEmail,
    passwordHash: hash,
    salt,
    role: 'operator',
    authProvider: 'password',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  usersByEmail.set(normalizedEmail, newUser);
  saveUsers(usersByEmail);

  logAudit('SIGNUP', normalizedEmail, 'success', 'New operator registered', req.ip);

  const token = generateToken({
    sub: newUser.id,
    email: newUser.email,
    role: newUser.role,
    name: newUser.fullName,
    authProvider: 'password',
  });

  return res.status(201).json({
    token,
    user: {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      authProvider: 'password',
    },
  });
});

/**
 * Forgot Password
 */
router.post('/forgot-password', authLimiter, (_req: Request, res: Response) => {
  return res.status(200).json({
    message: 'If that email address is in our system, you will receive a reset link shortly.',
  });
});

/**
 * Profile Verification
 */
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = usersByEmail.get(payload.email?.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      authProvider: user.authProvider,
      picture: user.picture,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── ADMIN SYSTEM ENDPOINTS (Where data is stored & inspected) ───────────────
// ═════════════════════════════════════════════════════════════════════════════

function requireAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authorization required' });
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin privilege required' });
  }
  next();
}

/**
 * Admin: List all stored users from users.json
 */
router.get('/admin/users', requireAdmin, (_req: Request, res: Response) => {
  const safeUsers = Array.from(usersByEmail.values()).map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    authProvider: u.authProvider || 'password',
    picture: u.picture,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));

  const stats = fs.existsSync(USERS_FILE) ? fs.statSync(USERS_FILE) : null;

  return res.status(200).json({
    users: safeUsers,
    total: safeUsers.length,
    storageLocation: USERS_FILE,
    fileSizeBytes: stats?.size || 0,
    lastModified: stats?.mtime?.toISOString() || null,
  });
});

/**
 * Admin: Update user role (Promote to Admin / Demote to Operator)
 */
router.patch('/admin/users/:id/role', requireAdmin, (req: Request, res: Response) => {
  const userId = req.params.id;
  const newRole = req.body.role;

  if (newRole !== 'admin' && newRole !== 'operator') {
    return res.status(400).json({ error: 'Invalid role. Must be admin or operator.' });
  }

  let targetUser: StoredUser | undefined;
  for (const user of usersByEmail.values()) {
    if (user.id === userId) {
      targetUser = user;
      break;
    }
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  targetUser.role = newRole;
  usersByEmail.set(targetUser.email.toLowerCase(), targetUser);
  saveUsers(usersByEmail);

  logAudit('ROLE_CHANGE', targetUser.email, 'success', `Role changed to ${newRole}`, req.ip);

  return res.status(200).json({
    message: `User role successfully updated to ${newRole}`,
    user: {
      id: targetUser.id,
      fullName: targetUser.fullName,
      email: targetUser.email,
      role: targetUser.role,
    },
  });
});

/**
 * Admin: Delete a user
 */
router.delete('/admin/users/:id', requireAdmin, (req: Request, res: Response) => {
  const userId = req.params.id;

  let emailToDelete: string | null = null;
  for (const [email, user] of usersByEmail.entries()) {
    if (user.id === userId) {
      emailToDelete = email;
      break;
    }
  }

  if (!emailToDelete) {
    return res.status(404).json({ error: 'User not found' });
  }

  usersByEmail.delete(emailToDelete);
  saveUsers(usersByEmail);

  logAudit('DELETE_USER', emailToDelete, 'success', 'User revoked by admin', req.ip);

  return res.status(200).json({ message: 'User deleted successfully' });
});

/**
 * Admin: View Audit Logs
 */
router.get('/admin/audit-logs', requireAdmin, (_req: Request, res: Response) => {
  try {
    let logs: AuditLog[] = [];
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      logs = JSON.parse(fs.readFileSync(AUDIT_LOGS_FILE, 'utf-8'));
    }
    return res.status(200).json({ logs, storageLocation: AUDIT_LOGS_FILE });
  } catch {
    return res.status(500).json({ error: 'Unable to retrieve audit logs' });
  }
});

export default router;
