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

  // Unique participant ID
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
        Alert.alert('Configuration Applied', `Paired to room: ${targetRoom}`);
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

  // One-Tap Paste from Clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getString();
      if (text && text.trim()) {
        handleApplyPayload(text, true);
      } else {
        Alert.alert('Clipboard is Empty', 'Copy a room code or QR configuration first, then tap Paste & Join.');
      }
    } catch {
      Alert.alert('Clipboard Error', 'Could not access clipboard contents.');
    }
  };

  // Launch Native Google Play Services Code Scanner
  const handleScanQRCode = async () => {
    try {
      const scannedCode = await NativeAudio.scanQRCode();
      if (scannedCode) {
        handleApplyPayload(scannedCode, true);
      }
    } catch {
      Alert.alert('Scanner Error', 'Could not open camera scanner. You can enter or paste the code manually.');
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
      <StatusBar barStyle="light-content" backgroundColor="#0d0515" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Top Brand Header */}
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
                  Pair with venue receiver via QR scan, clipboard, or code
                </Text>
              </View>

              {/* Two-Button Quick Connect Grid: Scan & Paste */}
              <View style={styles.quickPairRow}>
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={handleScanQRCode}
                  activeOpacity={0.8}
                >
                  <Text style={styles.scanButtonIcon}>📷</Text>
                  <View style={styles.scanButtonTextColumn}>
                    <Text style={styles.scanButtonTitle}>SCAN QR</Text>
                    <Text style={styles.scanButtonSub}>Point Camera</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pasteButton}
                  onPress={handlePasteFromClipboard}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pasteButtonIcon}>📋</Text>
                  <View style={styles.scanButtonTextColumn}>
                    <Text style={styles.pasteButtonTitle}>PASTE &amp; JOIN</Text>
                    <Text style={styles.pasteButtonSub}>From Clipboard</Text>
                  </View>
                </TouchableOpacity>
              </View>

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
                  <TouchableOpacity onPress={handlePasteFromClipboard}>
                    <Text style={styles.actionLink}>📋 Paste</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={styles.input}
                value={roomInput}
                onChangeText={(text) => handleApplyPayload(text)}
                placeholder="e.g. BOARDROOM-1"
                placeholderTextColor="#7e6b99"
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
                placeholderTextColor="#7e6b99"
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
                  {showPreflightCheck ? '▲ Hide Mic Advice' : '🎙️ Pre-Flight Mic Advice'}
                </Text>
              </TouchableOpacity>

              {showPreflightCheck && (
                <View style={styles.preflightBox}>
                  <Text style={styles.preflightTitle}>Acoustic Near-Field Advice</Text>
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
                    placeholderTextColor="#7e6b99"
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

              {/* Cold-Start Helper */}
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
                        { color: isSpeaking ? '#34d399' : currentSpeaker ? '#ffffff' : '#c084fc' },
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
                    • Near-Field (5–10 cm): Hold phone like a mic near your mouth to maximize vocal signal.
                  </Text>
                  <Text style={styles.acousticTipItem}>
                    • Single Speaker: The room system only unmutes one phone at a time to prevent screeching feedback.
                  </Text>
                  <Text style={styles.acousticTipItem}>
                    • Auto Mute: Releasing the button or tapping mute immediately kills your audio stream.
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
    backgroundColor: '#0d0515',
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
    backgroundColor: '#200f33',
    borderWidth: 1,
    borderColor: '#4d2179',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: 20,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  appSubtitle: {
    fontSize: 11,
    color: '#d8b4fe',
    marginTop: 1,
  },
  latencyBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: '#7e22ce',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  latencyBadgeText: {
    color: '#d8b4fe',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#160a24',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#4d2179',
    shadowColor: '#3b0764',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  quickPairRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  scanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#581c87',
    borderWidth: 1.5,
    borderColor: '#a855f7',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  scanButtonIcon: {
    fontSize: 24,
  },
  scanButtonTextColumn: {
    flex: 1,
  },
  scanButtonTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  scanButtonSub: {
    fontSize: 10,
    color: '#e2d9f3',
    marginTop: 2,
  },
  pasteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#241038',
    borderWidth: 1.5,
    borderColor: '#7e22ce',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  pasteButtonIcon: {
    fontSize: 24,
  },
  pasteButtonTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  pasteButtonSub: {
    fontSize: 10,
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
    backgroundColor: '#3b165b',
  },
  dividerText: {
    color: '#a79bbd',
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
    color: '#e2d9f3',
    letterSpacing: 1.2,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionLink: {
    fontSize: 11,
    color: '#c084fc',
    fontWeight: '700',
  },
  actionSep: {
    color: '#6b2fa8',
    fontSize: 10,
  },
  input: {
    backgroundColor: '#200f33',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#5b268f',
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
    color: '#a79bbd',
    fontWeight: '700',
  },
  recentChip: {
    backgroundColor: '#200f33',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4d2179',
  },
  recentChipActive: {
    borderColor: '#c084fc',
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
  },
  recentChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  recentChipTextActive: {
    color: '#ffffff',
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
    color: '#e2d9f3',
    letterSpacing: 1,
  },
  gainButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  gainPill: {
    backgroundColor: '#200f33',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4d2179',
  },
  gainPillActive: {
    backgroundColor: '#7e22ce',
    borderColor: '#c084fc',
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
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '700',
  },
  preflightBox: {
    backgroundColor: '#0d0515',
    borderWidth: 1,
    borderColor: '#4d2179',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  preflightTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  preflightDesc: {
    fontSize: 11,
    color: '#cbd5e1',
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
    color: '#a79bbd',
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
    color: '#fbbf24',
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
    color: '#fb7185',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  connectButton: {
    backgroundColor: '#7e22ce',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  connectButtonDisabled: {
    backgroundColor: '#3b165b',
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
    backgroundColor: '#160a24',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4d2179',
    marginBottom: 10,
  },
  speakerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speakerLabel: {
    color: '#d8b4fe',
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
    borderTopColor: '#3b165b',
  },
  queueLabel: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: 0.8,
  },
  queueValue: {
    color: '#ffffff',
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
    color: '#e2d9f3',
    fontWeight: '700',
  },
  inCallGainPill: {
    backgroundColor: '#200f33',
    borderWidth: 1,
    borderColor: '#4d2179',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inCallGainPillActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderColor: '#a855f7',
  },
  inCallGainText: {
    fontSize: 10,
    color: '#a79bbd',
    fontWeight: '700',
  },
  inCallGainTextActive: {
    color: '#ffffff',
  },
  acousticTipsPill: {
    marginVertical: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  acousticTipsPillText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '700',
  },
  acousticTipsBox: {
    backgroundColor: '#160a24',
    borderWidth: 1,
    borderColor: '#4d2179',
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
    borderColor: '#f43f5e',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  disconnectButtonText: {
    color: '#fb7185',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerNote: {
    color: '#7e6b99',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    maxWidth: 320,
  },
});
