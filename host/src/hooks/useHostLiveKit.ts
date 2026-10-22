import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  TrackPublication,
  Participant,
  Track,
} from 'livekit-client';
import { AudioProcessingGraph } from '../audio/AudioProcessingGraph';

interface UseHostLiveKitProps {
  tokenServerUrl: string;
  roomName: string;
  audioGraph: AudioProcessingGraph;
}

export function useHostLiveKit({
  tokenServerUrl,
  roomName,
  audioGraph,
}: UseHostLiveKitProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [activeSpeakerIdentity, setActiveSpeakerIdentity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);

  /**
   * Fetches the host token from the token server
   */
  const fetchHostToken = useCallback(async (rName: string): Promise<{ token: string; url: string }> => {
    const res = await fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/token/host`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: rName,
        hostName: 'Meeting Room PA Receiver',
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Host token request failed with status ${res.status}`);
    }

    const json = await res.json();
    return { token: json.token, url: json.url };
  }, [tokenServerUrl]);

  /**
   * Connects to LiveKit room as subscriber host
   */
  const connectHost = useCallback(async () => {
    try {
      setError(null);
      setIsConnecting(true);

      const { token, url } = await fetchHostToken(roomName);

      const livekitRoom = new Room({
        adaptiveStream: false,
        dynacast: false,
      });

      roomRef.current = livekitRoom;

      // Handle subscribed tracks
      livekitRoom.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            console.log(`[HostLiveKit] Subscribed to audio track from ${participant.identity}`);
            setActiveSpeakerIdentity(participant.identity);

            // Connect track to Web Audio processing graph (Limiter + Highpass + Master Gain)
            if (track.mediaStreamTrack) {
              audioGraph.attachTrack(track.mediaStreamTrack);
            }
          }
        }
      );

      // Handle unsubscribed tracks
      livekitRoom.on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            console.log(`[HostLiveKit] Unsubscribed audio track from ${participant.identity}`);
            audioGraph.detachTrack();
            setActiveSpeakerIdentity((prev: string | null) => (prev === participant.identity ? null : prev));
          }
        }
      );

      // Handle track mute/unmute
      livekitRoom.on(
        RoomEvent.TrackMuted,
        (publication: TrackPublication, participant: Participant) => {
          if (publication.kind === Track.Kind.Audio) {
            console.log(`[HostLiveKit] Remote track MUTED by ${participant.identity}`);
            // If the current audio stream is muted by speaker releasing button, detach
            audioGraph.detachTrack();
          }
        }
      );

      livekitRoom.on(
        RoomEvent.TrackUnmuted,
        (publication: TrackPublication, participant: Participant) => {
          if (publication.kind === Track.Kind.Audio && publication.track?.mediaStreamTrack) {
            console.log(`[HostLiveKit] Remote track UNMUTED by ${participant.identity}`);
            audioGraph.attachTrack(publication.track.mediaStreamTrack);
            setActiveSpeakerIdentity(participant.identity);
          }
        }
      );

      livekitRoom.on(RoomEvent.Connected, () => {
        setIsConnected(true);
        setIsConnecting(false);
        console.log(`[HostLiveKit] Host connected to room: ${roomName}`);
      });

      livekitRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        setActiveSpeakerIdentity(null);
        audioGraph.detachTrack();
        console.log('[HostLiveKit] Host disconnected from room');
      });

      await livekitRoom.connect(url, token);
      setRoom(livekitRoom);
    } catch (err: unknown) {
      console.error('[HostLiveKit] Error connecting host:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect host');
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [roomName, fetchHostToken, audioGraph]);

  /**
   * Disconnects host
   */
  const disconnectHost = useCallback(async () => {
    if (roomRef.current) {
      audioGraph.detachTrack();
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setRoom(null);
    setIsConnected(false);
    setIsConnecting(false);
    setActiveSpeakerIdentity(null);
  }, [audioGraph]);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return {
    room,
    isConnected,
    isConnecting,
    activeSpeakerIdentity,
    error,
    connectHost,
    disconnectHost,
  };
}
