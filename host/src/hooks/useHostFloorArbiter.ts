import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, DataPacket_Kind, RemoteParticipant } from 'livekit-client';
import {
  FloorMessage,
  FloorStatusMessage,
  SpeakerInfo,
  QueueEntry,
} from '../types';

interface UseHostFloorArbiterProps {
  room: Room | null;
}

export function useHostFloorArbiter({ room }: UseHostFloorArbiterProps) {
  const [currentSpeaker, setCurrentSpeaker] = useState<SpeakerInfo | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [epoch, setEpoch] = useState<number>(1);

  const currentSpeakerRef = useRef<SpeakerInfo | null>(null);
  const queueRef = useRef<QueueEntry[]>([]);
  const epochRef = useRef<number>(1);
  const lastHeartbeatTimeRef = useRef<number>(Date.now());

  // Keep refs in sync with state
  useEffect(() => {
    currentSpeakerRef.current = currentSpeaker;
  }, [currentSpeaker]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    epochRef.current = epoch;
  }, [epoch]);

  /**
   * Broadcast authoritative floor status to all participants in the room
   */
  const broadcastFloorStatus = useCallback(
    async (targetSpeaker: SpeakerInfo | null, targetQueue: QueueEntry[]) => {
      if (!room || room.state !== 'connected') return;

      const newEpoch = epochRef.current + 1;
      epochRef.current = newEpoch;
      setEpoch(newEpoch);

      const statusMessage: FloorStatusMessage = {
        type: 'FLOOR_STATUS',
        currentSpeaker: targetSpeaker,
        queue: targetQueue,
        epoch: newEpoch,
      };

      try {
        const payload = new TextEncoder().encode(JSON.stringify(statusMessage));
        await room.localParticipant.publishData(payload, {
          reliable: true,
          topic: 'floor-control',
        });
        console.log('[FloorArbiter] Broadcasted status:', statusMessage);
      } catch (err) {
        console.warn('[FloorArbiter] Error broadcasting floor status:', err);
      }
    },
    [room]
  );

  /**
   * Assigns the next participant from the queue as the active speaker
   */
  const advanceFloor = useCallback(
    (reason: string) => {
      console.log(`[FloorArbiter] Advancing floor. Reason: ${reason}`);
      const remainingQueue = [...queueRef.current];
      const nextInLine = remainingQueue.shift() || null;

      let nextSpeaker: SpeakerInfo | null = null;
      if (nextInLine) {
        nextSpeaker = {
          id: nextInLine.id,
          name: nextInLine.name,
          grantedAt: Date.now(),
        };
        lastHeartbeatTimeRef.current = Date.now();
      }

      currentSpeakerRef.current = nextSpeaker;
      queueRef.current = remainingQueue;
      setCurrentSpeaker(nextSpeaker);
      setQueue(remainingQueue);

      broadcastFloorStatus(nextSpeaker, remainingQueue);
    },
    [broadcastFloorStatus]
  );

  /**
   * Host manual override: Revoke current speaker immediately
   */
  const forceRevokeCurrentSpeaker = useCallback(async () => {
    if (!currentSpeakerRef.current) return;

    const speakerIdToRevoke = currentSpeakerRef.current.id;

    if (room && room.state === 'connected') {
      try {
        const revokeMsg = JSON.stringify({
          type: 'REVOKE_FLOOR',
          participantId: speakerIdToRevoke,
          reason: 'Host operator revoked floor',
        });
        await room.localParticipant.publishData(new TextEncoder().encode(revokeMsg), {
          reliable: true,
          topic: 'floor-control',
        });
      } catch (err) {
        console.warn('[FloorArbiter] Failed to publish revoke message:', err);
      }
    }

    advanceFloor('Operator manual override');
  }, [room, advanceFloor]);

  /**
   * Host manual override: Clear entire queue
   */
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setQueue([]);
    broadcastFloorStatus(currentSpeakerRef.current, []);
  }, [broadcastFloorStatus]);

  // Main floor control message listener
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

        if (data.type === 'REQUEST_FLOOR') {
          const { participantId, participantName } = data;
          console.log(`[FloorArbiter] Floor requested by ${participantName} (${participantId})`);

          // Case A: Floor is vacant -> grant immediately
          if (!currentSpeakerRef.current) {
            const newSpeaker: SpeakerInfo = {
              id: participantId,
              name: participantName,
              grantedAt: Date.now(),
            };
            currentSpeakerRef.current = newSpeaker;
            lastHeartbeatTimeRef.current = Date.now();
            setCurrentSpeaker(newSpeaker);
            broadcastFloorStatus(newSpeaker, queueRef.current);
          }
          // Case B: Floor is held -> enqueue requester if not already speaking or queued
          else {
            if (currentSpeakerRef.current.id === participantId) {
              // Already speaker, refresh heartbeat
              lastHeartbeatTimeRef.current = Date.now();
              return;
            }

            const isAlreadyQueued = queueRef.current.some((e) => e.id === participantId);
            if (!isAlreadyQueued) {
              const updatedQueue = [
                ...queueRef.current,
                { id: participantId, name: participantName, requestedAt: Date.now() },
              ];
              queueRef.current = updatedQueue;
              setQueue(updatedQueue);
              broadcastFloorStatus(currentSpeakerRef.current, updatedQueue);
            }
          }
        } else if (data.type === 'RELEASE_FLOOR') {
          const { participantId } = data;
          console.log(`[FloorArbiter] Floor release received from ${participantId}`);

          if (currentSpeakerRef.current?.id === participantId) {
            advanceFloor('Speaker voluntary release');
          } else {
            // Remove from queue if waiting
            const filteredQueue = queueRef.current.filter((e) => e.id !== participantId);
            if (filteredQueue.length !== queueRef.current.length) {
              queueRef.current = filteredQueue;
              setQueue(filteredQueue);
              broadcastFloorStatus(currentSpeakerRef.current, filteredQueue);
            }
          }
        } else if (data.type === 'HEARTBEAT') {
          if (currentSpeakerRef.current?.id === data.participantId) {
            lastHeartbeatTimeRef.current = Date.now();
          }
        }
      } catch (err) {
        console.warn('[FloorArbiter] Error processing incoming floor data:', err);
      }
    };

    // Edge-case recovery: Handle participant unexpected disconnect
    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      console.warn(`[FloorArbiter] Participant disconnected: ${participant.identity}`);

      // If active speaker dropped abruptly without sending RELEASE_FLOOR:
      if (currentSpeakerRef.current?.id === participant.identity) {
        advanceFloor(`Speaker disconnected unexpectedly (${participant.identity})`);
      } else {
        // Prune from queue if they were queued
        const filteredQueue = queueRef.current.filter((e) => e.id !== participant.identity);
        if (filteredQueue.length !== queueRef.current.length) {
          queueRef.current = filteredQueue;
          setQueue(filteredQueue);
          broadcastFloorStatus(currentSpeakerRef.current, filteredQueue);
        }
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room, advanceFloor, broadcastFloorStatus]);

  // Stuck Floor Watchdog: If speaker sends no heartbeat or packets for > 4.5 seconds, auto-release floor
  useEffect(() => {
    const watchdogInterval = setInterval(() => {
      if (currentSpeakerRef.current) {
        const elapsedSinceHeartbeat = Date.now() - lastHeartbeatTimeRef.current;
        if (elapsedSinceHeartbeat > 4500) {
          console.warn(
            `[FloorArbiter] Stuck floor detected for ${currentSpeakerRef.current.name} (silence: ${elapsedSinceHeartbeat}ms). Auto-recovering.`
          );
          advanceFloor('Heartbeat timeout (stuck floor recovery)');
        }
      }
    }, 1000);

    return () => clearInterval(watchdogInterval);
  }, [advanceFloor]);

  return {
    currentSpeaker,
    queue,
    forceRevokeCurrentSpeaker,
    clearQueue,
  };
}
