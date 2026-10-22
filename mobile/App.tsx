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
} from 'react-native';
import { useLiveKitTransmitter } from './src/hooks/useLiveKitTransmitter';
import { useFloorControl } from './src/hooks/useFloorControl';
import { HoldToTalkButton, MicInteractionMode } from './src/components/HoldToTalkButton';
import { AudioLevelMeter } from './src/components/AudioLevelMeter';
import { ConnectionBadge } from './src/components/ConnectionBadge';
import { NativeAudio } from './src/native/NativeAudioConfig';

// Default configuration pointing to the live Render deployment
const DEFAULT_TOKEN_SERVER_URL = 'https://centralized-mic-token-server.onrender.com';

function generateRandomRoomCode(): string {
  const prefixes = ['BOARD', 'CONF', 'ROOM', 'MEET', 'STUDIO'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

export default function App() {
  const [tokenServerUrl, setTokenServerUrl] = useState(DEFAULT_TOKEN_SERVER_URL);
  const [roomInput, setRoomInput] = useState('BOARDROOM-1');
  const [nameInput, setNameInput] = useState(`Speaker-${Math.floor(1000 + Math.random() * 9000)}`);
  const [showConfig, setShowConfig] = useState(false);
  const [interactionMode, setInteractionMode] = useState<MicInteractionMode>('hold');
  const [connectingElapsed, setConnectingElapsed] = useState(0);
  const [showAcousticTips, setShowAcousticTips] = useState(false);
  const [showPreflightCheck, setShowPreflightCheck] = useState(false);
  const [recentRooms, setRecentRooms] = useState<string[]>(['BOARDROOM-1', 'CONF-101']);

  // Participant ID
  const participantId = useMemo(
    () => `phone-${nameInput.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // LiveKit WebRTC Transmitter hook
  const {
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
  } = useLiveKitTransmitter({
    tokenServerUrl,
    roomName: roomInput.trim().toUpperCase(),
    participantName: nameInput.trim(),
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
    participantName: nameInput.trim(),
    onFloorGranted: () => {
      unmuteMicrophone();
    },
    onFloorRevoked: () => {
      muteMicrophone();
    },
  });

  const isConnected = connectionState === 'connected';

  // Connecting timer to detect server cold-start
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (connectionState === 'connecting') {
      setConnectingElapsed(0);
      timer = setInterval(() => {
        setConnectingElapsed((s) => s + 1);
      }, 1000);
    } else {
      setConnectingElapsed(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [connectionState]);

  // Keep track of recent rooms
  useEffect(() => {
    if (isConnected && roomInput.trim()) {
      const sanitized = roomInput.trim().toUpperCase();
      setRecentRooms((prev) => Array.from(new Set([sanitized, ...prev])).slice(0, 4));
    }
  }, [isConnected, roomInput]);

  // Handle parsing QR code or clipboard payload
  const handleApplyPayload = (rawText: string, autoConnect: boolean = false) => {
    const trimmed = rawText.trim();
    let targetRoom = trimmed.toUpperCase();

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.room) {
          targetRoom = parsed.room.toUpperCase();
          setRoomInput(targetRoom);
        }
        if (parsed.server) {
          setTokenServerUrl(parsed.server);
        }
        Alert.alert('QR Scanned Successfully', `Paired to room: ${targetRoom}`);
        if (autoConnect) {
          setTimeout(() => connect(), 400);
        }
        return;
      } catch {
        // Fallback
      }
    } else if (trimmed.includes('#')) {
      const hashPart = trimmed.split('#').pop()?.trim();
      if (hashPart) {
        targetRoom = hashPart.toUpperCase();
      }
    } else if (trimmed.includes('room=')) {
      const match = trimmed.match(/room=([A-Za-z0-9_-]+)/);
      if (match && match[1]) {
        targetRoom = match[1].toUpperCase();
      }
    }

    setRoomInput(targetRoom);
    if (autoConnect) {
      setTimeout(() => connect(), 300);
    }
  };

  // Launch Native Google Play Services Code Scanner
  const handleScanQRCode = async () => {
    try {
      const scannedCode = await NativeAudio.scanQRCode();
      if (scannedCode) {
        handleApplyPayload(scannedCode, true);
      }
    } catch (err) {
      Alert.alert('Scanner Error', 'Could not initialize camera scanner. You can enter or paste the code manually.');
    }
  };

  // Toggle mode button press handler
  const handleTogglePress = () => {
    if (holdState === 'speaking') {
      releaseFloor();
    } else {
      requestFloor(true);
    }
  };

  // Generate a random unique room code
  const handleRandomizeRoom = () => {
    const unique = generateRandomRoomCode();
    setRoomInput(unique);
  };

  // Safe disconnect with confirmation
  const handleConfirmDisconnect = () => {
    Alert.alert(
      'Leave Meeting Room?',
      'Are you sure you want to disconnect your smartphone microphone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Room',
          style: 'destructive',
          onPress: () => disconnect(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#070B12" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Text style={styles.brandIconText}>🎙️</Text>
                </View>
                <View>
                  <Text style={styles.appTitle}>CENTRALIZED MIC</Text>
                  <Text style={styles.appSubtitle}>Ultra-Low-Latency PA Transmitter</Text>
                </View>
              </View>

              <View style={styles.latencyBadge}>
                <Text style={styles.latencyBadgeText}>&lt;300MS OPUS</Text>
              </View>
            </View>

            <ConnectionBadge
              state={connectionState}
              roomName={isConnected ? roomInput.toUpperCase() : undefined}
              quality={connectionQuality}
            />
          </View>

          {/* Connection Card */}
          {!isConnected ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Join Sound System</Text>
                <Text style={styles.cardSubtitle}>
                  Pair with host receiver via QR scan or room code
                </Text>
              </View>

              {/* Big Prominent Camera QR Scanner Button */}
              <TouchableOpacity
                style={styles.scanButton}
                onPress={handleScanQRCode}
                activeOpacity={0.8}
              >
                <Text style={styles.scanButtonIcon}>📷</Text>
                <View style={styles.scanButtonTextColumn}>
                  <Text style={styles.scanButtonTitle}>SCAN HOST QR CODE</Text>
                  <Text style={styles.scanButtonSub}>Point camera at computer or projector screen</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR ENTER CODE MANUALLY</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Room Code with Randomizer & Paste Helper */}
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>ROOM CODE</Text>
                <View style={styles.inputActions}>
                  <TouchableOpacity onPress={handleRandomizeRoom}>
                    <Text style={styles.actionLink}>🎲 Unique</Text>
                  </TouchableOpacity>
                  <Text style={styles.actionSep}>•</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.prompt
                        ? Alert.prompt(
                            'Paste Code or JSON',
                            'Paste room code or QR JSON string:',
                            (text) => text && handleApplyPayload(text)
                          )
                        : null;
                    }}
                  >
                    <Text style={styles.actionLink}>📋 Paste</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={styles.input}
                value={roomInput}
                onChangeText={(text) => handleApplyPayload(text)}
                placeholder="e.g. BOARDROOM-1"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {/* Recent Rooms Quick Switch Chips */}
              {recentRooms.length > 0 && (
                <View style={styles.recentRoomsRow}>
                  <Text style={styles.recentLabel}>Recent:</Text>
                  {recentRooms.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.recentChip, roomInput === r && styles.recentChipActive]}
                      onPress={() => setRoomInput(r)}
                    >
                      <Text
                        style={[
                          styles.recentChipText,
                          roomInput === r && styles.recentChipTextActive,
                        ]}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Participant Display Name */}
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>YOUR NAME / TITLE</Text>
                <TouchableOpacity
                  onPress={() => setNameInput(`Speaker-${Math.floor(1000 + Math.random() * 9000)}`)}
                >
                  <Text style={styles.actionLink}>🎲 Randomize</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="e.g. Sarah Jenkins (VP)"
                placeholderTextColor="#64748b"
                autoCorrect={false}
              />

              {/* Mic Gain Sensitivity Pre-Selector */}
              <View style={styles.sensitivityRow}>
                <Text style={styles.sensitivityLabel}>MIC SENSITIVITY:</Text>
                <View style={styles.gainButtons}>
                  {[1.0, 1.25, 1.5].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.gainPill, micGain === g && styles.gainPillActive]}
                      onPress={() => setMicGain(g)}
                    >
                      <Text style={[styles.gainPillText, micGain === g && styles.gainPillTextActive]}>
                        {g === 1.0 ? '100% (Normal)' : g === 1.25 ? '125% (Boost)' : '150% (High)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Preflight Mic Check Toggle */}
              <TouchableOpacity
                style={styles.preflightToggle}
                onPress={() => setShowPreflightCheck(!showPreflightCheck)}
              >
                <Text style={styles.preflightToggleText}>
                  {showPreflightCheck ? '▲ Hide Mic Pre-Check' : '🎙️ Pre-Flight Mic Check'}
                </Text>
              </TouchableOpacity>

              {showPreflightCheck && (
                <View style={styles.preflightBox}>
                  <Text style={styles.preflightTitle}>Acoustic Pre-Flight Check</Text>
                  <Text style={styles.preflightDesc}>
                    When you speak into the phone, hold it 5–10 cm from your lips.
                    Android hardware AEC will filter room speaker reflection automatically.
                  </Text>
                </View>
              )}

              {showConfig && (
                <View style={styles.advancedConfig}>
                  <Text style={styles.inputLabel}>TOKEN SERVER URL (LIVEKIT CLOUD)</Text>
                  <TextInput
                    style={styles.input}
                    value={tokenServerUrl}
                    onChangeText={setTokenServerUrl}
                    placeholder="https://centralized-mic-token-server.onrender.com"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}

              <TouchableOpacity
                onPress={() => setShowConfig(!showConfig)}
                style={styles.toggleConfigButton}
              >
                <Text style={styles.toggleConfigText}>
                  {showConfig ? '▲ Hide Advanced Server URL' : '⚙️ Advanced Server Configuration'}
                </Text>
              </TouchableOpacity>

              {/* Render Cold-Start Helper */}
              {connectionState === 'connecting' && connectingElapsed > 3 && (
                <View style={styles.coldStartCard}>
                  <Text style={styles.coldStartTitle}>⏳ Connecting to LiveKit Server ({connectingElapsed}s)</Text>
                  <Text style={styles.coldStartSub}>
                    Connecting to cloud SFU at {tokenServerUrl}. Please keep app open...
                  </Text>
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[
                  styles.connectButton,
                  connectionState === 'connecting' && styles.connectButtonDisabled,
                ]}
                disabled={connectionState === 'connecting'}
                onPress={connect}
                activeOpacity={0.85}
              >
                <Text style={styles.connectButtonText}>
                  {connectionState === 'connecting' ? 'CONNECTING TO SFU...' : 'CONNECT TO SOUND SYSTEM'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Active Microphone Controls */
            <View style={styles.activeContainer}>
              {/* Floor Status Card */}
              <View style={styles.statusCard}>
                <View style={styles.speakerRow}>
                  <Text style={styles.speakerLabel}>CURRENT FLOOR:</Text>
                  <View style={styles.speakerBadge}>
                    <Text
                      style={[
                        styles.speakerValue,
                        { color: isSpeaking ? '#34d399' : currentSpeaker ? '#ffffff' : '#38bdf8' },
                      ]}
                    >
                      {isSpeaking
                        ? '🎙️ YOU ARE ON AIR'
                        : currentSpeaker
                        ? currentSpeaker.name
                        : 'Floor Open (Ready)'}
                    </Text>
                  </View>
                </View>

                {queue.length > 0 && (
                  <View style={styles.queueRow}>
                    <Text style={styles.queueLabel}>Line ({queue.length} in queue):</Text>
                    <Text style={styles.queueValue} numberOfLines={2}>
                      {queue.map((q, idx) => `${idx + 1}. ${q.name}`).join('   |   ')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Main Hold or Tap To Talk Button */}
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

              {/* Real-time speech VU meter */}
              <AudioLevelMeter level={audioLevel} active={isSpeaking} gainBoost={micGain} />

              {/* Mic Gain Switcher during call */}
              <View style={styles.inCallGainRow}>
                <Text style={styles.inCallGainLabel}>Gain:</Text>
                {[1.0, 1.25, 1.5].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.inCallGainPill, micGain === g && styles.inCallGainPillActive]}
                    onPress={() => setMicGain(g)}
                  >
                    <Text style={[styles.inCallGainText, micGain === g && styles.inCallGainTextActive]}>
                      {g === 1.0 ? '1.0x' : g === 1.25 ? '1.25x' : '1.5x'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Acoustic Guidance Toggle */}
              <TouchableOpacity
                style={styles.acousticTipsPill}
                onPress={() => setShowAcousticTips(!showAcousticTips)}
              >
                <Text style={styles.acousticTipsPillText}>
                  {showAcousticTips ? '▲ Hide Speaking Guide' : '💡 Proximity & Feedback Advice'}
                </Text>
              </TouchableOpacity>

              {showAcousticTips && (
                <View style={styles.acousticTipsBox}>
                  <Text style={styles.acousticTipItem}>
                    • <strong>Near-Field (5–10 cm):</strong> Hold phone like a mic near your mouth to maximize vocal signal.
                  </Text>
                  <Text style={styles.acousticTipItem}>
                    • <strong>Single Speaker:</strong> The room system only unmutes one phone at a time to prevent screeching feedback.
                  </Text>
                  <Text style={styles.acousticTipItem}>
                    • <strong>Auto Mute:</strong> Releasing the button or tapping mute immediately kills your audio stream.
                  </Text>
                </View>
              )}

              {/* Safe disconnect button with prompt */}
              <TouchableOpacity style={styles.disconnectButton} onPress={handleConfirmDisconnect}>
                <Text style={styles.disconnectButtonText}>LEAVE MEETING ROOM</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              Ultra-low latency budget (&lt;300ms) enforced via hardware VoiceProcessingIO,
              mono Opus 48kHz, and zero downlink audio.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070B12',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: 20,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 1.5,
  },
  appSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  latencyBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  latencyBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#f8fafc',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    gap: 14,
  },
  scanButtonIcon: {
    fontSize: 28,
  },
  scanButtonTextColumn: {
    flex: 1,
  },
  scanButtonTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 1,
  },
  scanButtonSub: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1e293b',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginHorizontal: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.2,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionLink: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '700',
  },
  actionSep: {
    color: '#475569',
    fontSize: 10,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  recentRoomsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  recentLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  recentChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  recentChipActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  recentChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  recentChipTextActive: {
    color: '#38bdf8',
  },
  sensitivityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  sensitivityLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  gainButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  gainPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  gainPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#38bdf8',
  },
  gainPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  gainPillTextActive: {
    color: '#ffffff',
  },
  preflightToggle: {
    alignSelf: 'center',
    marginVertical: 10,
  },
  preflightToggleText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  preflightBox: {
    backgroundColor: '#070B12',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  preflightTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  preflightDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  advancedConfig: {
    marginTop: 6,
  },
  toggleConfigButton: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  toggleConfigText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  coldStartCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  coldStartTitle: {
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  coldStartSub: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 15,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  connectButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  connectButtonDisabled: {
    backgroundColor: '#1e3a8a',
    opacity: 0.7,
  },
  connectButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1,
  },
  activeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
  },
  speakerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speakerLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  speakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakerValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  queueRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  queueLabel: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: 0.8,
  },
  queueValue: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  inCallGainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  inCallGainLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
  },
  inCallGainPill: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inCallGainPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  inCallGainText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  inCallGainTextActive: {
    color: '#38bdf8',
  },
  acousticTipsPill: {
    marginVertical: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  acousticTipsPillText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  acousticTipsBox: {
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    width: '100%',
    maxWidth: 320,
  },
  acousticTipItem: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },
  disconnectButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  disconnectButtonText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerNote: {
    color: '#475569',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    maxWidth: 320,
  },
});
