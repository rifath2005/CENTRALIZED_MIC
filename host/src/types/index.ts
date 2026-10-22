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

export interface LimiterSettings {
  threshold: number; // dB, e.g. -18
  knee: number;      // dB, e.g. 12
  ratio: number;     // e.g. 10
  attack: number;    // seconds, e.g. 0.003
  release: number;   // seconds, e.g. 0.100
}

export interface AudioOutputDeviceInfo {
  deviceId: string;
  label: string;
}
