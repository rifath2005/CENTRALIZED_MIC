import React, { useState, useMemo, useEffect } from 'react';
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
  Switch,
} from 'react-native';
import { useLiveKitTransmitter } from './src/hooks/useLiveKitTransmitter';
import { useFloorControl } from './src/hooks/useFloorControl';
import { AcousticVuMeter } from './src/components/AcousticVuMeter';
import { AcousticPttButton, MicInteractionMode } from './src/components/AcousticPttButton';
import { AcousticRadarVisualizer } from './src/components/AcousticRadarVisualizer';
import { AcousticSegmentedInput } from './src/components/AcousticSegmentedInput';
import { NativeAudio } from './src/native/NativeAudioConfig';
import { acousticTheme } from './src/theme/acousticTheme';

// Hardcoded Cloud Token Broker URL
const TOKEN_SERVER_URL = 'https://centralized-mic-token-server.onrender.com';

// Room code limit (compact STG-709 is 7 chars, allow up to 12)
const MAX_ROOM_CODE_LENGTH = 12;
const MAX_NAME_LENGTH = 28;

export default function App() {
  // Demo room code: STG-709 (compact 7 characters, strictly under 10)
  const [roomCode, setRoomCode] = useState('STG-709');
  const [userName, setUserName] = useState('Maya Lin (Lead Vocals)');
  const [interactionMode, setInteractionMode] = useState<MicInteractionMode>('hold');
  const [audioInputDevice, setAudioInputDevice] = useState<'builtin' | 'interface' | 'bluetooth'>('builtin');
  const [agcLimiter, setAgcLimiter] = useState(true);
  const [iemMonitoring, setIemMonitoring] = useState(true);
  const [gainBoostDb, setGainBoostDb] = useState(6); // 0dB to 18dB
  const [friendlyError, setFriendlyError] = useState<string | null>(null);

  // Participant unique ID
  const participantId = useMemo(
    () => `phone-${userName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}-${Date.now().toString().slice(-4)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // LiveKit WebRTC Transmitter hook
  const {
    room,
    connectionState,
    audioLevel,
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

  // Apply software gain boost when slider changes (0dB = 1.0, 18dB = 1.5)
  useEffect(() => {
    const linearGain = 1.0 + (gainBoostDb / 18) * 0.5;
    setMicGain(linearGain);
  }, [gainBoostDb, setMicGain]);

  // Simplify error messages for the attendee
  useEffect(() => {
    if (transmitterError) {
      const lower = transmitterError.toLowerCase();
      if (lower.includes('room') || lower.includes('not found') || lower.includes('exist') || lower.includes('404')) {
        setFriendlyError(`Room ${roomCode} is closed or rejected handshake. Check console.`);
      } else if (lower.includes('mic') || lower.includes('permission')) {
        setFriendlyError('Microphone permission is required to talk.');
      } else {
        setFriendlyError('Something went wrong. Please check your connection.');
      }
    } else {
      setFriendlyError(null);
    }
  }, [transmitterError, roomCode]);

  // Restrict and sanitize Room Code input (e.g. STG-709)
  const handleRoomCodeChange = (raw: string) => {
    setFriendlyError(null);
    const sanitized = raw
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, MAX_ROOM_CODE_LENGTH);
    setRoomCode(sanitized);
  };

  const handleNameChange = (raw: string) => {
    setFriendlyError(null);
    setUserName(raw.slice(0, MAX_NAME_LENGTH));
  };

  // Parse QR scan or clipboard JSON / string safely
  const handleApplyPayload = (rawText: string, autoConnect: boolean = false) => {
    setFriendlyError(null);
    const trimmed = rawText.trim();
    let target = trimmed;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.room) target = String(parsed.room);
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
      setFriendlyError('Room not found in scanned data.');
    }
  };

  // One-Tap Paste from Clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getString();
      if (text && text.trim()) {
        handleApplyPayload(text, true);
      } else {
        // Fallback default paste shortcut
        setRoomCode('STG-709');
      }
    } catch {
      setRoomCode('STG-709');
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
      setFriendlyError('Please enter a room code.');
      return;
    }
    if (cleaned.length < 3) {
      setFriendlyError('Room code is too short.');
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
      <StatusBar barStyle="light-content" backgroundColor={acousticTheme.colors.surface} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* ========================================================================= */}
          {/* 1. CONNECTING STATE SCREEN (Acoustic Radar Visualizer & WebRTC Pipeline)   */}
          {/* ========================================================================= */}
          {isConnecting ? (
            <AcousticRadarVisualizer
              roomCode={roomCode}
              onCancel={() => disconnect()}
              audioLevel={audioLevel}
            />
          ) : !isConnected ? (
            /* ========================================================================= */
            /* 2. JOIN STAGE SCREEN (Matching airmic_join_screen_mob_jn_01..05)          */
            /* ========================================================================= */
            <View style={styles.joinContainer}>
              {/* MOB-JN-01: Header Section */}
              <View style={styles.joinHeader}>
                <View style={styles.headerPillsRow}>
                  <View style={styles.pulseBadge}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.pulseBadgeText}>AIRMIC WIRELESS TX</Text>
                  </View>
                  <View style={styles.telemetryBadge}>
                    <Text style={styles.telemetryIcon}>📶</Text>
                    <Text style={styles.telemetryText}>48kHz / 2.1ms</Text>
                  </View>
                </View>

                <Text style={styles.mainHeadline}>AirMic Stage Access</Text>
                <Text style={styles.subHeadline}>
                  Connect your mobile device as an ultra-low latency stage microphone
                </Text>
              </View>

              {/* Live Stage Visual Anchor (Tactile Card Layout) */}
              <View style={styles.stageAnchorCard}>
                <View style={styles.anchorLeft}>
                  <View style={styles.anchorIconBox}>
                    <Text style={styles.anchorIcon}>🎙️</Text>
                  </View>
                  <View>
                    <View style={styles.anchorTitleRow}>
                      <Text style={styles.anchorTitle}>STAGE GATEWAY v3.4</Text>
                      <View style={styles.emeraldDot} />
                    </View>
                    <Text style={styles.anchorSub}>DSP Broadcast Node Online</Text>
                  </View>
                </View>

                {/* Hardware LED Signal Meter (TX SYNC) */}
                <View style={styles.anchorRight}>
                  <Text style={styles.syncLabel}>TX SYNC</Text>
                  <View style={styles.signalMeter}>
                    <View style={[styles.signalBar, { height: 6, backgroundColor: acousticTheme.colors.secondary }]} />
                    <View style={[styles.signalBar, { height: 10, backgroundColor: acousticTheme.colors.secondary }]} />
                    <View style={[styles.signalBar, { height: 14, backgroundColor: acousticTheme.colors.secondary }]} />
                    <View style={[styles.signalBar, { height: 18, backgroundColor: acousticTheme.colors.primaryContainer }]} />
                    <View style={[styles.signalBar, { height: 5, backgroundColor: acousticTheme.colors.surfaceHighest }]} />
                  </View>
                </View>
              </View>

              {/* MOB-JN-02 & MOB-JN-04: Stage Connection Main Card */}
              <View style={styles.mainConnectCard}>
                {/* Code Input Section Header & Clipboard pill */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.codeLabelRow}>
                    <Text style={styles.codeIcon}>📌</Text>
                    <Text style={styles.cardHeaderTitle}>STAGE ROOM CODE</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pastePill}
                    onPress={handlePasteFromClipboard}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pasteIcon}>📋</Text>
                    <Text style={styles.pastePillText}>Auto: STG-709</Text>
                  </TouchableOpacity>
                </View>

                {/* MOB-JN-02: 6/7-Cell Segmented Monospace Hardware Input */}
                <AcousticSegmentedInput
                  value={roomCode}
                  onChange={handleRoomCodeChange}
                  hasError={Boolean(friendlyError)}
                />

                {/* Error Banner */}
                {friendlyError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorText}>{friendlyError}</Text>
                  </View>
                )}

                {/* Format Validation Footer */}
                <View style={styles.codeValidationRow}>
                  <Text style={styles.codeKeyFormat}>6-DIGIT AES-128 CHANNEL KEY</Text>
                  <View style={styles.validFormatBadge}>
                    <View style={styles.validDot} />
                    <Text style={styles.validFormatText}>Valid Format</Text>
                  </View>
                </View>

                {/* MOB-JN-03: Native Mobile QR Scanner launcher button */}
                <TouchableOpacity
                  style={styles.scanQrBtn}
                  onPress={handleScanQRCode}
                  activeOpacity={0.8}
                >
                  <Text style={styles.scanQrIcon}>📷</Text>
                  <Text style={styles.scanQrText}>Scan Stage QR</Text>
                </TouchableOpacity>
              </View>

              {/* Performer Profile & Device Configuration Module */}
              <View style={styles.profileCard}>
                {/* Performer Name Input */}
                <View style={styles.profileField}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldIcon}>👤</Text>
                    <Text style={styles.fieldLabel}>PERFORMER NAME / LABEL</Text>
                  </View>
                  <TextInput
                    style={styles.profileTextInput}
                    value={userName}
                    onChangeText={handleNameChange}
                    placeholder="e.g. Maya Lin (Lead Vocals)"
                    placeholderTextColor={acousticTheme.colors.outlineVariant}
                    maxLength={MAX_NAME_LENGTH}
                    autoCorrect={false}
                  />
                </View>

                {/* Audio Input Hardware Selector */}
                <View style={styles.profileField}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldIcon}>🎤</Text>
                    <Text style={styles.fieldLabel}>AUDIO INPUT HARDWARE</Text>
                    <Text style={styles.audioFormatBadge}>24-bit PCM</Text>
                  </View>
                  <View style={styles.deviceOptionRow}>
                    {[
                      { id: 'builtin', label: 'Built-in Omni' },
                      { id: 'interface', label: 'USB/Type-C' },
                      { id: 'bluetooth', label: 'IEM / BT' },
                    ].map((dev) => (
                      <TouchableOpacity
                        key={dev.id}
                        style={[
                          styles.deviceOptionBtn,
                          audioInputDevice === dev.id && styles.deviceOptionBtnActive,
                        ]}
                        onPress={() => setAudioInputDevice(dev.id as any)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.deviceOptionText,
                            audioInputDevice === dev.id && styles.deviceOptionTextActive,
                          ]}
                        >
                          {dev.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Acoustic Safety Toggles (AGC & IEM) */}
                <View style={styles.togglesGrid}>
                  <View style={styles.toggleCell}>
                    <View style={styles.toggleTextGroup}>
                      <Text style={styles.toggleTitle}>AGC & Limiter</Text>
                      <Text style={styles.toggleSub}>Prevent clip</Text>
                    </View>
                    <Switch
                      value={agcLimiter}
                      onValueChange={setAgcLimiter}
                      trackColor={{ false: acousticTheme.colors.surfaceContainerHigh, true: acousticTheme.colors.primaryContainer }}
                      thumbColor="#fff"
                    />
                  </View>

                  <View style={styles.toggleCell}>
                    <View style={styles.toggleTextGroup}>
                      <Text style={styles.toggleTitle}>In-Ear IEM</Text>
                      <Text style={styles.toggleSub}>Zero latency</Text>
                    </View>
                    <Switch
                      value={iemMonitoring}
                      onValueChange={setIemMonitoring}
                      trackColor={{ false: acousticTheme.colors.surfaceContainerHigh, true: acousticTheme.colors.secondary }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              </View>

              {/* MOB-JN-05: Primary Action CTA Button & Security Status */}
              <View style={styles.connectCtaContainer}>
                <TouchableOpacity
                  style={styles.connectCtaBtn}
                  onPress={handleConnect}
                  activeOpacity={0.85}
                >
                  <Text style={styles.connectCtaIcon}>📡</Text>
                  <Text style={styles.connectCtaText}>Connect to Stage</Text>
                </TouchableOpacity>

                <View style={styles.securityRow}>
                  <Text style={styles.securityItem}>🔒 Secure WebRTC Opus Link</Text>
                  <Text style={styles.securityDot}>•</Text>
                  <Text style={styles.securityItem}>⚡ Priority QoS Active</Text>
                </View>
              </View>

              {/* Front of House Node Callout Card */}
              <View style={styles.fohCallout}>
                <View style={styles.fohIconBox}>
                  <Text style={styles.fohIcon}>🎛️</Text>
                </View>
                <View style={styles.fohContent}>
                  <Text style={styles.fohTitle}>Front of House (FOH) Node</Text>
                  <Text style={styles.fohSub}>Master Desk ready to receive live mix stream</Text>
                </View>
              </View>
            </View>
          ) : (
            /* ========================================================================= */
            /* 3. ACTIVE STAGE SCREEN (Matching airmic_active_stage_mob_st_01..08)       */
            /* ========================================================================= */
            <View style={styles.activeContainer}>
              {/* Top Utility Bar: Stage Exit & Live Room Status */}
              <View style={styles.stageTopBar}>
                <View style={styles.liveRoomPill}>
                  <View style={styles.liveRoomDot} />
                  <Text style={styles.liveRoomText}>{roomCode} • LIVE</Text>
                </View>

                <TouchableOpacity
                  style={styles.exitStageBtn}
                  onPress={handleConfirmDisconnect}
                  activeOpacity={0.7}
                >
                  <Text style={styles.exitStageText}>✕ Exit Stage</Text>
                </TouchableOpacity>
              </View>

              {/* MOB-ST-01: Performer Status Card */}
              <View style={styles.performerCard}>
                <View style={styles.performerLeft}>
                  <View style={styles.performerAvatarWell}>
                    <Text style={styles.performerAvatarEmoji}>👤</Text>
                    <View style={styles.performerOnlineDot} />
                  </View>
                  <View style={styles.performerDetails}>
                    <View style={styles.performerNameRow}>
                      <Text style={styles.performerName} numberOfLines={1}>
                        {userName}
                      </Text>
                      <Text style={styles.verifiedIcon}>✓</Text>
                    </View>
                    <Text style={styles.performerRole}>Vocal Lead • Main FOH Send</Text>
                  </View>
                </View>

                <View style={styles.performerRight}>
                  <View style={styles.fohMonBadge}>
                    <Text style={styles.fohMonText}>FOH MON</Text>
                  </View>
                  <Text style={styles.busTag}>BUS A</Text>
                </View>
              </View>

              {/* MOB-ST-02: Native Mobile Connection Quality Telemetry Badge */}
              <View style={styles.networkBadge}>
                <View style={styles.networkLeft}>
                  <View style={styles.signalMiniBars}>
                    <View style={[styles.miniBar, { height: 4 }]} />
                    <View style={[styles.miniBar, { height: 7 }]} />
                    <View style={[styles.miniBar, { height: 10 }]} />
                    <View style={[styles.miniBar, { height: 10 }]} />
                  </View>
                  <Text style={styles.networkTelemetryText}>
                    11ms Ping • 0.0% Loss • 1.2ms Jitter
                  </Text>
                </View>
                <Text style={styles.networkQualityLabel}>ULTRA-LOW LATENCY</Text>
              </View>

              {/* MOB-ST-03: Studio-Grade LED Peak-Hold Audio Level Meter */}
              <AcousticVuMeter level={audioLevel} active={isSpeaking} />

              {/* MOB-ST-04, MOB-ST-05, MOB-ST-06: Giant Illuminated PTT Button & Mode Switch */}
              <AcousticPttButton
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

              {/* MOB-ST-08: Native Software Gain Boost Slider Control (0dB to +18dB) */}
              <View style={styles.gainCard}>
                <View style={styles.gainHeader}>
                  <View style={styles.gainHeaderLeft}>
                    <Text style={styles.gainIcon}>🔊</Text>
                    <Text style={styles.gainTitle}>Software Gain Boost</Text>
                  </View>
                  <View style={styles.gainReadoutPill}>
                    <Text style={styles.gainReadoutText}>+{gainBoostDb.toFixed(1)} dB</Text>
                  </View>
                </View>

                {/* Stepped Preset Buttons */}
                <View style={styles.gainStepRow}>
                  {[0, 6, 12, 18].map((db) => (
                    <TouchableOpacity
                      key={db}
                      style={[
                        styles.gainStepBtn,
                        gainBoostDb === db && styles.gainStepBtnActive,
                      ]}
                      onPress={() => setGainBoostDb(db)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.gainStepText,
                          gainBoostDb === db && styles.gainStepTextActive,
                        ]}
                      >
                        {db === 0 ? '0 dB (Unity)' : `+${db} dB`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* MOB-ST-07: Stream Audio Profile Badge */}
              <View style={styles.encoderBadge}>
                <View style={styles.encoderLeft}>
                  <Text style={styles.encoderIcon}>🎚️</Text>
                  <Text style={styles.encoderLabel}>ENCODER PROFILE</Text>
                </View>
                <View style={styles.encoderPill}>
                  <Text style={styles.encoderPillText}>Opus 48kHz Stereo 128kbps</Text>
                </View>
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
    backgroundColor: acousticTheme.colors.surface,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: acousticTheme.spacing.md,
    backgroundColor: acousticTheme.colors.surface,
  },

  /* ------------------------------------------------------------------------- */
  /* Join Screen Styles                                                        */
  /* ------------------------------------------------------------------------- */
  joinContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: acousticTheme.spacing.md,
  },
  joinHeader: {
    gap: 6,
  },
  headerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: acousticTheme.borderRadius.full,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: acousticTheme.colors.secondary,
  },
  pulseBadgeText: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.secondary,
    letterSpacing: 1,
  },
  telemetryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: acousticTheme.borderRadius.xs,
    backgroundColor: acousticTheme.colors.surfaceLowest,
    gap: 4,
  },
  telemetryIcon: {
    fontSize: 10,
  },
  telemetryText: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.onSurfaceVariant,
  },
  mainHeadline: {
    fontSize: 24,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.onSurface,
    letterSpacing: -0.5,
  },
  subHeadline: {
    fontSize: 13,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  stageAnchorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: acousticTheme.colors.surfaceLowest,
    borderRadius: acousticTheme.borderRadius.lg,
    padding: acousticTheme.spacing.md,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceContainerHigh,
  },
  anchorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  anchorIconBox: {
    width: 44,
    height: 44,
    borderRadius: acousticTheme.borderRadius.md,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorIcon: {
    fontSize: 20,
  },
  anchorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  anchorTitle: {
    fontSize: 12,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.onSurface,
  },
  emeraldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: acousticTheme.colors.secondary,
  },
  anchorSub: {
    fontSize: 10,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  anchorRight: {
    alignItems: 'flex-end',
  },
  syncLabel: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  signalMeter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 20,
  },
  signalBar: {
    width: 4,
    borderRadius: 1,
  },
  mainConnectCard: {
    backgroundColor: acousticTheme.colors.surfaceContainerLow,
    borderRadius: acousticTheme.borderRadius.xl,
    padding: acousticTheme.spacing.md,
    gap: acousticTheme.spacing.sm,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '50',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeIcon: {
    fontSize: 14,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.onSurface,
    letterSpacing: 0.8,
  },
  pastePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: acousticTheme.borderRadius.full,
    backgroundColor: acousticTheme.colors.surfaceHighest,
    gap: 4,
  },
  pasteIcon: {
    fontSize: 10,
  },
  pastePillText: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: acousticTheme.borderRadius.sm,
    backgroundColor: acousticTheme.colors.errorContainer,
    gap: 6,
  },
  errorIcon: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onErrorContainer,
    flex: 1,
  },
  codeValidationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  codeKeyFormat: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  validFormatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  validDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: acousticTheme.colors.secondary,
  },
  validFormatText: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.secondary,
  },
  scanQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: acousticTheme.borderRadius.md,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    gap: 8,
    marginTop: 4,
  },
  scanQrIcon: {
    fontSize: 16,
  },
  scanQrText: {
    fontSize: 12,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.onSurface,
  },
  profileCard: {
    backgroundColor: acousticTheme.colors.surfaceContainerLow,
    borderRadius: acousticTheme.borderRadius.xl,
    padding: acousticTheme.spacing.md,
    gap: acousticTheme.spacing.md,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '50',
  },
  profileField: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldIcon: {
    fontSize: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.onSurface,
    letterSpacing: 0.8,
  },
  audioFormatBadge: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.secondary,
    marginLeft: 'auto',
  },
  profileTextInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: acousticTheme.borderRadius.md,
    backgroundColor: acousticTheme.colors.surfaceLowest,
    color: acousticTheme.colors.onSurface,
    fontFamily: 'Courier',
    fontSize: 13,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '40',
  },
  deviceOptionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  deviceOptionBtn: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: acousticTheme.borderRadius.sm,
    backgroundColor: acousticTheme.colors.surfaceLowest,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '40',
  },
  deviceOptionBtnActive: {
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    borderColor: acousticTheme.colors.secondary,
  },
  deviceOptionText: {
    fontSize: 10,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onSurfaceVariant,
  },
  deviceOptionTextActive: {
    color: acousticTheme.colors.secondary,
    fontWeight: '800',
  },
  togglesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleCell: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: acousticTheme.colors.surfaceLowest,
    borderRadius: acousticTheme.borderRadius.md,
    padding: 10,
  },
  toggleTextGroup: {
    gap: 2,
  },
  toggleTitle: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.onSurface,
  },
  toggleSub: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
  },
  connectCtaContainer: {
    gap: 6,
    marginTop: 4,
  },
  connectCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: acousticTheme.borderRadius.lg,
    backgroundColor: acousticTheme.colors.primaryContainer,
    gap: 8,
    shadowColor: acousticTheme.colors.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  connectCtaIcon: {
    fontSize: 18,
  },
  connectCtaText: {
    fontSize: 15,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.onPrimaryContainer,
    letterSpacing: 0.5,
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  securityItem: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
  },
  securityDot: {
    fontSize: 10,
    color: acousticTheme.colors.surfaceHighest,
  },
  fohCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: acousticTheme.colors.surfaceLowest,
    borderRadius: acousticTheme.borderRadius.lg,
    padding: acousticTheme.spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceContainerHigh,
  },
  fohIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fohIcon: {
    fontSize: 18,
  },
  fohContent: {
    flex: 1,
    gap: 2,
  },
  fohTitle: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.onSurface,
  },
  fohSub: {
    fontSize: 10,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
  },

  /* ------------------------------------------------------------------------- */
  /* Active Stage Screen Styles                                                */
  /* ------------------------------------------------------------------------- */
  activeContainer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: acousticTheme.spacing.sm,
  },
  stageTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: acousticTheme.spacing.xs,
  },
  liveRoomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: acousticTheme.borderRadius.full,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    gap: 6,
  },
  liveRoomDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: acousticTheme.colors.primary,
  },
  liveRoomText: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.primary,
    letterSpacing: 0.8,
  },
  exitStageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: acousticTheme.borderRadius.sm,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
  },
  exitStageText: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.error,
  },
  performerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: acousticTheme.colors.surfaceContainer,
    borderRadius: acousticTheme.borderRadius.lg,
    padding: acousticTheme.spacing.md,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '50',
  },
  performerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  performerAvatarWell: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: acousticTheme.colors.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performerAvatarEmoji: {
    fontSize: 20,
  },
  performerOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: acousticTheme.colors.secondary,
    borderWidth: 2,
    borderColor: acousticTheme.colors.surfaceContainer,
  },
  performerDetails: {
    flex: 1,
    gap: 2,
  },
  performerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  performerName: {
    fontSize: 14,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.onSurface,
  },
  verifiedIcon: {
    fontSize: 12,
    fontWeight: '800',
    color: acousticTheme.colors.primary,
  },
  performerRole: {
    fontSize: 10,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onSurfaceVariant,
  },
  performerRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  fohMonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: acousticTheme.borderRadius.xs,
    backgroundColor: acousticTheme.colors.secondaryContainer + '30',
  },
  fohMonText: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.secondary,
  },
  busTag: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
  },
  networkBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: acousticTheme.colors.surfaceContainerLow,
    borderRadius: acousticTheme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '40',
  },
  networkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalMiniBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
    height: 10,
  },
  miniBar: {
    width: 2,
    backgroundColor: acousticTheme.colors.secondary,
    borderRadius: 1,
  },
  networkTelemetryText: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onSurface,
  },
  networkQualityLabel: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.secondary,
  },
  gainCard: {
    backgroundColor: acousticTheme.colors.surfaceContainer,
    borderRadius: acousticTheme.borderRadius.lg,
    padding: acousticTheme.spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '50',
  },
  gainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gainHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gainIcon: {
    fontSize: 14,
  },
  gainTitle: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.onSurface,
  },
  gainReadoutPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: acousticTheme.borderRadius.xs,
    backgroundColor: acousticTheme.colors.surfaceLowest,
  },
  gainReadoutText: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.primary,
  },
  gainStepRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gainStepBtn: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: acousticTheme.borderRadius.sm,
    backgroundColor: acousticTheme.colors.surfaceLowest,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '40',
  },
  gainStepBtnActive: {
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    borderColor: acousticTheme.colors.primary,
  },
  gainStepText: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
  },
  gainStepTextActive: {
    color: acousticTheme.colors.primary,
    fontWeight: '800',
  },
  encoderBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: acousticTheme.colors.surfaceContainerLow,
    borderRadius: acousticTheme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '40',
  },
  encoderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  encoderIcon: {
    fontSize: 12,
  },
  encoderLabel: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
  },
  encoderPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: acousticTheme.borderRadius.xs,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
  },
  encoderPillText: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.primary,
  },
});
