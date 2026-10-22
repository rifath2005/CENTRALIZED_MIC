import { z } from 'zod';

export const HostTokenRequestSchema = z.object({
  roomName: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Room name must be alphanumeric with underscores or hyphens'),
  hostIdentity: z.string().min(1).max(64).optional(),
  hostName: z.string().min(1).max(64).optional(),
});

export type HostTokenRequest = z.infer<typeof HostTokenRequestSchema>;

export const ParticipantTokenRequestSchema = z.object({
  roomName: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Room name must be alphanumeric with underscores or hyphens'),
  participantIdentity: z.string().min(1).max(64).optional(),
  participantName: z.string().min(1).max(64).optional(),
});

export type ParticipantTokenRequest = z.infer<typeof ParticipantTokenRequestSchema>;

export interface TokenResponse {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name: string;
  role: 'host' | 'transmitter';
  expiresInSeconds: number;
}

export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
}
