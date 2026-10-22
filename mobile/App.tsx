import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Clipboard,
  Animated,
} from 'react-native';
import { useLiveKitTransmitter } from './src/hooks/useLiveKitTransmitter';
import { useFloorControl } from './src/hooks/useFloorControl';
import { HoldToTalkButton, MicInteractionMode } from './src/components/HoldToTalkButton';
import { AudioLevelMeter } from './src/components/AudioLevelMeter';
import { NativeAudio } from './src/native/NativeAudioConfig';

// Hardcoded Cloud Token Broker URL - no user configuration required
const TOKEN_SERVER_URL = 'https://centralized-mic-token-server.onrender.com';

// Room code character limit
const MAX_ROOM_CODE_LENGTH = 10;
const MAX_NAME_LENGTH = 24;

export default function App() {
  const [roomCode, setRoomCode] = useState('BOARDROOM-1');
  const [userName, setUserName] = useState(`Speaker-${Math.floor(100 + Math.random() * 900)}`);
  const [interactionMode, setInteractionMode] = useState<MicInteractionMode>('hold');
  const [friendlyError, setFriendlyError] = useState<string | null>(null);

  // Logo pulse animation for loading/connecting
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  // Participant unique ID
  const participantId = useMemo(
    () => `phone-${userName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // LiveKit WebRTC Transmitter hook
  const {
    room,
    connectionState,
    audioLevel,
    micGain,
    setMicGain,
    error: transmitterError,
    connect,
    disconnect,
    unmuteMicrophone,
    muteMicrophone,
  } = useLiveKitTransmitter({
    tokenServerUrl: TOKEN_SERVER_URL,
    roomName: roomCode.trim().toUpperCase(),
    participantName: userName.trim(),
    participantIdentity: participantId,
  });

  // Authoritative Floor Control hook
  const {
    currentSpeaker,
    queue,
    isSpeaking,
    queuePosition,
    holdState,
    requestFloor,
    releaseFloor,
    leaveQueue,
  } = useFloorControl({
    room,
    participantId,
    participantName: userName.trim(),
    onFloorGranted: () => {
      unmuteMicrophone();
    },
    onFloorRevoked: () => {
      muteMicrophone();
    },
  });

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting' || connectionState === 'reconnecting';

  // Smooth logo pulsing animation when connecting or loading
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isConnecting) {
      anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.12,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 0.9,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.4,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.4);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isConnecting, pulseAnim, glowAnim]);

  // Sync and simplify error messages for the attendee
  useEffect(() => {
    if (transmitterError) {
      const lower = transmitterError.toLowerCase();
      if (lower.includes('room') || lower.includes('not found') || lower.includes('exist') || lower.includes('404')) {
        setFriendlyError("Room code doesn't match any active room. Please check your code.");
      } else if (lower.includes('mic') || lower.includes('permission')) {
        setFriendlyError("Microphone permission is required to talk.");
      } else {
        setFriendlyError("Something went wrong. Please check your connection.");
      }
    } else {
      setFriendlyError(null);
    }
  }, [transmitterError]);

  // Restrict and sanitize Room Code input (Max 10 chars, uppercase letters, numbers, and hyphens only)
  const handleRoomCodeChange = (raw: string) => {
    setFriendlyError(null);
    const sanitized = raw
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, MAX_ROOM_CODE_LENGTH);
    setRoomCode(sanitized);
  };

  // Restrict participant name
  const handleNameChange = (raw: string) => {
    setFriendlyError(null);
    setUserName(raw.slice(0, MAX_NAME_LENGTH));
  };

  // Parse QR scan or clipboard JSON / string safely
  const handleApplyPayload = (rawText: string, autoConnect: boolean = false) => {
    setFriendlyError(null);
    const trimmed = rawText.trim();
    let target = trimmed;

    // Check if JSON pairing payload
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.room) {
          target = String(parsed.room);
        }
      } catch {
        // Fallback to raw text
      }
    } else if (trimmed.includes('#')) {
      target = trimmed.split('#').pop()?.trim() || target;
    } else if (trimmed.includes('room=')) {
      const match = trimmed.match(/room=([A-Za-z0-9_-]+)/);
      if (match && match[1]) target = match[1];
    }

    const sanitized = target
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, MAX_ROOM_CODE_LENGTH);

    if (sanitized) {
      setRoomCode(sanitized);
      if (autoConnect) {
        setTimeout(() => handleConnect(), 300);
      }
    } else {
      setFriendlyError("Room not found in scanned data.");
    }
  };

  // One-Tap Paste from Clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getString();
      if (text && text.trim()) {
        handleApplyPayload(text, true);
      } else {
        Alert.alert('Clipboard Empty', 'Copy a room code first, then tap Paste.');
      }
    } catch {
      Alert.alert('Notice', 'Could not read from clipboard.');
    }
  };

  // Launch Camera QR Scanner
  const handleScanQRCode = async () => {
    try {
      const scannedCode = await NativeAudio.scanQRCode();
      if (scannedCode) {
        handleApplyPayload(scannedCode, true);
      }
    } catch {
      Alert.alert('Notice', 'Camera scanner unavailable. Please type or paste the code.');
    }
  };

  // Connect to room with validation
  const handleConnect = () => {
    setFriendlyError(null);
    const cleaned = roomCode.trim().toUpperCase();
    if (!cleaned) {
      setFriendlyError("Please enter a room code.");
      return;
    }
    if (cleaned.length < 3) {
      setFriendlyError("Room code is too short.");
      return;
    }
    connect();
  };

  // Safe disconnect with confirmation
  const handleConfirmDisconnect = () => {
    Alert.alert(
      'Leave Stage?',
      'Disconnect your phone microphone from the sound system?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => disconnect(),
        },
      ]
    );
  };

  // Toggle Mode for Hold to Talk
  const handleTogglePress = () => {
    if (holdState === 'speaking') {
      releaseFloor();
    } else {
      requestFloor(true);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0515" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ========================================================================= */}
          {/* 1. LOADING / CONNECTING STATE (Animated Purple Emblem - NEVER BLACK)       */}
          {/* ========================================================================= */}
          {isConnecting ? (
            <View style={styles.loadingContainer}>
              <Animated.View
                style={[
                  styles.logoRing,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: glowAnim,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.logoBadge,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Text style={styles.logoBadgeEmoji}>🎙️</Text>
              </Animated.View>

              <Text style={styles.loadingTitle}>AirMic</Text>
              <Text style={styles.loadingSubtitle}>Connecting to room {roomCode}...</Text>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => disconnect()}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : !isConnected ? (
            /* ========================================================================= */
            /* 2. JOIN STAGE SCREEN (Ultra-Clean, Zero Technical Overload)               */
            /* ========================================================================= */
            <View style={styles.joinContainer}>
              {/* App Brand Header */}
              <View style={styles.brandHeader}>
                <View style={styles.logoBadgeSmall}>
                  <Text style={styles.logoEmojiSmall}>🎙️</Text>
                </View>
                <Text style={styles.appTitle}>AirMic</Text>
                <Text style={styles.appTagline}>Instant Stage Microphone</Text>
              </View>

              {/* Friendly Error Banner */}
              {friendlyError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{friendlyError}</Text>
                </View>
              )}

              {/* Main Clean Card */}
              <View style={styles.card}>
                {/* Room Code Input (Strict Length & Character Validation) */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>ROOM CODE</Text>
                    <Text style={styles.characterCounter}>
                      {roomCode.length}/{MAX_ROOM_CODE_LENGTH}
                    </Text>
                  </View>
                  <TextInput
                    style={[
                      styles.roomInput,
                      friendlyError ? styles.roomInputError : null,
                    ]}
                    value={roomCode}
                    onChangeText={handleRoomCodeChange}
                    placeholder="e.g. BOARD-101"
                    placeholderTextColor="#7e6b99"
                    maxLength={MAX_ROOM_CODE_LENGTH}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>

                {/* Quick Scan & Paste Shortcut Pills */}
                <View style={styles.quickActionRow}>
                  <TouchableOpacity
                    style={styles.actionPill}
                    onPress={handleScanQRCode}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionPillText}>📷 Scan QR</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionPill}
                    onPress={handlePasteFromClipboard}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.actionPillText}>📋 Paste Code</Text>
                  </TouchableOpacity>
                </View>

                {/* User Name Input */}
                <View style={[styles.inputGroup, { marginTop: 16 }]}>
                  <Text style={styles.inputLabel}>YOUR NAME</Text>
                  <TextInput
                    style={styles.nameInput}
                    value={userName}
                    onChangeText={handleNameChange}
                    placeholder="Your Name (e.g. Alex)"
                    placeholderTextColor="#7e6b99"
                    maxLength={MAX_NAME_LENGTH}
                    autoCorrect={false}
                  />
                </View>

                {/* Primary Big Purple Connect Button */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleConnect}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>ENTER STAGE</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ========================================================================= */
            /* 3. ACTIVE STAGE SCREEN (Pure Operation: Hold-to-Talk & Status Only)        */
            /* ========================================================================= */
            <View style={styles.activeContainer}>
              {/* Minimal Top Stage Pill */}
              <View style={styles.stageBar}>
                <View style={styles.stagePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.stagePillText}>STAGE: {roomCode}</Text>
                </View>

                <TouchableOpacity
                  style={styles.leavePill}
                  onPress={handleConfirmDisconnect}
                  activeOpacity={0.7}
                >
                  <Text style={styles.leavePillText}>Leave</Text>
                </TouchableOpacity>
              </View>

              {/* Speaker / Queue Status Banner */}
              <View style={styles.speakerCard}>
                <Text style={styles.speakerCardLabel}>
                  {isSpeaking
                    ? 'LIVE ON AIR'
                    : currentSpeaker
                    ? 'CURRENT SPEAKER'
                    : 'FLOOR STATUS'}
                </Text>
                <Text
                  style={[
                    styles.speakerCardName,
                    {
                      color: isSpeaking ? '#34d399' : '#ffffff',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {isSpeaking
                    ? '🎙️ You are Speaking'
                    : currentSpeaker
                    ? currentSpeaker.name
                    : 'Floor is Open'}
                </Text>

                {queue.length > 0 && !isSpeaking && (
                  <View style={styles.queueNotice}>
                    <Text style={styles.queueNoticeText}>
                      {queuePosition !== null
                        ? `You are #${queuePosition} in line (${queue.length} waiting)`
                        : `${queue.length} attendee${queue.length === 1 ? '' : 's'} waiting to speak`}
                    </Text>
                  </View>
                )}
              </View>

              {/* Big Ergonomic Purple Hold-to-Talk Button */}
              <HoldToTalkButton
                holdState={holdState}
                disabled={!isConnected}
                queuePosition={queuePosition}
                currentSpeakerName={currentSpeaker?.name ?? null}
                interactionMode={interactionMode}
                onModeChange={setInteractionMode}
                onPressIn={() => requestFloor(false)}
                onPressOut={releaseFloor}
                onTogglePress={handleTogglePress}
                onLeaveQueue={leaveQueue}
              />

              {/* Minimal Speech Level Meter */}
              <AudioLevelMeter level={audioLevel} active={isSpeaking} gainBoost={micGain} />

              {/* Clean Voice Sensitivity Selector */}
              <View style={styles.gainSelectorRow}>
                <Text style={styles.gainSelectorLabel}>Mic Boost:</Text>
                {[1.0, 1.25, 1.5].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gainSelectorPill, micGain === g && styles.gainSelectorPillActive]}
                    onPress={() => setMicGain(g)}
                  >
                    <Text
                      style={[
                        styles.gainSelectorPillText,
                        micGain === g && styles.gainSelectorPillTextActive,
                      ]}
                    >
                      {g === 1.0 ? 'Normal' : g === 1.25 ? 'Medium' : 'High'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0d0515',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },

  /* ------------------------------------------------------------------------- */
  /* Intro / Loading Screen Styles                                             */
  /* ------------------------------------------------------------------------- */
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    position: 'relative',
  },
  logoRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#a855f7',
    top: 30,
  },
  logoBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#581c87',
    borderWidth: 3,
    borderColor: '#c084fc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 24,
  },
  logoBadgeEmoji: {
    fontSize: 48,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#d8b4fe',
    marginBottom: 28,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ------------------------------------------------------------------------- */
  /* Join Stage Screen Styles                                                  */
  /* ------------------------------------------------------------------------- */
  joinContainer: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadgeSmall: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#581c87',
    borderWidth: 2,
    borderColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  logoEmojiSmall: {
    fontSize: 32,
  },
  appTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  appTagline: {
    fontSize: 13,
    color: '#d8b4fe',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    borderWidth: 1,
    borderColor: '#f43f5e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
    gap: 10,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    flex: 1,
    color: '#fecdd3',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#160a24',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#4d2179',
    shadowColor: '#3b0764',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  inputGroup: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#d8b4fe',
    letterSpacing: 1.2,
  },
  characterCounter: {
    fontSize: 11,
    color: '#a79bbd',
    fontWeight: '700',
  },
  roomInput: {
    backgroundColor: '#200f33',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    borderWidth: 1.5,
    borderColor: '#5b268f',
    textAlign: 'center',
  },
  roomInputError: {
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
  },
  nameInput: {
    backgroundColor: '#200f33',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: '#5b268f',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionPill: {
    flex: 1,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: '#7e22ce',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    color: '#e2d9f3',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#7e22ce',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  /* ------------------------------------------------------------------------- */
  /* Active Stage Screen Styles                                                */
  /* ------------------------------------------------------------------------- */
  activeContainer: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  stageBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    marginBottom: 16,
  },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#160a24',
    borderWidth: 1,
    borderColor: '#4d2179',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  stagePillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  leavePill: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#f43f5e',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  leavePillText: {
    color: '#fb7185',
    fontSize: 11,
    fontWeight: '800',
  },
  speakerCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#160a24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4d2179',
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  speakerCardLabel: {
    fontSize: 10,
    color: '#d8b4fe',
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  speakerCardName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
  },
  queueNotice: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#3b165b',
    width: '100%',
    alignItems: 'center',
  },
  queueNoticeText: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '700',
  },
  gainSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  gainSelectorLabel: {
    fontSize: 11,
    color: '#d8b4fe',
    fontWeight: '700',
  },
  gainSelectorPill: {
    backgroundColor: '#200f33',
    borderWidth: 1,
    borderColor: '#4d2179',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gainSelectorPillActive: {
    backgroundColor: '#7e22ce',
    borderColor: '#c084fc',
  },
  gainSelectorPillText: {
    fontSize: 10,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  gainSelectorPillTextActive: {
    color: '#ffffff',
  },
});
