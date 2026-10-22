import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  ParticipantEvent,
  LocalAudioTrack,
  createLocalAudioTrack,
  AudioPresets,
  ConnectionQuality,
  Track,
} from 'livekit-client';
import { ConnectionState } from '../types/floor';
import { NativeAudio } from '../native/NativeAudioConfig';

interface UseLiveKitTransmitterProps {
  tokenServerUrl: string;
  roomName: string;
  participantName: string;
  participantIdentity?: string;
}

export function useLiveKitTransmitter({
  tokenServerUrl,
  roomName,
  participantName,
  participantIdentity,
}: UseLiveKitTransmitterProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'unknown'>('unknown');
  const [micGain, setMicGain] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);

  const micGainRef = useRef<number>(1.0);
  micGainRef.current = micGain;

  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const currentTokenRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isManuallyDisconnectedRef = useRef<boolean>(false);
  const roomInstanceRef = useRef<Room | null>(null);

  /**
   * Fetch token from Token Server
   */
  const fetchToken = useCallback(
    async (rName: string, pName: string): Promise<{ token: string; url: string }> => {
      const response = await fetch(`${tokenServerUrl.replace(/\/$/, '')}/api/token/participant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: rName,
          participantName: pName,
          participantIdentity,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Token server returned status ${response.status}`);
      }

      const data = await response.json();
      return { token: data.token, url: data.url };
    },
    [tokenServerUrl, participantIdentity]
  );

  /**
   * Creates audio track with hardware AEC and low-latency Opus settings
   */
  const createOptimizedAudioTrack = async (): Promise<LocalAudioTrack> => {
    // 1. Invoke native audio layer configuration (iOS VoiceChat/bottom mic, Android VoiceCommunication)
    await NativeAudio.configureLowLatencyVoice();

    // 2. Request WebRTC audio track with VoiceProcessingIO / AEC constraints
    const track = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,      // Mono reduces bandwidth and encoding latency
      sampleRate: 48000,    // 48 kHz standard Opus broadcast rate
      // Opus low latency parameters:
      // Note: LiveKit sets ptime=20ms and opus bitrate
    });

    // Start muted immediately so transmitter emits nothing until floor is granted
    await track.mute();
    return track;
  };

  /**
   * Connect to LiveKit Room
   */
  const connect = useCallback(async () => {
    if (!roomName.trim()) {
      setError('Please provide a valid Room Name / Code.');
      return;
    }

    try {
      setError(null);
      setConnectionState('connecting');
      isManuallyDisconnectedRef.current = false;

      // 1. Request fresh token
      const { token, url } = await fetchToken(roomName, participantName);
      currentTokenRef.current = token;

      // 2. Instantiate LiveKit Room with ultra-low latency tuning
      const livekitRoom = new Room({
        adaptiveStream: false,
        dynacast: false,
        // Disable audio downlink since transmitter only publishes speech
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        publishDefaults: {
          audioPreset: AudioPresets.speech, // 32kbps mono, optimized for low overhead
          dtx: false, // Discontinuous Transmission disabled to avoid speech onset clipping
        },
      });

      roomInstanceRef.current = livekitRoom;

      // 3. Setup event listeners
      livekitRoom.on(RoomEvent.Connected, async () => {
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;

        // Start Android Foreground Service for lock-screen recording persistence
        await NativeAudio.startForegroundService(roomName);

        // Create and publish muted local audio track
        try {
          const audioTrack = await createOptimizedAudioTrack();
          localAudioTrackRef.current = audioTrack;
          await livekitRoom.localParticipant.publishTrack(audioTrack, {
            name: 'speech-mic',
            source: Track.Source.Microphone,
          });
        } catch (publishErr) {
          console.error('[LiveKitTransmitter] Error creating/publishing audio track:', publishErr);
          setError('Microphone access denied or audio device busy.');
        }
      });

      // Wi-Fi <-> Cellular network handoff handling
      livekitRoom.on(RoomEvent.Reconnecting, () => {
        console.warn('[LiveKitTransmitter] Network handoff detected. Reconnecting to SFU...');
        setConnectionState('reconnecting');
      });

      livekitRoom.on(RoomEvent.Reconnected, () => {
        console.log('[LiveKitTransmitter] Reconnected successfully to room.');
        setConnectionState('connected');
        reconnectAttemptsRef.current = 0;
      });

      livekitRoom.on(RoomEvent.Disconnected, async () => {
        console.warn('[LiveKitTransmitter] Disconnected from room.');
        if (!isManuallyDisconnectedRef.current) {
          // If token expired or unexpected disconnect, trigger retry with exponential backoff
          handleAutoReconnect();
        } else {
          setConnectionState('offline');
        }
      });

      // Audio level monitoring for transmitter UI feedback
      livekitRoom.localParticipant.on(
        ParticipantEvent.IsSpeakingChanged,
        (speaking: boolean) => {
          if (!speaking) setAudioLevel(0);
        }
      );

      livekitRoom.localParticipant.on(
        ParticipantEvent.ConnectionQualityChanged,
        (quality: ConnectionQuality) => {
          if (quality === ConnectionQuality.Excellent) setConnectionQuality('excellent');
          else if (quality === ConnectionQuality.Good) setConnectionQuality('good');
          else if (quality === ConnectionQuality.Poor) setConnectionQuality('poor');
          else setConnectionQuality('unknown');
        }
      );

      // Periodically sample participant audio level
      const meterInterval = setInterval(() => {
        if (livekitRoom.state === 'connected' && livekitRoom.localParticipant.isSpeaking) {
          // LiveKit audioLevel ranges from 0.0 to 1.0, scaled by user mic gain boost
          const raw = livekitRoom.localParticipant.audioLevel;
          setAudioLevel(Math.min(raw * micGainRef.current, 1.0));
        } else {
          setAudioLevel(0);
        }
      }, 80);

      // 4. Connect to SFU
      await livekitRoom.connect(url, token);
      setRoom(livekitRoom);

      return () => {
        clearInterval(meterInterval);
      };
    } catch (err: unknown) {
      console.error('[LiveKitTransmitter] Connection failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to connect to room';
      setError(msg);
      setConnectionState('offline');
    }
  }, [roomName, participantName, fetchToken]);

  /**
   * Automatic Reconnection with Exponential Backoff
   */
  const handleAutoReconnect = useCallback(async () => {
    if (isManuallyDisconnectedRef.current) return;

    if (reconnectAttemptsRef.current >= 5) {
      setError('Connection lost after multiple retry attempts. Please tap reconnect.');
      setConnectionState('offline');
      return;
    }

    setConnectionState('reconnecting');
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 8000);
    reconnectAttemptsRef.current += 1;
    console.log(`[LiveKitTransmitter] Retrying connection (attempt ${reconnectAttemptsRef.current}) in ${delay}ms...`);

    setTimeout(async () => {
      try {
        await connect();
      } catch (err) {
        console.warn('[LiveKitTransmitter] Retry attempt failed:', err);
      }
    }, delay);
  }, [connect]);

  /**
   * Explicit Disconnect
   */
  const disconnect = useCallback(async () => {
    isManuallyDisconnectedRef.current = true;
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }
    if (roomInstanceRef.current) {
      await roomInstanceRef.current.disconnect();
      roomInstanceRef.current = null;
    }
    setRoom(null);
    setConnectionState('offline');
    setAudioLevel(0);

    // Stop native services
    await NativeAudio.stopForegroundService();
    await NativeAudio.deactivateSession();
  }, []);

  /**
   * Unmute microphone (called immediately when floor is granted)
   */
  const unmuteMicrophone = useCallback(async () => {
    if (localAudioTrackRef.current && localAudioTrackRef.current.isMuted) {
      await localAudioTrackRef.current.unmute();
      console.log('[LiveKitTransmitter] Mic UNMUTED (Transmitting speech)');
    }
  }, []);

  /**
   * Mute microphone (called immediately when button is released or floor revoked)
   */
  const muteMicrophone = useCallback(async () => {
    if (localAudioTrackRef.current && !localAudioTrackRef.current.isMuted) {
      await localAudioTrackRef.current.mute();
      console.log('[LiveKitTransmitter] Mic MUTED (Stopped speech)');
    }
  }, []);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (roomInstanceRef.current) {
        roomInstanceRef.current.disconnect();
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
      }
      NativeAudio.stopForegroundService();
      NativeAudio.deactivateSession();
    };
  }, []);

  return {
    room,
    connectionState,
    audioLevel,
    connectionQuality,
    micGain,
    setMicGain,
    error,
    connect,
    disconnect,
    unmuteMicrophone,
    muteMicrophone,
  };
}
