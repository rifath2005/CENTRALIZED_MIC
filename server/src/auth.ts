import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const router = Router();

const JWT_SECRET = process.env.AUTH_SECRET || process.env.LIVEKIT_API_SECRET || 'centralized-mic-super-secret-key-2026';

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

export const CheckEmailSchema = z.object({
  email: z.string().trim().email().max(254),
});

// ─── Password Hashing (OWASP Standard scrypt) ──────────────────────────────
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
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

// ─── In-Memory / Production User Store ─────────────────────────────────────
interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: 'operator' | 'admin';
  createdAt: string;
}

const usersByEmail = new Map<string, StoredUser>();

// Pre-seed default operator account for testing
(() => {
  const defaultPass = 'CentralizedMic@2026';
  const { hash, salt } = hashPassword(defaultPass);
  usersByEmail.set('operator@centralizedmic.io', {
    id: 'op-default-01',
    fullName: 'System Operator',
    email: 'operator@centralizedmic.io',
    passwordHash: hash,
    salt,
    role: 'operator',
    createdAt: new Date().toISOString(),
  });
})();

// ─── Rate Limiter for Sensitive Auth Routes ───────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

// ─── Endpoints ────────────────────────────────────────────────────────────

/**
 * Check Email Availability (Debounced on Frontend)
 */
router.post('/check-email', (req: Request, res: Response) => {
  const parseResult = CheckEmailSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const normalizedEmail = parseResult.data.email.toLowerCase();
  const exists = usersByEmail.has(normalizedEmail);

  return res.status(200).json({ available: !exists });
});

/**
 * Operator Login
 */
router.post('/login', authLimiter, (req: Request, res: Response) => {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    // Generic error response to prevent field enumeration
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.toLowerCase();
  const user = usersByEmail.get(normalizedEmail);

  // Constant-time check or generic failure
  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.fullName,
  });

  return res.status(200).json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  });
});

/**
 * Operator Signup
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
    createdAt: new Date().toISOString(),
  };

  usersByEmail.set(normalizedEmail, newUser);

  const token = generateToken({
    sub: newUser.id,
    email: newUser.email,
    role: newUser.role,
    name: newUser.fullName,
  });

  return res.status(201).json({
    token,
    user: {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
    },
  });
});

/**
 * Forgot Password
 */
router.post('/forgot-password', authLimiter, (_req: Request, res: Response) => {
  // Generic security response
  return res.status(200).json({
    message: 'If that email address is in our system, you will receive a reset link shortly.',
  });
});

/**
 * Profile verification endpoint
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
    },
  });
});

export default router;
