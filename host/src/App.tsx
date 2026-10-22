import React, { useState, useMemo } from 'react';
import { AudioProcessingGraph, HARD_VOLUME_CEILING } from './audio/AudioProcessingGraph';
import { useHostLiveKit } from './hooks/useHostLiveKit';
import { useHostFloorArbiter } from './hooks/useHostFloorArbiter';
import { AudioUnlockGate } from './components/AudioUnlockGate';
import { DeviceSelector } from './components/DeviceSelector';
import { FloorQueueDisplay } from './components/FloorQueueDisplay';
import { LevelMeter } from './components/LevelMeter';
import { RoomQRCode } from './components/RoomQRCode';

export default function App() {
  const [tokenServerUrl] = useState('https://centralized-mic-token-server.onrender.com');
  const [roomName] = useState('BOARDROOM-1');
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [limiterThreshold, setLimiterThreshold] = useState(-18);

  // Singleton Audio Processing Graph
  const audioGraph = useMemo(() => new AudioProcessingGraph(), []);

  // LiveKit Host Receiver hook
  const {
    room,
    isConnected,
    isConnecting,
    error,
    connectHost,
    disconnectHost,
  } = useHostLiveKit({
    tokenServerUrl,
    roomName: roomName.trim().toUpperCase(),
    audioGraph,
  });

  // Authoritative Floor Arbiter
  const {
    currentSpeaker,
    queue,
    forceRevokeCurrentSpeaker,
    clearQueue,
  } = useHostFloorArbiter({ room });

  // Handle User Gesture Autoplay Unlock
  const handleUnlockAudio = async () => {
    const success = await audioGraph.unlockAudio();
    if (success) {
      setIsAudioUnlocked(true);
      // Auto-connect to room once audio is unlocked
      connectHost();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    audioGraph.setMasterVolume(newVol);
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newThresh = parseFloat(e.target.value);
    setLimiterThreshold(newThresh);
    audioGraph.applyLimiterSettings({
      threshold: newThresh,
      knee: 12,
      ratio: 10,
      attack: 0.003,
      release: 0.100,
    });
  };

  const handleDeviceSelect = async (deviceId: string) => {
    await audioGraph.setOutputDevice(deviceId);
  };

  return (
    <div style={styles.appContainer}>
      {/* Autoplay Gate Overlay */}
      <AudioUnlockGate isUnlocked={isAudioUnlocked} onUnlock={handleUnlockAudio} />

      {/* Main Top Header */}
      <header style={styles.topHeader}>
        <div>
          <h1 style={styles.appTitle}>CENTRALIZED MIC RECEIVER</h1>
          <p style={styles.appSubtitle}>Meeting Room PA System Bridge | Latency Target &lt; 300ms</p>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.connectionStatus}>
            <span
              style={{
                ...styles.statusDot,
                backgroundColor: isConnected ? '#10b981' : isConnecting ? '#f59e0b' : '#64748b',
              }}
            />
            <span style={styles.statusText}>
              {isConnected
                ? `SFU CONNECTED (${roomName})`
                : isConnecting
                ? 'CONNECTING TO SFU...'
                : 'OFFLINE'}
            </span>
          </div>

          {isConnected ? (
            <button style={styles.disconnectBtn} onClick={disconnectHost}>
              LEAVE ROOM
            </button>
          ) : (
            <button style={styles.connectBtn} onClick={connectHost} disabled={isConnecting}>
              CONNECT RECEIVER
            </button>
          )}
        </div>
      </header>

      {error && <div style={styles.errorAlert}>{error}</div>}

      {/* Main Grid */}
      <main style={styles.mainGrid}>
        {/* Left Column: QR Code, Device Routing, Limiter & Master Controls */}
        <section style={styles.leftColumn}>
          {/* Pairing QR Code */}
          <RoomQRCode roomCode={roomName} tokenServerUrl={tokenServerUrl} />

          {/* Soundcard Routing & Level Meter */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>AUDIO HARDWARE & METERING</h3>
            <div style={styles.hardwareControls}>
              <DeviceSelector onSelectDevice={handleDeviceSelect} />
              <LevelMeter audioGraph={audioGraph} />
            </div>
          </div>

          {/* Feedback & Dynamics DSP Controls */}
          <div style={styles.card}>
            <h3 style={styles.cardHeader}>FEEDBACK PREVENTION CONTROLS</h3>

            {/* Master Gain Slider */}
            <div style={styles.sliderGroup}>
              <div style={styles.sliderLabelRow}>
                <span style={styles.sliderLabel}>MASTER PA VOLUME</span>
                <span style={styles.sliderValue}>{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max={HARD_VOLUME_CEILING}
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                style={styles.slider}
              />
              <span style={styles.sliderHint}>
                Software ceiling clamped at {Math.round(HARD_VOLUME_CEILING * 100)}% to prevent acoustic loop gain exceeding unity.
              </span>
            </div>

            {/* Peak Limiter Threshold Slider */}
            <div style={styles.sliderGroup}>
              <div style={styles.sliderLabelRow}>
                <span style={styles.sliderLabel}>PEAK LIMITER THRESHOLD</span>
                <span style={styles.sliderValue}>{limiterThreshold} dB</span>
              </div>
              <input
                type="range"
                min="-30"
                max="-6"
                step="1"
                value={limiterThreshold}
                onChange={handleThresholdChange}
                style={styles.slider}
              />
              <span style={styles.sliderHint}>
                Fast 3ms attack clamps acoustic bursts and shouting before room speakers distort.
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Floor Queue & Edge-Case Operator Overview */}
        <section style={styles.rightColumn}>
          <FloorQueueDisplay
            currentSpeaker={currentSpeaker}
            queue={queue}
            onForceRevoke={forceRevokeCurrentSpeaker}
            onClearQueue={clearQueue}
          />

          {/* Operator Acoustic Guidance */}
          <div style={styles.guidanceCard}>
            <h4 style={styles.guidanceTitle}>Acoustic Feedback Operator Protocol</h4>
            <ul style={styles.guidanceList}>
              <li>
                <strong>Near-field rule:</strong> Instruct speakers to hold the phone within 5–10 cm of their mouth. Never speak from waist level.
              </li>
              <li>
                <strong>Speaker placement:</strong> Meeting room PA speakers must be positioned downstage/in front of attendees, angled away from microphones.
              </li>
              <li>
                <strong>Strict single-speaker:</strong> The software floor queue automatically blocks multiple open microphones, eliminating comb filtering and acoustic summing.
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    minHeight: '100vh',
    backgroundColor: '#090d16',
    color: '#f8fafc',
    padding: '24px 32px',
    boxSizing: 'border-box',
  },
  topHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '20px',
    borderBottom: '1px solid #1e293b',
    marginBottom: '24px',
  },
  appTitle: {
    fontSize: '22px',
    fontWeight: 900,
    letterSpacing: '2px',
    color: '#38bdf8',
  },
  appSubtitle: {
    fontSize: '13px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#111827',
    border: '1px solid #1e293b',
    padding: '8px 14px',
    borderRadius: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#cbd5e1',
    letterSpacing: '0.8px',
  },
  connectBtn: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
  },
  disconnectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#f87171',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #ef4444',
    color: '#fca5a5',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '13px',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr',
    gap: '24px',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
  },
  cardHeader: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#94a3b8',
    letterSpacing: '1px',
    marginBottom: '16px',
  },
  hardwareControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sliderGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
  },
  sliderLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    fontWeight: 700,
  },
  sliderLabel: {
    color: '#cbd5e1',
  },
  sliderValue: {
    color: '#38bdf8',
    fontFamily: 'monospace',
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
    accentColor: '#38bdf8',
  },
  sliderHint: {
    fontSize: '11px',
    color: '#64748b',
    lineHeight: '1.4',
  },
  guidanceCard: {
    backgroundColor: '#0c1729',
    border: '1px solid #1e3a8a',
    borderRadius: '12px',
    padding: '20px',
  },
  guidanceTitle: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#60a5fa',
    letterSpacing: '0.8px',
    marginBottom: '12px',
  },
  guidanceList: {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.7',
    paddingLeft: '20px',
  },
};
