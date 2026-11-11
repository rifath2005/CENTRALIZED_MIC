import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import nodemailer, { Transporter } from 'nodemailer';

const router = Router();

let configuredSecret = process.env.AUTH_SECRET || process.env.LIVEKIT_API_SECRET;
if (!configuredSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[SECURITY] AUTH_SECRET / LIVEKIT_API_SECRET not set in production. Generating secure ephemeral 256-bit key.');
    configuredSecret = crypto.randomBytes(32).toString('hex');
  } else {
    configuredSecret = 'centralized-mic-super-secret-key-2026';
  }
}
const JWT_SECRET = configuredSecret;
let currentGoogleClientId = process.env.GOOGLE_CLIENT_ID || '523129607801-ot70ums883plmfi2ie3b7bhhag4lb6ti.apps.googleusercontent.com';

// ─── File-Based Persistent Storage Paths ──────────────────────────────────
const DATA_DIR = path.resolve(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset_tokens.json');

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
  status: 'pending' | 'approved' | 'rejected';
  authProvider: 'password' | 'google';
  picture?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface ResetTokenRecord {
  token: string;
  email: string;
  expiresAt: number;
  createdAt: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'GOOGLE_LOGIN'
    | 'SIGNUP'
    | 'SIGNUP_PENDING_APPROVAL'
    | 'USER_APPROVED'
    | 'USER_REJECTED'
    | 'ROLE_CHANGE'
    | 'DELETE_USER'
    | 'PASSWORD_RESET_REQUESTED'
    | 'PASSWORD_RESET_SUCCESS';
  email: string;
  ip?: string;
  status: 'success' | 'failure';
  details?: string;
}

// ─── Input Sanitization & Validation Schemas ──────────────────────────────
export const EmailSchema = z
  .string()
  .trim()
  .max(254)
  .transform((val) => val.toLowerCase().replace(/\s+/g, ''))
  .refine((val) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(val), {
    message: 'Please provide a valid lowercase email address (e.g. name@domain.com)',
  });

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const SignupSchema = z.object({
  fullName: z.string().trim().min(2).max(70),
  email: EmailSchema,
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
      list.forEach((u) => {
        if (!u.status) {
          u.status = 'approved';
        }
        map.set(u.email.toLowerCase(), u);
      });
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
      status: 'approved',
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
      status: 'approved',
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

function loadResetTokens(): Map<string, ResetTokenRecord> {
  const map = new Map<string, ResetTokenRecord>();
  try {
    if (fs.existsSync(RESET_TOKENS_FILE)) {
      const raw = fs.readFileSync(RESET_TOKENS_FILE, 'utf-8');
      const list: ResetTokenRecord[] = JSON.parse(raw);
      const now = Date.now();
      for (const item of list) {
        if (item.expiresAt > now) {
          map.set(item.token, item);
        }
      }
    }
  } catch (err) {
    console.warn('[Auth] Failed to load reset tokens:', err);
  }
  return map;
}

function saveResetTokens(map: Map<string, ResetTokenRecord>) {
  try {
    const list = Array.from(map.values()).filter((t) => t.expiresAt > Date.now());
    fs.writeFileSync(RESET_TOKENS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Auth] Failed to save reset tokens:', err);
  }
}

const resetTokens = loadResetTokens();

function getEmailTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  if (host) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
    });
  }

  return null;
}

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
    try {
      const envPath = path.resolve(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('GOOGLE_CLIENT_ID=')) {
          envContent = envContent.replace(/GOOGLE_CLIENT_ID=.*/g, `GOOGLE_CLIENT_ID=${currentGoogleClientId}`);
        } else {
          envContent = envContent.trim() + `\nGOOGLE_CLIENT_ID=${currentGoogleClientId}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      }
    } catch (e) {
      console.warn('[Config] Failed to persist GOOGLE_CLIENT_ID to .env:', e);
    }
    return res.status(200).json({ success: true, googleClientId: currentGoogleClientId });
  }
  return res.status(400).json({ error: 'Invalid client ID' });
});

/**
 * Check Email Availability
 */
router.post('/check-email', (req: Request, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid lowercase email address' });
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

    // 1. If Google ID token credential provided, verify strictly with Google Identity API
    if (credential) {
      try {
        const googleVerifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        if (!googleVerifyRes.ok) {
          logAudit('LOGIN_FAILED', 'unknown-google-token', 'failure', 'Google ID token rejected by Google OAuth2 API', req.ip);
          return res.status(401).json({ error: 'Google authentication token is invalid or expired.' });
        }
        const payload = (await googleVerifyRes.json()) as {
          email?: string;
          name?: string;
          picture?: string;
          aud?: string;
          email_verified?: string | boolean;
        };

        // Validate token audience against configured Google Client ID
        if (currentGoogleClientId && payload.aud && payload.aud !== currentGoogleClientId) {
          logAudit('LOGIN_FAILED', payload.email || 'unknown', 'failure', 'Google ID token audience mismatch', req.ip);
          return res.status(401).json({ error: 'Google ID token was issued for an unauthorized client application.' });
        }

        if (payload.email_verified === false || payload.email_verified === 'false') {
          logAudit('LOGIN_FAILED', payload.email || 'unknown', 'failure', 'Google email unverified', req.ip);
          return res.status(401).json({ error: 'Your Google email address is not verified by Google.' });
        }

        email = payload.email;
        name = payload.name || name;
        picture = payload.picture || picture;
      } catch (verifyErr) {
        console.error('[Google Auth] Network error connecting to Google tokeninfo API:', verifyErr);
        return res.status(502).json({ error: 'Unable to reach Google authentication service. Please check network connectivity.' });
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
      // Role assignment: Only designated bootstrap admins or the first user get admin role
      const BOOTSTRAP_ADMINS = (process.env.ADMIN_EMAILS || 'babsword3@gmail.com,admin@centralizedmic.com')
        .toLowerCase()
        .split(',')
        .map((e) => e.trim());
      const isDesignatedAdmin = BOOTSTRAP_ADMINS.includes(normalizedEmail);
      const isFirstUser = usersByEmail.size === 0;
      const role: 'admin' | 'operator' = isDesignatedAdmin || isFirstUser ? 'admin' : 'operator';
      const status: 'approved' | 'pending' = role === 'admin' ? 'approved' : 'pending';
      user = {
        id: `usr-g-${crypto.randomBytes(6).toString('hex')}`,
        fullName: name,
        email: normalizedEmail,
        role,
        status,
        authProvider: 'google',
        picture,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      usersByEmail.set(normalizedEmail, user);
      saveUsers(usersByEmail);
      logAudit(
        status === 'approved' ? 'SIGNUP' : 'SIGNUP_PENDING_APPROVAL',
        normalizedEmail,
        'success',
        `Registered via Google (${role}, status: ${status})`,
        req.ip
      );
    }

    const token = generateToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status || 'approved',
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
        status: user.status || 'approved',
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
    status: user.status || 'approved',
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
      status: user.status || 'approved',
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
    status: 'pending',
    authProvider: 'password',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  usersByEmail.set(normalizedEmail, newUser);
  saveUsers(usersByEmail);

  logAudit('SIGNUP_PENDING_APPROVAL', normalizedEmail, 'success', 'New operator registered (awaiting administrator approval)', req.ip);

  const token = generateToken({
    sub: newUser.id,
    email: newUser.email,
    role: newUser.role,
    status: newUser.status,
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
      status: newUser.status,
      authProvider: 'password',
    },
    message: 'Operator account created successfully. Awaiting administrator approval.',
  });
});

/**
 * Forgot Password - Generates secure 1-hour reset token & delivers email
 */
router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  const parseResult = z.object({ email: EmailSchema }).safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Please enter a valid lowercase email address.' });
  }

  const normalizedEmail = parseResult.data.email.toLowerCase();
  const user = usersByEmail.get(normalizedEmail);

  // Security (OWASP): Return generic success for unknown emails to prevent account enumeration
  if (!user) {
    logAudit('LOGIN_FAILED', normalizedEmail, 'failure', 'Password reset requested for nonexistent email', req.ip);
    return res.status(200).json({
      success: true,
      emailSent: false,
      message: 'If that email address is in our system, you will receive a reset link shortly.',
    });
  }

  // Generate 256-bit cryptographic reset token (valid for 60 minutes)
  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000;

  resetTokens.set(resetToken, {
    token: resetToken,
    email: normalizedEmail,
    expiresAt,
    createdAt: Date.now(),
  });
  saveResetTokens(resetTokens);

  // Construct absolute reset URL
  const requestOrigin = req.headers.origin || req.headers.referer;
  let baseUrl = process.env.APP_URL || process.env.HOST_URL;
  if (!baseUrl && requestOrigin) {
    try {
      const parsed = new URL(requestOrigin);
      baseUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {}
  }
  if (!baseUrl) {
    baseUrl = 'http://localhost:5173';
  }

  const resetLink = `${baseUrl.replace(/\/$/, '')}/#reset-token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

  logAudit('PASSWORD_RESET_REQUESTED', normalizedEmail, 'success', 'Password reset token generated (valid 1h)', req.ip);

  const transporter = getEmailTransporter();
  let emailSent = false;
  let emailDeliveryNotice = '';

  if (transporter) {
    try {
      const fromAddress = process.env.EMAIL_FROM || `AirMic Security <${process.env.SMTP_USER || 'no-reply@centralizedmic.com'}>`;
      await transporter.sendMail({
        from: fromAddress,
        to: normalizedEmail,
        subject: '🔒 Reset Your AirMic Account Password',
        text: `Hello ${user.fullName},\n\nWe received a request to reset your AirMic account password.\n\nPlease click the link below to set a new password:\n${resetLink}\n\nThis link is valid for 60 minutes.\nIf you did not request this, you can safely ignore this email.\n\n— The AirMic Engineering Team`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; color: #f8fafc; padding: 32px 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 12px; background: rgba(225, 29, 72, 0.2); border: 1px solid rgba(225, 29, 72, 0.4); font-size: 24px;">🔒</span>
              <h2 style="margin: 12px 0 4px; font-size: 20px; font-weight: 800; color: #ffffff;">Reset Your Password</h2>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">AirMic Centralized PA Security</p>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">Hello <strong>${user.fullName}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">We received a request to reset the password for your account (<strong>${normalizedEmail}</strong>).</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetLink}" target="_blank" style="display: inline-block; background: #e11d48; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);">Reset My Password</a>
            </div>
            <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin-top: 24px; word-break: break-all;">
              Or copy and paste this link into your browser:<br/>
              <a href="${resetLink}" style="color: #38bdf8;">${resetLink}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
            <p style="font-size: 11px; color: #64748b; margin: 0; text-align: center;">
              This link expires in 60 minutes. If you did not request a password reset, you can safely disregard this email.
            </p>
          </div>
        `,
      });
      emailSent = true;
      emailDeliveryNotice = `A password reset link has been sent to ${normalizedEmail}. Please check your inbox and spam folder.`;
      console.log(`[Auth Email] Password reset email delivered successfully to ${normalizedEmail}`);
    } catch (err: any) {
      console.error('[Auth Email Error] Failed to send email via SMTP:', err);
      emailDeliveryNotice = `SMTP delivery encountered an error. A direct reset link has been prepared.`;
    }
  } else {
    emailDeliveryNotice = `Password reset link generated. (SMTP is not configured on this server, so the direct link is provided below).`;
    console.log(`[Auth Notice] SMTP not configured. Generated password reset link for ${normalizedEmail}:\n${resetLink}`);
  }

  return res.status(200).json({
    success: true,
    emailSent,
    message: emailDeliveryNotice,
    resetLink: !emailSent ? resetLink : undefined,
  });
});

/**
 * Verify Password Reset Token
 */
router.post('/verify-reset-token', (req: Request, res: Response) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ valid: false, error: 'Token is required' });
  }

  const record = resetTokens.get(token);
  if (!record) {
    return res.status(404).json({ valid: false, error: 'Reset link is invalid or has already been used.' });
  }

  if (record.expiresAt < Date.now()) {
    resetTokens.delete(token);
    saveResetTokens(resetTokens);
    return res.status(410).json({ valid: false, error: 'Reset link has expired. Please request a new one.' });
  }

  return res.status(200).json({
    valid: true,
    email: record.email,
  });
});

/**
 * Execute Password Reset
 */
const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

router.post('/reset-password', authLimiter, (req: Request, res: Response) => {
  const parseResult = ResetPasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]?.message || 'Invalid password format';
    return res.status(400).json({ error: firstIssue });
  }

  const { token, newPassword } = parseResult.data;
  const record = resetTokens.get(token);
  if (!record) {
    return res.status(404).json({ error: 'Reset link is invalid or has already been used.' });
  }

  if (record.expiresAt < Date.now()) {
    resetTokens.delete(token);
    saveResetTokens(resetTokens);
    return res.status(410).json({ error: 'Reset link has expired. Please request a new one.' });
  }

  const user = usersByEmail.get(record.email.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User associated with this token not found.' });
  }

  // Hash new password using OWASP scrypt standard
  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.salt = salt;
  user.lastLoginAt = new Date().toISOString();
  usersByEmail.set(record.email.toLowerCase(), user);
  saveUsers(usersByEmail);

  // Invalidate reset token to prevent reuse
  resetTokens.delete(token);
  saveResetTokens(resetTokens);

  logAudit('PASSWORD_RESET_SUCCESS', record.email, 'success', 'Password reset successfully completed', req.ip);

  return res.status(200).json({
    success: true,
    message: 'Your password has been successfully updated. You may now log in with your new password.',
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
      status: user.status || 'approved',
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
    status: u.status || 'approved',
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
 * Admin: Update user approval status (Approve / Reject / Pending)
 */
router.patch('/admin/users/:id/status', requireAdmin, (req: Request, res: Response) => {
  const userId = req.params.id;
  const newStatus = req.body.status;

  if (newStatus !== 'approved' && newStatus !== 'rejected' && newStatus !== 'pending') {
    return res.status(400).json({ error: 'Invalid status. Must be approved, rejected, or pending.' });
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

  // Prevent changing status of root administrator
  if (targetUser.role === 'admin' && newStatus !== 'approved') {
    return res.status(400).json({ error: 'Administrators are always approved.' });
  }

  targetUser.status = newStatus;
  usersByEmail.set(targetUser.email.toLowerCase(), targetUser);
  saveUsers(usersByEmail);

  const auditAction: AuditLog['action'] =
    newStatus === 'approved' ? 'USER_APPROVED' : newStatus === 'rejected' ? 'USER_REJECTED' : 'ROLE_CHANGE';

  logAudit(auditAction, targetUser.email, 'success', `User status changed to ${newStatus}`, req.ip);

  return res.status(200).json({
    message: `User status successfully updated to ${newStatus}`,
    user: {
      id: targetUser.id,
      fullName: targetUser.fullName,
      email: targetUser.email,
      role: targetUser.role,
      status: targetUser.status,
    },
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
  // If promoted to admin, ensure they are also approved
  if (newRole === 'admin') {
    targetUser.status = 'approved';
  }
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
      status: targetUser.status,
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
