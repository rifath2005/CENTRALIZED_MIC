import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  RemoteAudioTrack,
  TrackPublication,
  Participant,
  Track,
} from 'livekit-client';
import { AudioProcessingGraph } from '../audio/AudioProcessingGraph';
import { BoardroomMember } from '../types';

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
  const [members, setMembers] = useState<BoardroomMember[]>([]);
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
            audioGraph.attachRemoteTrack(track as RemoteAudioTrack);
          }
        }
      );

      // Handle unsubscribed tracks
      livekitRoom.on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            console.log(`[HostLiveKit] Unsubscribed audio track from ${participant.identity}`);
            audioGraph.detachRemoteTrack(track as RemoteAudioTrack);
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
            setActiveSpeakerIdentity((prev) => (prev === participant.identity ? null : prev));
          }
        }
      );

      livekitRoom.on(
        RoomEvent.TrackUnmuted,
        (publication: TrackPublication, participant: Participant) => {
          if (publication.kind === Track.Kind.Audio && publication.track) {
            console.log(`[HostLiveKit] Remote track UNMUTED by ${participant.identity}`);
            audioGraph.attachRemoteTrack(publication.track as RemoteAudioTrack);
            setActiveSpeakerIdentity(participant.identity);
          }
        }
      );

      const resolveParticipantName = (p: RemoteParticipant | Participant): string => {
        const raw = p.name?.trim();
        if (raw) return raw;
        const id = p.identity || '';
        const short = id.replace(/^(phone|host|mic|guest)-/i, '').slice(-4);
        return `Attendee ${short ? `(${short})` : ''}`.trim();
      };

      // Real-time Boardroom Member Tracking
      livekitRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log(`[HostLiveKit] Boardroom member connected: ${participant.identity} (${participant.name})`);
        setMembers((prev) => {
          if (prev.some((m) => m.identity === participant.identity)) return prev;
          return [
            ...prev,
            {
              identity: participant.identity,
              name: resolveParticipantName(participant),
              joinedAt: Date.now(),
            },
          ];
        });
      });

      livekitRoom.on(RoomEvent.ParticipantNameChanged, (name: string, participant: Participant) => {
        console.log(`[HostLiveKit] Participant name updated: ${participant.identity} -> ${name}`);
        setMembers((prev) =>
          prev.map((m) =>
            m.identity === participant.identity
              ? { ...m, name: name?.trim() || m.name }
              : m
          )
        );
      });

      livekitRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log(`[HostLiveKit] Boardroom member disconnected: ${participant.identity}`);
        setMembers((prev) => prev.filter((m) => m.identity !== participant.identity));
      });

      livekitRoom.on(RoomEvent.Connected, () => {
        setIsConnected(true);
        setIsConnecting(false);
        const initialMembers: BoardroomMember[] = Array.from(livekitRoom.remoteParticipants.values()).map((p) => ({
          identity: p.identity,
          name: resolveParticipantName(p),
          joinedAt: Date.now(),
        }));
        setMembers(initialMembers);
        console.log(`[HostLiveKit] Host connected to room: ${roomName}. Initial members: ${initialMembers.length}`);

        // Automatically attach any existing tracks from participants already in the room
        livekitRoom.remoteParticipants.forEach((p) => {
          p.audioTrackPublications.forEach((pub) => {
            if (pub.track && pub.isSubscribed) {
              console.log(`[HostLiveKit] Attaching pre-existing track from ${p.identity}`);
              audioGraph.attachRemoteTrack(pub.track as RemoteAudioTrack);
              setActiveSpeakerIdentity(p.identity);
            }
          });
        });
      });

      livekitRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        setActiveSpeakerIdentity(null);
        setMembers([]);
        audioGraph.detachRemoteTrack();
        console.log('[HostLiveKit] Host disconnected from room');
      });

      await livekitRoom.connect(url, token);
      setRoom(livekitRoom);
    } catch (err: unknown) {
      console.error('[HostLiveKit] Error connecting host:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect host');
      setIsConnecting(false);
      setIsConnected(false);
      setMembers([]);
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
    setMembers([]);
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
    members,
    memberCount: members.length,
    error,
    connectHost,
    disconnectHost,
  };
}
