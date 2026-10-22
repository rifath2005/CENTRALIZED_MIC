export type FloorMessageType =
  | 'REQUEST_FLOOR'
  | 'RELEASE_FLOOR'
  | 'FLOOR_STATUS'
  | 'HEARTBEAT'
  | 'REVOKE_FLOOR';

export interface SpeakerInfo {
  id: string;
  name: string;
  grantedAt: number;
}

export interface QueueEntry {
  id: string;
  name: string;
  requestedAt: number;
}

export interface FloorRequestMessage {
  type: 'REQUEST_FLOOR';
  participantId: string;
  participantName: string;
  timestamp: number;
}

export interface FloorReleaseMessage {
  type: 'RELEASE_FLOOR';
  participantId: string;
  timestamp: number;
}

export interface FloorStatusMessage {
  type: 'FLOOR_STATUS';
  currentSpeaker: SpeakerInfo | null;
  queue: QueueEntry[];
  epoch: number;
}

export interface FloorHeartbeatMessage {
  type: 'HEARTBEAT';
  participantId: string;
  timestamp: number;
}

export interface FloorRevokeMessage {
  type: 'REVOKE_FLOOR';
  participantId: string;
  reason?: string;
}

export type FloorMessage =
  | FloorRequestMessage
  | FloorReleaseMessage
  | FloorStatusMessage
  | FloorHeartbeatMessage
  | FloorRevokeMessage;

export type ConnectionState = 'offline' | 'connecting' | 'connected' | 'reconnecting';

export type FloorHoldState =
  | 'idle'        // Button not pressed
  | 'requesting'  // Button pressed, waiting for host to grant floor
  | 'speaking'    // Holding floor, mic track unmuted and active
  | 'queued';     // Holding button but someone else is speaking; waiting in queue
