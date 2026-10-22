import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, DataPacket_Kind } from 'livekit-client';
import {
  FloorMessage,
  FloorStatusMessage,
  FloorHoldState,
  SpeakerInfo,
  QueueEntry,
} from '../types/floor';

interface UseFloorControlProps {
  room: Room | null;
  participantId: string;
  participantName: string;
  onFloorGranted: () => void;
  onFloorRevoked: () => void;
}

export function useFloorControl({
  room,
  participantId,
  participantName,
  onFloorGranted,
  onFloorRevoked,
}: UseFloorControlProps) {
  const [currentSpeaker, setCurrentSpeaker] = useState<SpeakerInfo | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [holdState, setHoldState] = useState<FloorHoldState>('idle');

  const isHoldingButtonRef = useRef<boolean>(false);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callbacksRef = useRef({ onFloorGranted, onFloorRevoked });

  useEffect(() => {
    callbacksRef.current = { onFloorGranted, onFloorRevoked };
  }, [onFloorGranted, onFloorRevoked]);

  // Derived states
  const isSpeaking = currentSpeaker?.id === participantId;
  const queueIndex = queue.findIndex((entry) => entry.id === participantId);
  const queuePosition = queueIndex !== -1 ? queueIndex + 1 : null;

  /**
   * Broadcast data helper using LiveKit reliable channel
   */
  const sendFloorMessage = useCallback(
    async (message: FloorMessage) => {
      if (!room || room.state !== 'connected') return;
      try {
        const payload = new TextEncoder().encode(JSON.stringify(message));
        await room.localParticipant.publishData(payload, {
          reliable: true,
          topic: 'floor-control',
        });
      } catch (err) {
        console.warn('[FloorControl] Error sending floor message:', err);
      }
    },
    [room]
  );

  /**
   * Request the floor when user presses hold-to-talk button
   */
  const requestFloor = useCallback(async () => {
    isHoldingButtonRef.current = true;
    setHoldState('requesting');

    await sendFloorMessage({
      type: 'REQUEST_FLOOR',
      participantId,
      participantName,
      timestamp: Date.now(),
    });
  }, [participantId, participantName, sendFloorMessage]);

  /**
   * Release the floor when user releases the button
   */
  const releaseFloor = useCallback(async () => {
    isHoldingButtonRef.current = false;
    setHoldState('idle');

    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    await sendFloorMessage({
      type: 'RELEASE_FLOOR',
      participantId,
      timestamp: Date.now(),
    });

    callbacksRef.current.onFloorRevoked();
  }, [participantId, sendFloorMessage]);

  // Handle incoming data messages from Host arbiter
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: DataPacket_Kind,
      topic?: string
    ) => {
      if (topic && topic !== 'floor-control') return;

      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text) as FloorMessage;

        if (data.type === 'FLOOR_STATUS') {
          const status = data as FloorStatusMessage;
          setCurrentSpeaker(status.currentSpeaker);
          setQueue(status.queue);

          const amISpeaker = status.currentSpeaker?.id === participantId;
          const amInQueue = status.queue.some((e) => e.id === participantId);

          if (amISpeaker) {
            if (isHoldingButtonRef.current) {
              setHoldState('speaking');
              callbacksRef.current.onFloorGranted();
            } else {
              // Edge case: granted after user already released button
              releaseFloor();
            }
          } else if (amInQueue) {
            setHoldState('queued');
            callbacksRef.current.onFloorRevoked();
          } else {
            if (!isHoldingButtonRef.current) {
              setHoldState('idle');
            }
            callbacksRef.current.onFloorRevoked();
          }
        } else if (data.type === 'REVOKE_FLOOR' && data.participantId === participantId) {
          setHoldState('idle');
          isHoldingButtonRef.current = false;
          callbacksRef.current.onFloorRevoked();
        }
      } catch (err) {
        console.warn('[FloorControl] Failed to parse data packet:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, participantId, releaseFloor]);

  // Periodic heartbeat while holding floor (every 1.5 seconds) to prevent stuck floor
  useEffect(() => {
    if (isSpeaking) {
      heartbeatTimerRef.current = setInterval(() => {
        sendFloorMessage({
          type: 'HEARTBEAT',
          participantId,
          timestamp: Date.now(),
        });
      }, 1500);
    } else {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    }

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [isSpeaking, participantId, sendFloorMessage]);

  return {
    currentSpeaker,
    queue,
    isSpeaking,
    queuePosition,
    holdState,
    requestFloor,
    releaseFloor,
  };
}
