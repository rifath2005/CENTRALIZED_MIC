import React, { useState, useMemo, useEffect } from 'react';
import { AudioProcessingGraph, HARD_VOLUME_CEILING } from './audio/AudioProcessingGraph';
import { useHostLiveKit } from './hooks/useHostLiveKit';
import { useHostFloorArbiter } from './hooks/useHostFloorArbiter';
import { AudioUnlockGate } from './components/AudioUnlockGate';
import { FloorQueueDisplay } from './components/FloorQueueDisplay';
import { LevelMeter } from './components/LevelMeter';
import { RoomQRCode } from './components/RoomQRCode';
import { BoardroomRoster } from './components/BoardroomRoster';
import { StageDisplayView } from './components/StageDisplayView';
import { AudioDspConfigView } from './components/AudioDspConfigView';
import { SettingsNetworkView } from './components/SettingsNetworkView';

export type HostViewMode = 'stage' | 'console' | 'dsp' | 'settings';

export default function App() {
  const [tokenServerUrl] = useState('https://centralized-mic-token-server.onrender.com');
  const [roomName, setRoomName] = useState('BOARDROOM-1');
  const [activeView, setActiveView] = useState<HostViewMode>('console');
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [limiterThreshold, setLimiterThreshold] = useState(-18);
  const [isEmergencyMuted, setIsEmergencyMuted] = useState(false);
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [tempRoomInput, setTempRoomInput] = useState('BOARDROOM-1');
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);

  // Singleton Web Audio Processing Graph
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
      release: 0.1,
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

      {/* When Stage Display view is selected, render full-screen safe audience card */}
      {activeView === 'stage' ? (
        <StageDisplayView
          roomCode={roomName}
          tokenServerUrl={tokenServerUrl}
          memberCount={memberCount}
          currentSpeaker={currentSpeaker}
          queue={queue}
          onBackToConsole={() => setActiveView('console')}
        />
      ) : (
        <>
          {/* Main Top Header with Section Navigation */}
          <header className="responsive-header" style={styles.topHeader}>
            <div style={styles.headerLeft}>
              <div style={styles.titleRow}>
                <h1 style={styles.appTitle}>CENTRALIZED MIC RECEIVER</h1>
                <span style={styles.latencyPill}>LATENCY &lt; 300MS</span>
              </div>

              {/* Room Code Editor / Switcher in header */}
              <div style={styles.roomSwitcherRow}>
                <span style={styles.roomCodeLabel}>ROOM:</span>
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
                      🎲 Unique Code
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Middle: 4 Distinct Page Views Navigation */}
            <nav className="responsive-nav-tabs" style={styles.viewModeTabs}>
              {/* 1. Stage Display (Audience / Screen-Share Safe) */}
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: 'transparent',
                  color: '#cbd5e1',
                  borderColor: 'transparent',
                  fontWeight: 700,
                }}
                onClick={() => setActiveView('stage')}
                title="Audience & Screen-Share view. Zero operator knobs, completely safe for projectors."
              >
                <span>📺 Stage Display</span>
                <span
                  style={{
                    ...styles.tabPill,
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                  }}
                >
                  AUDIENCE SAFE
                </span>
              </button>

              {/* 2. Live Floor Console (Home) */}
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: activeView === 'console' ? '#f59e0b' : 'transparent',
                  color: activeView === 'console' ? '#0d0515' : '#cbd5e1',
                  borderColor: activeView === 'console' ? '#fbbf24' : 'transparent',
                  fontWeight: activeView === 'console' ? 900 : 700,
                  boxShadow: activeView === 'console' ? '0 0 16px rgba(245, 158, 11, 0.45)' : 'none',
                }}
                onClick={() => setActiveView('console')}
                title="AV Moderator desk: floor queue, speaker cut, and attendee roster"
              >
                <span>🎛️ Live Console</span>
                <span
                  style={{
                    ...styles.tabPill,
                    backgroundColor: activeView === 'console' ? '#0d0515' : 'rgba(245, 158, 11, 0.15)',
                    color: activeView === 'console' ? '#fbbf24' : '#cbd5e1',
                  }}
                >
                  HOME
                </span>
              </button>

              {/* 3. Audio DSP & Hardware (Configure) */}
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: activeView === 'dsp' ? '#f59e0b' : 'transparent',
                  color: activeView === 'dsp' ? '#0d0515' : '#cbd5e1',
                  borderColor: activeView === 'dsp' ? '#fbbf24' : 'transparent',
                  fontWeight: activeView === 'dsp' ? 900 : 700,
                  boxShadow: activeView === 'dsp' ? '0 0 16px rgba(245, 158, 11, 0.45)' : 'none',
                }}
                onClick={() => setActiveView('dsp')}
                title="Physical soundcard routing, limiter thresholds, and rumble cut"
              >
                <span>🔊 Audio DSP</span>
                <span
                  style={{
                    ...styles.tabPill,
                    backgroundColor: activeView === 'dsp' ? '#0d0515' : 'rgba(203, 213, 225, 0.1)',
                    color: activeView === 'dsp' ? '#fbbf24' : '#94a3b8',
                  }}
                >
                  CONFIGURE
                </span>
              </button>

              {/* 4. Settings & Network (Settings) */}
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: activeView === 'settings' ? '#f59e0b' : 'transparent',
                  color: activeView === 'settings' ? '#0d0515' : '#cbd5e1',
                  borderColor: activeView === 'settings' ? '#fbbf24' : 'transparent',
                  fontWeight: activeView === 'settings' ? 900 : 700,
                  boxShadow: activeView === 'settings' ? '0 0 16px rgba(245, 158, 11, 0.45)' : 'none',
                }}
                onClick={() => setActiveView('settings')}
                title="Room codes, LiveKit cloud endpoints, and latency diagnostics"
              >
                <span>⚙️ Settings</span>
                <span
                  style={{
                    ...styles.tabPill,
                    backgroundColor: activeView === 'settings' ? '#0d0515' : 'rgba(203, 213, 225, 0.1)',
                    color: activeView === 'settings' ? '#fbbf24' : '#94a3b8',
                  }}
                >
                  NETWORK
                </span>
              </button>
            </nav>

            {/* Right: Attendance counter & Connection Status */}
            <div className="responsive-header-right" style={styles.headerRight}>
              {/* Pipeline Status */}
              <div
                style={{
                  ...styles.pipelineBadge,
                  borderColor: isAudioUnlocked ? '#10b981' : '#f59e0b',
                  color: isAudioUnlocked ? '#34d399' : '#fbbf24',
                }}
                title={isAudioUnlocked ? 'Web Audio DSP 48kHz active' : 'Click start session to unlock'}
              >
                <span
                  style={{
                    ...styles.pipelineDot,
                    backgroundColor: isAudioUnlocked ? '#34d399' : '#fbbf24',
                  }}
                />
                <span>{isAudioUnlocked ? 'PA Engine (48kHz)' : 'Audio Locked'}</span>
              </div>

              {/* Attendance counter */}
              <div style={styles.attendanceBadge} title="Active attendee smartphones in this room">
                <span className="pulse-marigold" style={styles.attendanceDot} />
                <span>{memberCount} {memberCount === 1 ? 'Attendee' : 'Attendees'}</span>
              </div>

              {/* SFU Status */}
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
                    ? 'CONNECTING...'
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
                  {isConnecting ? 'CONNECTING...' : 'CONNECT'}
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

          {/* Conditional Sub-View Rendering */}
          {activeView === 'dsp' ? (
            /* CONFIGURE: Audio DSP & Hardware View */
            <AudioDspConfigView
              audioGraph={audioGraph}
              volume={volume}
              limiterThreshold={limiterThreshold}
              isEmergencyMuted={isEmergencyMuted}
              onVolumeChange={handleVolumeChange}
              onSetVolumePreset={handleSetVolumePreset}
              onToggleEmergencyMute={handleToggleEmergencyMute}
              onThresholdChange={handleThresholdChange}
              onSelectDevice={handleDeviceSelect}
              onPlayTestTone={handlePlayTestTone}
            />
          ) : activeView === 'settings' ? (
            /* SETTINGS: Room, Cloud & Network Diagnostics View */
            <SettingsNetworkView
              roomCode={roomName}
              tokenServerUrl={tokenServerUrl}
              isConnected={isConnected}
              isConnecting={isConnecting}
              memberCount={memberCount}
              onUpdateRoomCode={handleUpdateRoomCode}
              onReconnect={connectHost}
            />
          ) : (
            /* HOME: Live Floor Console (AV Operator Desk) */
            <main className="responsive-main-grid" style={styles.mainGrid}>
              {/* Left Column: QR Code, Quick Master PA strip, Acoustic Protocol */}
              <section style={styles.leftColumn}>
                {/* Pairing QR Code Card with quick launch to Stage Display */}
                <div style={styles.qrCardWrapper}>
                  <RoomQRCode roomCode={roomName} tokenServerUrl={tokenServerUrl} />
                  <button
                    style={styles.openProjectorPill}
                    onClick={() => setActiveView('stage')}
                    title="Switch to screen-share safe attendee projection"
                  >
                    📺 Open Stage Display (Screen-Share Safe for Audience) →
                  </button>
                </div>

                {/* Quick PA Control Strip for Operator */}
                <div style={styles.card}>
                  <div style={styles.cardHeaderRow}>
                    <div style={styles.cardTitleGroup}>
                      <span style={styles.cardSubBadge}>FLOOR PA CONTROLS</span>
                      <h3 style={styles.cardHeader}>MASTER VOLUME &amp; EMERGENCY</h3>
                    </div>
                    {/* Emergency Master Cut Button */}
                    <button
                      style={{
                        ...styles.emergencyCutBtn,
                        backgroundColor: isEmergencyMuted ? '#f43f5e' : 'rgba(244, 63, 94, 0.15)',
                        color: isEmergencyMuted ? '#ffffff' : '#fb7185',
                      }}
                      onClick={handleToggleEmergencyMute}
                      title="Instantly cut all audio output"
                    >
                      {isEmergencyMuted ? '🚨 PA MUTED (CLICK TO RESTORE)' : '🔇 EMERGENCY CUT'}
                    </button>
                  </div>

                  {/* Master Volume Slider */}
                  <div style={styles.sliderGroup}>
                    <div style={styles.sliderLabelRow}>
                      <span style={styles.sliderLabel}>PA ROOM GAIN</span>
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
                  </div>

                  {/* Level Meter preview */}
                  <LevelMeter audioGraph={audioGraph} />

                  <div style={styles.quickNavDspRow}>
                    <span style={styles.quickNavText}>Need low-level rumble filter or soundcard routing?</span>
                    <button
                      style={styles.quickNavBtn}
                      onClick={() => setActiveView('dsp')}
                    >
                      Go to Audio DSP Configure →
                    </button>
                  </div>
                </div>

                {/* Operator Acoustic Guidance */}
                <div style={styles.guidanceCard}>
                  <h4 style={styles.guidanceTitle}>Acoustic Feedback Operator Protocol</h4>
                  <ul style={styles.guidanceList}>
                    <li>
                      <strong>Near-field rule:</strong> Instruct speakers to hold smartphone 5–10 cm from mouth. Never speak from chest level.
                    </li>
                    <li>
                      <strong>PA placement:</strong> Venue speakers must be placed in front of attendees and angled away from microphones.
                    </li>
                    <li>
                      <strong>Single-speaker arbiter:</strong> Centralized Mic enforces exactly one open microphone at any instant, preventing comb filtering.
                    </li>
                  </ul>
                </div>
              </section>

              {/* Right Column: Authoritative Floor Queue & Boardroom Attendance Roster */}
              <section style={styles.rightColumn}>
                {/* Active Speaker Banner & Floor Queue */}
                <FloorQueueDisplay
                  currentSpeaker={currentSpeaker}
                  queue={queue}
                  onForceRevoke={forceRevokeCurrentSpeaker}
                  onClearQueue={clearQueue}
                  onGrantFloor={grantFloorTo}
                  onRemoveFromQueue={removeFromQueue}
                />

                {/* Real-time Connected Smartphone Attendees Roster */}
                <BoardroomRoster
                  members={members}
                  currentSpeaker={currentSpeaker}
                  queue={queue}
                  onGrantFloor={grantFloorTo}
                />
              </section>
            </main>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    minHeight: '100vh',
    backgroundColor: '#0d0515',
    color: '#f8fafc',
    padding: '24px 32px',
    boxSizing: 'border-box',
  },
  topHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#160a22',
    border: '1px solid #441e6a',
    borderRadius: '16px',
    marginBottom: '24px',
    gap: '16px',
    flexWrap: 'wrap',
    boxShadow: '0 8px 30px rgba(13, 5, 21, 0.45)',
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
    color: '#fbbf24',
    margin: 0,
    textShadow: '0 0 16px rgba(251, 191, 36, 0.3)',
  },
  latencyPill: {
    fontSize: '10px',
    fontWeight: 800,
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    padding: '3px 8px',
    borderRadius: '10px',
    border: '1px solid #f59e0b',
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
    color: '#cbd5e1',
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
    color: '#fbbf24',
    backgroundColor: '#200f33',
    border: '1px solid #5d2a90',
    padding: '3px 10px',
    borderRadius: '6px',
    fontFamily: 'monospace',
  },
  roomEditBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#cbd5e1',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '2px 4px',
  },
  roomCopyBtn: {
    backgroundColor: '#2c1445',
    border: '1px solid #5d2a90',
    color: '#cbd5e1',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  roomRandomBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid #f59e0b',
    color: '#fbbf24',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '3px 8px',
    borderRadius: '4px',
    transition: 'all 0.15s ease',
  },
  roomEditInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  roomInput: {
    backgroundColor: '#160a22',
    border: '1px solid #f59e0b',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    outline: 'none',
    width: '120px',
  },
  roomSaveBtn: {
    backgroundColor: '#f59e0b',
    color: '#0d0515',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  roomCancelBtn: {
    backgroundColor: '#2c1445',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 6px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  viewModeTabs: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#0d0515',
    padding: '4px',
    borderRadius: '12px',
    border: '1px solid #441e6a',
    gap: '4px',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
  },
  tabPill: {
    fontSize: '9px',
    fontWeight: 900,
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.6px',
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
    backgroundColor: '#200f33',
    borderWidth: '1px',
    borderStyle: 'solid',
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
    backgroundColor: '#200f33',
    border: '1px solid #441e6a',
    padding: '6px 12px',
    borderRadius: '8px',
    color: '#fbbf24',
    fontSize: '11px',
    fontWeight: 700,
  },
  attendanceDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#fbbf24',
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#200f33',
    border: '1px solid #441e6a',
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
    backgroundColor: '#200f33',
    color: '#cbd5e1',
    border: '1px solid #441e6a',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  connectBtn: {
    backgroundColor: '#f59e0b',
    color: '#0d0515',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.8px',
    cursor: 'pointer',
    boxShadow: '0 0 12px rgba(245, 158, 11, 0.35)',
  },
  disconnectBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    border: '1px solid #f43f5e',
    color: '#fb7185',
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
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    border: '1px solid #f43f5e',
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
    gap: '10px',
  },
  openProjectorPill: {
    backgroundColor: '#200f33',
    border: '1px solid #f59e0b',
    color: '#fbbf24',
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
    boxShadow: '0 0 12px rgba(245, 158, 11, 0.2)',
  },
  card: {
    backgroundColor: '#200f33',
    border: '1px solid #441e6a',
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 8px 30px rgba(13, 5, 21, 0.45)',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  cardTitleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cardSubBadge: {
    fontSize: '10px',
    fontWeight: 800,
    color: '#cbd5e1',
    letterSpacing: '1px',
  },
  cardHeader: {
    fontSize: '13px',
    fontWeight: 900,
    color: '#f8fafc',
    letterSpacing: '0.8px',
    margin: 0,
  },
  emergencyCutBtn: {
    border: '1px solid #f43f5e',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
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
    backgroundColor: '#160a22',
    border: '1px solid #441e6a',
    color: '#cbd5e1',
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer',
  },
  sliderValue: {
    color: '#fbbf24',
    fontFamily: 'monospace',
    fontWeight: 800,
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
    accentColor: '#f59e0b',
  },
  quickNavDspRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #441e6a',
  },
  quickNavText: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  quickNavBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fbbf24',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  guidanceCard: {
    backgroundColor: '#160a22',
    border: '1px solid #441e6a',
    borderRadius: '14px',
    padding: '20px',
  },
  guidanceTitle: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#fbbf24',
    letterSpacing: '0.8px',
    marginBottom: '12px',
  },
  guidanceList: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: '1.7',
    paddingLeft: '20px',
  },
};
