import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import {
  HostTokenRequestSchema,
  ParticipantTokenRequestSchema,
  TokenResponse,
  ApiErrorResponse,
} from './types';

dotenv.config();

const app = express();

// Security and middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'https:', 'wss:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
      },
    },
  })
);
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '64kb' }));

// Static files & Web Transmitter
const publicDir = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../public');

app.use(express.static(publicDir));

app.get('/mic', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'mic.html'));
});

// Rate limiter: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many token requests from this IP, please try again later.' },
});
app.use('/api/', limiter);

// Configuration & credentials
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const TOKEN_TTL_SECONDS = parseInt(process.env.TOKEN_TTL || '3600', 10); // 1 hour default

function assertLiveKitConfig() {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error(
      'LiveKit server credentials missing. Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.'
    );
  }
}

let roomServiceClient: RoomServiceClient | null = null;
function getRoomServiceClient(): RoomServiceClient {
  assertLiveKitConfig();
  if (!roomServiceClient) {
    roomServiceClient = new RoomServiceClient(LIVEKIT_URL!, LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!);
  }
  return roomServiceClient;
}

/**
 * Health check endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  const configured = Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
  res.status(200).json({
    status: 'ok',
    livekitConfigured: configured,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Room Verification Endpoint
 * Cross-checks if a room code exists and is currently active with a host receiver.
 */
app.get('/api/room/verify', async (req: Request, res: Response) => {
  try {
    assertLiveKitConfig();
    const rawRoom = String(req.query.room || '').trim().toUpperCase();
    if (!rawRoom) {
      return res.status(400).json({ exists: false, error: 'Room parameter missing' });
    }
    const client = getRoomServiceClient();
    const rooms = await client.listRooms([rawRoom]);
    const matched = rooms.find((r) => r.name.toUpperCase() === rawRoom);
    if (!matched || matched.numParticipants === 0) {
      return res.status(404).json({
        exists: false,
        error: 'ROOM_NOT_FOUND',
        message: `Room "${rawRoom}" does not exist or is not active.`,
      });
    }
    return res.status(200).json({ exists: true, participants: matched.numParticipants });
  } catch (err) {
    return res.status(500).json({ exists: false, error: 'VERIFICATION_ERROR' });
  }
});

/**
 * Host Token Generation Endpoint
 * Receiver in the meeting room: subscribes to incoming audio tracks and administers the room.
 * Does NOT publish audio to save audio loopback and bandwidth.
 */
app.post('/api/token/host', async (req: Request, res: Response<TokenResponse | ApiErrorResponse>, next: NextFunction) => {
  try {
    assertLiveKitConfig();

    const parseResult = HostTokenRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: parseResult.error.format(),
      });
    }

    const { roomName, hostIdentity, hostName } = parseResult.data;
    const identity = hostIdentity || `host-${crypto.randomBytes(4).toString('hex')}`;
    const displayName = hostName || 'Room Sound Receiver';

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: displayName,
      ttl: `${TOKEN_TTL_SECONDS}s`,
    });

    // Host permissions:
    // - Subscribes to mobile audio
    // - Publishes and receives data channel messages (floor arbitration)
    // - Room administration (can kick disconnected participants)
    // - Does NOT publish mic/video
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: true,
    });

    const token = await at.toJwt();

    return res.status(200).json({
      token,
      url: LIVEKIT_URL!,
      roomName,
      identity,
      name: displayName,
      role: 'host',
      expiresInSeconds: TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Participant Token Generation Endpoint
 * Transmitter smartphone: publishes single-track audio when floor is granted.
 * Explicitly DOES NOT subscribe to audio tracks, eliminating downlink bandwidth,
 * avoiding accidental acoustic loopback, and minimizing mobile CPU & battery usage.
 */
app.post('/api/token/participant', async (req: Request, res: Response<TokenResponse | ApiErrorResponse>, next: NextFunction) => {
  try {
    assertLiveKitConfig();

    const parseResult = ParticipantTokenRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: parseResult.error.format(),
      });
    }

    const { roomName, participantIdentity, participantName } = parseResult.data;
    const sanitizedRoom = roomName.trim().toUpperCase();

    // Verify room actually exists on LiveKit and has an active host receiver
    try {
      const client = getRoomServiceClient();
      const rooms = await client.listRooms([sanitizedRoom]);
      const matched = rooms.find((r) => r.name.toUpperCase() === sanitizedRoom);
      if (!matched || matched.numParticipants === 0) {
        return res.status(404).json({
          error: 'ROOM_NOT_FOUND',
          message: `Room "${sanitizedRoom}" does not exist or has no active host receiver.`,
        });
      }
    } catch (checkErr) {
      console.error('[Server] Room existence verification check error:', checkErr);
      return res.status(500).json({
        error: 'VERIFICATION_FAILED',
        message: 'Unable to verify room availability with audio server.',
      });
    }

    const identity = participantIdentity || `phone-${crypto.randomBytes(4).toString('hex')}`;
    const displayName = (participantName && participantName.trim()) || `Attendee ${identity.slice(-4)}`;

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: displayName,
      ttl: `${TOKEN_TTL_SECONDS}s`,
    });

    // Participant permissions:
    // - Can publish single audio track
    // - Can NOT subscribe to audio/video (cuts mobile decode pipeline and radio duty cycle)
    // - Can publish data (for floor request & release messages)
    // - roomCreate: false explicitly blocks participant from creating empty ghost rooms!
    at.addGrant({
      roomJoin: true,
      room: sanitizedRoom,
      canPublish: true,
      canSubscribe: false,
      canPublishData: true,
      roomAdmin: false,
      roomCreate: false,
    });

    const token = await at.toJwt();

    return res.status(200).json({
      token,
      url: LIVEKIT_URL!,
      roomName,
      identity,
      name: displayName,
      role: 'transmitter',
      expiresInSeconds: TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    return next(error);
  }
});

// Centralized error handler
app.use((err: Error, _req: Request, res: Response<ApiErrorResponse>, _next: NextFunction) => {
  console.error('[TokenServer Error]', err);
  return res.status(500).json({
    error: 'Internal server error processing LiveKit token',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const PORT = parseInt(process.env.PORT || '4000', 10);
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[CentralizedMic] Token service listening on http://localhost:${PORT}`);
  });
}

export default app;
