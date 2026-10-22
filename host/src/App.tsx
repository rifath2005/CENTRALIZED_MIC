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
  const [isEmergencyMuted, setIsEmergencyMuted] = useState(false);
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [tempRoomInput, setTempRoomInput] = useState('BOARDROOM-1');
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);

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

  // Authoritative Floor Arbiter with Host Overrides
  const {
    currentSpeaker,
    queue,
    forceRevokeCurrentSpeaker,
    clearQueue,
    grantFloorTo,
    removeFromQueue,
  } = useHostFloorArbiter({ room });

  // User Gesture Autoplay Unlock + Chime confirmation
  const handleUnlockAudio = async () => {
    const success = await audioGraph.unlockAudio();
    if (success) {
      setIsAudioUnlocked(true);
      audioGraph.playTestTone();
      connectHost();
    }
  };

function generateUniqueRoomCode(): string {
  const prefixes = ['BOARD', 'CONF', 'AUDIT', 'ROOM', 'MEET', 'STUDIO'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

  // Reconnect if roomName changes while unlocked
  const handleUpdateRoomCode = async (newCode: string) => {
    const sanitized = newCode.trim().toUpperCase();
    if (!sanitized || sanitized === roomName) return;

    if (isConnected) {
      await disconnectHost();
    }
    setRoomName(sanitized);
  };

  const handleGenerateUniqueRoom = () => {
    const unique = generateUniqueRoomCode();
    handleUpdateRoomCode(unique);
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
    if (isEmergencyMuted) {
      setIsEmergencyMuted(false);
    }
  };

  const handleSetVolumePreset = (presetVol: number) => {
    setVolume(presetVol);
    audioGraph.setMasterVolume(presetVol);
    if (isEmergencyMuted) {
      setIsEmergencyMuted(false);
    }
  };

  const handleToggleEmergencyMute = () => {
    const muted = audioGraph.toggleEmergencyMute();
    setIsEmergencyMuted(muted);
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

  const handlePlayTestTone = () => {
    audioGraph.playTestTone();
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

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomName);
      setCopiedRoomCode(true);
      setTimeout(() => setCopiedRoomCode(false), 2000);
    } catch (err) {
      console.warn('[App] Clipboard error:', err);
    }
  };

  const handleSaveRoomCode = () => {
    handleUpdateRoomCode(tempRoomInput);
    setIsEditingRoom(false);
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
          <header className="responsive-header" style={styles.topHeader}>
            <div style={styles.headerLeft}>
              <div style={styles.titleRow}>
                <h1 style={styles.appTitle}>CENTRALIZED MIC RECEIVER</h1>
                <span style={styles.latencyPill}>LATENCY &lt; 300MS</span>
              </div>

              {/* Room Code Editor / Switcher directly in console header */}
              <div style={styles.roomSwitcherRow}>
                <span style={styles.roomCodeLabel}>ACTIVE ROOM:</span>
                {isEditingRoom ? (
                  <div style={styles.roomEditInline}>
                    <input
                      type="text"
                      value={tempRoomInput}
                      onChange={(e) => setTempRoomInput(e.target.value.toUpperCase())}
                      style={styles.roomInput}
                      autoFocus
                    />
                    <button style={styles.roomSaveBtn} onClick={handleSaveRoomCode}>
                      Save
                    </button>
                    <button style={styles.roomCancelBtn} onClick={() => setIsEditingRoom(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={styles.roomCodeDisplay}>
                    <span style={styles.roomCodeBadge}>{roomName}</span>
                    <button
                      style={styles.roomEditBtn}
                      onClick={() => {
                        setTempRoomInput(roomName);
                        setIsEditingRoom(true);
                      }}
                      title="Switch meeting room"
                    >
                      ✏️ Switch
                    </button>
                    <button
                      style={styles.roomCopyBtn}
                      onClick={handleCopyCode}
                      title="Copy code to clipboard"
                    >
                      {copiedRoomCode ? '✓ Copied' : '📋 Copy'}
                    </button>
                    <button
                      style={styles.roomRandomBtn}
                      onClick={handleGenerateUniqueRoom}
                      title="Generate unique room code to avoid collisions online"
                    >
                      🎲 Unique Room
                    </button>
                  </div>
                )}
              </div>
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
                🎛️ Audio Console
              </button>
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                }}
                onClick={() => setActiveView('projector')}
              >
                📺 Projector Mode
              </button>
            </div>

            {/* Right: Attendance counter & Connection Status */}
            <div className="responsive-header-right" style={styles.headerRight}>
              {/* Audio Pipeline status indicator */}
              <div
                style={{
                  ...styles.pipelineBadge,
                  borderColor: isAudioUnlocked ? '#059669' : '#f59e0b',
                  color: isAudioUnlocked ? '#34d399' : '#f59e0b',
                }}
                title={isAudioUnlocked ? 'Web Audio DSP 48kHz active' : 'Click start session to unlock'}
              >
                <span
                  style={{
                    ...styles.pipelineDot,
                    backgroundColor: isAudioUnlocked ? '#34d399' : '#f59e0b',
                  }}
                />
                <span>{isAudioUnlocked ? 'PA Engine Active (48kHz)' : 'Audio Locked'}</span>
              </div>

              {/* Attendance counter pill */}
              <div style={styles.attendanceBadge} title="Active attendee smartphones in this room">
                <span className="pulse-live" style={styles.attendanceDot} />
                <span>{memberCount} {memberCount === 1 ? 'Attendee' : 'Attendees'}</span>
              </div>

              {/* LiveKit SFU Connection Status */}
              <div style={styles.connectionStatus}>
                <span
                  style={{
                    ...styles.statusDot,
                    backgroundColor: isConnected ? '#10b981' : isConnecting ? '#f59e0b' : '#64748b',
                  }}
                />
                <span style={styles.statusText}>
                  {isConnected
                    ? `SFU CONNECTED`
                    : isConnecting
                    ? 'CONNECTING TO SFU...'
                    : 'OFFLINE'}
                </span>
              </div>

              <button style={styles.fsHeaderBtn} onClick={toggleBrowserFullscreen} title="Toggle Fullscreen">
                ⤡ Fullscreen
              </button>

              {isConnected ? (
                <button style={styles.disconnectBtn} onClick={disconnectHost}>
                  LEAVE ROOM
                </button>
              ) : (
                <button style={styles.connectBtn} onClick={connectHost} disabled={isConnecting}>
                  {isConnecting ? 'CONNECTING...' : 'CONNECT RECEIVER'}
                </button>
              )}
            </div>
          </header>

          {/* Render cold-start helper notice if connecting */}
          {isConnecting && (
            <div style={styles.connectingBanner}>
              <span>⏳ Establishing WebRTC bridge to LiveKit server... (Note: Free-tier server cold start may take ~30s if waking up)</span>
            </div>
          )}

          {error && <div style={styles.errorAlert}>{error}</div>}

          {/* Main Grid */}
          <main className="responsive-main-grid" style={styles.mainGrid}>
            {/* Left Column: QR Code, Device Routing, Limiter & Master Controls */}
            <section style={styles.leftColumn}>
              {/* Pairing QR Code with quick launch to Projector mode */}
              <div style={styles.qrCardWrapper}>
                <RoomQRCode roomCode={roomName} tokenServerUrl={tokenServerUrl} />
                <button
                  style={styles.openProjectorPill}
                  onClick={() => setActiveView('projector')}
                >
                  📺 Open Full Screen Projector View for Meeting Room Wall Display →
                </button>
              </div>

              {/* Soundcard Routing & Level Meter */}
              <div style={styles.card}>
                <div style={styles.cardHeaderRow}>
                  <h3 style={styles.cardHeader}>AUDIO HARDWARE &amp; METERING</h3>
                  <span style={styles.lowLatencyTag}>Sub-5ms Processing</span>
                </div>
                <div style={styles.hardwareControls}>
                  <DeviceSelector
                    onSelectDevice={handleDeviceSelect}
                    onPlayTestTone={handlePlayTestTone}
                  />
                  <LevelMeter audioGraph={audioGraph} />
                </div>
              </div>

              {/* Feedback & Dynamics DSP Controls */}
              <div style={styles.card}>
                <div style={styles.cardHeaderRow}>
                  <h3 style={styles.cardHeader}>FEEDBACK PREVENTION &amp; DYNAMICS</h3>
                  {/* Emergency Master Cut Toggle */}
                  <button
                    style={{
                      ...styles.emergencyCutBtn,
                      backgroundColor: isEmergencyMuted ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
                      color: isEmergencyMuted ? '#ffffff' : '#f87171',
                    }}
                    onClick={handleToggleEmergencyMute}
                    title="Instantly cut all sound to room speakers"
                  >
                    {isEmergencyMuted ? '🚨 PA MUTED (CLICK TO UNMUTE)' : '🔇 EMERGENCY PA MUTE'}
                  </button>
                </div>

                {/* Master Gain Slider */}
                <div style={styles.sliderGroup}>
                  <div style={styles.sliderLabelRow}>
                    <span style={styles.sliderLabel}>MASTER PA VOLUME</span>
                    <div style={styles.volumePresetRow}>
                      <button
                        style={styles.presetPill}
                        onClick={() => handleSetVolumePreset(0.5)}
                      >
                        50%
                      </button>
                      <button
                        style={styles.presetPill}
                        onClick={() => handleSetVolumePreset(0.75)}
                      >
                        75% (Nominal)
                      </button>
                      <button
                        style={styles.presetPill}
                        onClick={() => handleSetVolumePreset(HARD_VOLUME_CEILING)}
                      >
                        90% (Max)
                      </button>
                    </div>
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
                    Fast 3ms attack clamps acoustic bursts and vocal spikes before room speakers distort.
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
                onGrantFloor={grantFloorTo}
                onRemoveFromQueue={removeFromQueue}
              />

              {/* Real-time Boardroom Attendance Roster */}
              <BoardroomRoster
                members={members}
                currentSpeaker={currentSpeaker}
                queue={queue}
                onGrantFloor={grantFloorTo}
              />

              {/* Operator Acoustic Guidance */}
              <div style={styles.guidanceCard}>
                <h4 style={styles.guidanceTitle}>Acoustic Feedback Operator Protocol</h4>
                <ul style={styles.guidanceList}>
                  <li>
                    <strong>Near-field rule:</strong> Instruct speakers to hold their smartphone within 5–10 cm of their mouth. Never speak from chest level.
                  </li>
                  <li>
                    <strong>Speaker placement:</strong> Venue PA speakers must be positioned in front of attendees, angled away from microphones.
                  </li>
                  <li>
                    <strong>Strict single-speaker:</strong> The floor arbiter enforces a single open mic at any millisecond, completely preventing comb filtering and room feedback summing.
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
    gap: '6px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  appTitle: {
    fontSize: '20px',
    fontWeight: 900,
    letterSpacing: '2px',
    color: '#38bdf8',
    margin: 0,
  },
  latencyPill: {
    fontSize: '10px',
    fontWeight: 800,
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid #059669',
    letterSpacing: '0.8px',
  },
  roomSwitcherRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '2px',
  },
  roomCodeLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: 700,
  },
  roomCodeDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  roomCodeBadge: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#ffffff',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    padding: '2px 8px',
    borderRadius: '6px',
    fontFamily: 'monospace',
  },
  roomEditBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#38bdf8',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '2px 4px',
  },
  roomCopyBtn: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#cbd5e1',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  roomRandomBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid #0284c7',
    color: '#38bdf8',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: '4px',
    transition: 'all 0.15s ease',
  },
  roomEditInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  roomInput: {
    backgroundColor: '#1e293b',
    border: '1px solid #38bdf8',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    outline: 'none',
    width: '120px',
  },
  roomSaveBtn: {
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  roomCancelBtn: {
    backgroundColor: '#334155',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
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
    gap: '10px',
    flexWrap: 'wrap',
  },
  pipelineBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    border: '1px solid #059669',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 700,
  },
  pipelineDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  attendanceBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    border: '1px solid #0284c7',
    padding: '6px 12px',
    borderRadius: '8px',
    color: '#38bdf8',
    fontSize: '11px',
    fontWeight: 700,
  },
  attendanceDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#38bdf8',
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#111827',
    border: '1px solid #1e293b',
    padding: '6px 12px',
    borderRadius: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  statusText: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#cbd5e1',
    letterSpacing: '0.8px',
  },
  fsHeaderBtn: {
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  connectBtn: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
  },
  disconnectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#f87171',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
  },
  connectingBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid #f59e0b',
    color: '#fcd34d',
    padding: '10px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '12px',
    fontWeight: 600,
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
    padding: '10px 14px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s',
  },
  card: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '14px',
    padding: '20px',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  cardHeader: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#94a3b8',
    letterSpacing: '1px',
    margin: 0,
  },
  lowLatencyTag: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  emergencyCutBtn: {
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
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
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: 700,
  },
  sliderLabel: {
    color: '#cbd5e1',
  },
  volumePresetRow: {
    display: 'flex',
    gap: '4px',
  },
  presetPill: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '4px',
    padding: '2px 6px',
    cursor: 'pointer',
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
    borderRadius: '14px',
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
