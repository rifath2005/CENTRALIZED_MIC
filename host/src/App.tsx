import React, { useState, useMemo, useEffect } from 'react';
import { AudioProcessingGraph, HARD_VOLUME_CEILING } from './audio/AudioProcessingGraph';
import { useHostLiveKit } from './hooks/useHostLiveKit';
import { useHostFloorArbiter } from './hooks/useHostFloorArbiter';
import { AudioUnlockGate } from './components/AudioUnlockGate';
import { DeviceSelector } from './components/DeviceSelector';
import { FloorQueueDisplay } from './components/FloorQueueDisplay';
import { LevelMeter } from './components/LevelMeter';
import { RoomQRCode } from './components/RoomQRCode';
import { BoardroomRoster } from './components/BoardroomRoster';
import { ProjectorView } from './components/ProjectorView';

export default function App() {
  const [tokenServerUrl] = useState('https://centralized-mic-token-server.onrender.com');
  const [roomName, setRoomName] = useState('BOARDROOM-1');
  const [activeView, setActiveView] = useState<'console' | 'projector'>('console');
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
    members,
    memberCount,
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
      connectHost();
    }
  };

  // Reconnect if roomName changes while unlocked
  const handleUpdateRoomCode = async (newCode: string) => {
    const sanitized = newCode.trim().toUpperCase();
    if (sanitized === roomName) return;

    if (isConnected) {
      await disconnectHost();
    }
    setRoomName(sanitized);
  };

  useEffect(() => {
    if (isAudioUnlocked && !isConnected && !isConnecting) {
      connectHost();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName]);

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

  const toggleBrowserFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('[App] Fullscreen error:', err);
    }
  };

  return (
    <div style={styles.appContainer}>
      {/* Autoplay Gate Overlay */}
      <AudioUnlockGate isUnlocked={isAudioUnlocked} onUnlock={handleUnlockAudio} />

      {/* Render Projector View if selected */}
      {activeView === 'projector' ? (
        <ProjectorView
          roomCode={roomName}
          tokenServerUrl={tokenServerUrl}
          memberCount={memberCount}
          currentSpeaker={currentSpeaker}
          onUpdateRoomCode={handleUpdateRoomCode}
          onBackToConsole={() => setActiveView('console')}
        />
      ) : (
        /* Render PA Audio Console */
        <>
          {/* Main Top Header */}
          <header style={styles.topHeader}>
            <div style={styles.headerLeft}>
              <h1 style={styles.appTitle}>CENTRALIZED MIC RECEIVER</h1>
              <p style={styles.appSubtitle}>Meeting Room PA System Bridge | Latency Target &lt; 300ms</p>
            </div>

            {/* Middle: View Mode Tabs */}
            <div style={styles.viewModeTabs}>
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                }}
                onClick={() => setActiveView('console')}
              >
                🎛️ PA Audio Console
              </button>
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                }}
                onClick={() => setActiveView('projector')}
              >
                📺 Projector & QR Mode
              </button>
            </div>

            {/* Right: Attendance counter & Connection Status */}
            <div style={styles.headerRight}>
              {/* Member count pill */}
              <div style={styles.attendanceBadge} title="Active attendee smartphones in this room">
                <span style={styles.attendanceDot} />
                <span>{memberCount} {memberCount === 1 ? 'Attendee' : 'Attendees'} in Room</span>
              </div>

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

              <button style={styles.fsHeaderBtn} onClick={toggleBrowserFullscreen} title="Full Screen Window">
                ⤡ Fullscreen
              </button>

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
              {/* Pairing QR Code with quick launch to Projector mode */}
              <div style={styles.qrCardWrapper}>
                <RoomQRCode roomCode={roomName} tokenServerUrl={tokenServerUrl} />
                <button
                  style={styles.openProjectorPill}
                  onClick={() => setActiveView('projector')}
                >
                  📺 Click to Open Full Screen Projector View
                </button>
              </div>

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

            {/* Right Column: Floor Queue & Boardroom Attendance Roster */}
            <section style={styles.rightColumn}>
              {/* Floor Queue Display */}
              <FloorQueueDisplay
                currentSpeaker={currentSpeaker}
                queue={queue}
                onForceRevoke={forceRevokeCurrentSpeaker}
                onClearQueue={clearQueue}
              />

              {/* Real-time Boardroom Attendance Roster */}
              <BoardroomRoster
                members={members}
                currentSpeaker={currentSpeaker}
                queue={queue}
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
        </>
      )}
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
    gap: '16px',
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
  },
  appTitle: {
    fontSize: '20px',
    fontWeight: 900,
    letterSpacing: '2px',
    color: '#38bdf8',
  },
  appSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '2px',
  },
  viewModeTabs: {
    display: 'flex',
    backgroundColor: '#111827',
    padding: '4px',
    borderRadius: '10px',
    border: '1px solid #1f2937',
    gap: '6px',
  },
  tabBtn: {
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  attendanceBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid #0284c7',
    padding: '8px 14px',
    borderRadius: '8px',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: 700,
  },
  attendanceDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#38bdf8',
    boxShadow: '0 0 8px #38bdf8',
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
  fsHeaderBtn: {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
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
    gridTemplateColumns: '1fr 1fr',
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
  qrCardWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  openProjectorPill: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#38bdf8',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s',
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
