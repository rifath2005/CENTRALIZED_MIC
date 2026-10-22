import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { useLiveKitTransmitter } from './src/hooks/useLiveKitTransmitter';
import { useFloorControl } from './src/hooks/useFloorControl';
import { HoldToTalkButton } from './src/components/HoldToTalkButton';
import { AudioLevelMeter } from './src/components/AudioLevelMeter';
import { ConnectionBadge } from './src/components/ConnectionBadge';

// Default configuration pointing to the live Render deployment
const DEFAULT_TOKEN_SERVER_URL = 'https://centralized-mic-token-server.onrender.com';

export default function App() {
  const [tokenServerUrl, setTokenServerUrl] = useState(DEFAULT_TOKEN_SERVER_URL);
  const [roomInput, setRoomInput] = useState('BOARDROOM-1');
  const [nameInput, setNameInput] = useState(`Speaker-${Math.floor(1000 + Math.random() * 9000)}`);
  const [showConfig, setShowConfig] = useState(false);

  // Stable participant ID for reconnection continuity
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
    error,
    connect,
    disconnect,
    unmuteMicrophone,
    muteMicrophone,
  } = useLiveKitTransmitter({
    tokenServerUrl,
    roomName: roomInput.trim().toUpperCase(),
    participantName: nameInput.trim(),
  });

  // Floor Control hook
  const {
    currentSpeaker,
    queue,
    isSpeaking,
    queuePosition,
    holdState,
    requestFloor,
    releaseFloor,
  } = useFloorControl({
    room,
    participantId,
    participantName: nameInput.trim(),
    onFloorGranted: () => {
      // Hardware and WebRTC track unmuted with sub-5ms delay
      unmuteMicrophone();
    },
    onFloorRevoked: () => {
      // Muted immediately on floor loss or release
      muteMicrophone();
    },
  });

  const isConnected = connectionState === 'connected';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appTitle}>CENTRALIZED MIC</Text>
            <Text style={styles.appSubtitle}>Ultra-Low-Latency PA Transmitter</Text>
            <ConnectionBadge state={connectionState} roomName={isConnected ? roomInput.toUpperCase() : undefined} />
          </View>

          {/* Connection Card */}
          {!isConnected ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Join Meeting Room</Text>

              <Text style={styles.inputLabel}>ROOM CODE</Text>
              <TextInput
                style={styles.input}
                value={roomInput}
                onChangeText={(text) => setRoomInput(text.toUpperCase())}
                placeholder="e.g. BOARDROOM-1"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>YOUR NAME</Text>
              <TextInput
                style={styles.input}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="e.g. Alex"
                placeholderTextColor="#64748b"
                autoCorrect={false}
              />

              {showConfig && (
                <>
                  <Text style={styles.inputLabel}>TOKEN SERVER URL</Text>
                  <TextInput
                    style={styles.input}
                    value={tokenServerUrl}
                    onChangeText={setTokenServerUrl}
                    placeholder="http://192.168.1.100:4000"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              <TouchableOpacity
                onPress={() => setShowConfig(!showConfig)}
                style={styles.toggleConfigButton}
              >
                <Text style={styles.toggleConfigText}>
                  {showConfig ? 'Hide Server Settings' : 'Configure Server Endpoint'}
                </Text>
              </TouchableOpacity>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[
                  styles.connectButton,
                  connectionState === 'connecting' && styles.connectButtonDisabled,
                ]}
                disabled={connectionState === 'connecting'}
                onPress={connect}
              >
                <Text style={styles.connectButtonText}>
                  {connectionState === 'connecting' ? 'CONNECTING...' : 'CONNECT TO SOUND SYSTEM'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Active Microphone Controls */
            <View style={styles.activeContainer}>
              {/* Floor Status Card */}
              <View style={styles.statusCard}>
                <View style={styles.speakerRow}>
                  <Text style={styles.speakerLabel}>Current Floor:</Text>
                  <Text style={styles.speakerValue}>
                    {currentSpeaker
                      ? currentSpeaker.id === participantId
                        ? 'YOU (Active)'
                        : currentSpeaker.name
                      : 'Floor Open (Ready)'}
                  </Text>
                </View>

                {queue.length > 0 && (
                  <View style={styles.queueRow}>
                    <Text style={styles.queueLabel}>Queue ({queue.length}):</Text>
                    <Text style={styles.queueValue}>
                      {queue.map((q, idx) => `${idx + 1}. ${q.name}`).join(' | ')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Hold to talk button */}
              <HoldToTalkButton
                holdState={holdState}
                disabled={!isConnected}
                queuePosition={queuePosition}
                currentSpeakerName={currentSpeaker?.name ?? null}
                onPressIn={requestFloor}
                onPressOut={releaseFloor}
              />

              {/* Real-time speech VU meter */}
              <AudioLevelMeter level={audioLevel} active={isSpeaking} />

              {/* End session button */}
              <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
                <Text style={styles.disconnectButtonText}>LEAVE ROOM</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Latency Note */}
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              Ultra-low latency budget (&lt;300ms) enforced via hardware VoiceProcessingIO,
              mono Opus streaming, and zero downlink audio.
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
    backgroundColor: '#090d16',
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
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 18,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  toggleConfigButton: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  toggleConfigText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  connectButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  connectButtonDisabled: {
    backgroundColor: '#1e3a8a',
    opacity: 0.7,
  },
  connectButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  activeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 12,
  },
  speakerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speakerLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  speakerValue: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '800',
  },
  queueRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  queueLabel: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  queueValue: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  disconnectButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  disconnectButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerNote: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 320,
  },
});
