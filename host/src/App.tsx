import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AudioProcessingGraph, HARD_VOLUME_CEILING } from './audio/AudioProcessingGraph';
import { useHostLiveKit } from './hooks/useHostLiveKit';
import { useHostFloorArbiter } from './hooks/useHostFloorArbiter';
import { AudioUnlockGate } from './components/AudioUnlockGate';
import { FloorQueueDisplay } from './components/FloorQueueDisplay';
import { LevelMeter } from './components/LevelMeter';
import { RoomQRCode } from './components/RoomQRCode';
import { BoardroomRoster } from './components/BoardroomRoster';
import { DeviceSelector } from './components/DeviceSelector';
import { StageDisplayView } from './components/StageDisplayView';
import { AudioDspConfigView } from './components/AudioDspConfigView';
import { SettingsNetworkView } from './components/SettingsNetworkView';
import { redTheme } from './tokens/redTheme';

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

  // Protected Press: Two-step confirmation for Emergency Mute
  const [emergencyConfirmArmed, setEmergencyConfirmArmed] = useState(false);
  const emergencyTimerRef = useRef<number | null>(null);

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
      setEmergencyConfirmArmed(false);
    }
  };

  const handleSetVolumePreset = (presetVol: number) => {
    setVolume(presetVol);
    audioGraph.setMasterVolume(presetVol);
    if (isEmergencyMuted) {
      setIsEmergencyMuted(false);
      setEmergencyConfirmArmed(false);
    }
  };

  // WEB-OP-05: EmergencyMuteButton Protected Press Handler
  const handleToggleEmergencyMute = () => {
    if (isEmergencyMuted) {
      // Unmuting is a direct single click
      const muted = audioGraph.toggleEmergencyMute();
      setIsEmergencyMuted(muted);
      setEmergencyConfirmArmed(false);
      if (emergencyTimerRef.current) clearTimeout(emergencyTimerRef.current);
      return;
    }

    if (!emergencyConfirmArmed) {
      // Step 1: Arm confirmation with 4-second safety auto-disarm
      setEmergencyConfirmArmed(true);
      if (emergencyTimerRef.current) clearTimeout(emergencyTimerRef.current);
      emergencyTimerRef.current = setTimeout(() => {
        setEmergencyConfirmArmed(false);
      }, 4000);
    } else {
      // Step 2: Confirmed execution of emergency mute
      const muted = audioGraph.toggleEmergencyMute();
      setIsEmergencyMuted(muted);
      setEmergencyConfirmArmed(false);
      if (emergencyTimerRef.current) clearTimeout(emergencyTimerRef.current);
    }
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
      {/* WEB-OP-06: AudioUnlockModal Autoplay Gate Overlay */}
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
          {/* WEB-OP-01: ConsoleHeaderNav with Section Navigation */}
          <header className="responsive-header" style={styles.topHeader} role="banner">
            <div style={styles.headerLeft}>
              <div style={styles.titleRow}>
                <h1 style={styles.appTitle}>AIRMIC HOST CONSOLE</h1>
                <span style={styles.latencyPill}>LATENCY &lt; 300MS</span>
              </div>

              {/* WEB-OP-02: RoomCodeSwitcher in header */}
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
                      aria-label="New Room Code"
                    />
                    <button style={styles.roomSaveBtn} onClick={handleSaveRoomCode} aria-label="Save Room Code">
                      Save
                    </button>
                    <button style={styles.roomCancelBtn} onClick={() => setIsEditingRoom(false)} aria-label="Cancel editing">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={styles.roomCodeDisplay}>
                    <span style={styles.roomCodeBadge} aria-label={`Current Room: ${roomName}`}>{roomName}</span>
                    <button
                      style={styles.roomEditBtn}
                      onClick={() => {
                        setTempRoomInput(roomName);
                        setIsEditingRoom(true);
                      }}
                      title="Switch meeting room"
                      aria-label="Switch room code"
                    >
                      ✏️ Switch
                    </button>
                    <button
                      style={styles.roomCopyBtn}
                      onClick={handleCopyCode}
                      title="Copy code to clipboard"
                      aria-label="Copy room code"
                    >
                      {copiedRoomCode ? '✓ Copied' : '📋 Copy'}
                    </button>
                    <button
                      style={styles.roomRandomBtn}
                      onClick={handleGenerateUniqueRoom}
                      title="Generate unique room code to avoid collisions online"
                      aria-label="Generate unique room code"
                    >
                      🎲 Unique Code
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* WEB-OP-03: ConsoleViewTabs Navigation */}
            <nav className="responsive-nav-tabs" style={styles.viewModeTabs} role="navigation" aria-label="Console Views">
              {/* 1. Stage Display (Audience / Screen-Share Safe) */}
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: 'transparent',
                  color: redTheme.colors.textSecondary,
                  borderColor: 'transparent',
                  fontWeight: 700,
                  boxShadow: 'none',
                }}
                onClick={() => setActiveView('stage')}
                title="Audience & Screen-Share view. Zero operator knobs, completely safe for projectors."
                aria-pressed={false}
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
                  backgroundColor: activeView === 'console' ? redTheme.colors.primary : 'transparent',
                  color: activeView === 'console' ? redTheme.colors.textOnPrimary : redTheme.colors.textSecondary,
                  borderColor: activeView === 'console' ? redTheme.colors.primaryHover : 'transparent',
                  fontWeight: activeView === 'console' ? 900 : 700,
                  boxShadow: activeView === 'console' ? redTheme.shadows.glowPrimary : 'none',
                }}
                onClick={() => setActiveView('console')}
                title="AV Moderator desk: floor queue, speaker cut, and attendee roster"
                aria-pressed={activeView === 'console'}
              >
                <span>🎛️ Live Console</span>
                <span
                  style={{
                    ...styles.tabPill,
                    backgroundColor: activeView === 'console' ? 'rgba(0,0,0,0.2)' : 'rgba(225, 29, 72, 0.2)',
                    color: activeView === 'console' ? '#ffffff' : redTheme.colors.accentBright,
                  }}
                >
                  HOME
                </span>
              </button>

              {/* 3. Audio DSP & Hardware (Configure) */}
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: activeView === 'dsp' ? redTheme.colors.primary : 'transparent',
                  color: activeView === 'dsp' ? redTheme.colors.textOnPrimary : redTheme.colors.textSecondary,
                  borderColor: activeView === 'dsp' ? redTheme.colors.primaryHover : 'transparent',
                  fontWeight: activeView === 'dsp' ? 900 : 700,
                  boxShadow: activeView === 'dsp' ? redTheme.shadows.glowPrimary : 'none',
                }}
                onClick={() => setActiveView('dsp')}
                title="Physical soundcard routing, limiter thresholds, and rumble cut"
                aria-pressed={activeView === 'dsp'}
              >
                <span>🔊 Audio DSP</span>
                <span
                  style={{
                    ...styles.tabPill,
                    backgroundColor: activeView === 'dsp' ? 'rgba(0,0,0,0.2)' : 'rgba(254, 205, 211, 0.15)',
                    color: activeView === 'dsp' ? '#ffffff' : redTheme.colors.textSecondary,
                  }}
                >
                  CONFIGURE
                </span>
              </button>

              {/* 4. Settings & Network (Settings) */}
              <button
                style={{
                  ...styles.tabBtn,
                  backgroundColor: activeView === 'settings' ? redTheme.colors.primary : 'transparent',
                  color: activeView === 'settings' ? redTheme.colors.textOnPrimary : redTheme.colors.textSecondary,
                  borderColor: activeView === 'settings' ? redTheme.colors.primaryHover : 'transparent',
                  fontWeight: activeView === 'settings' ? 900 : 700,
                  boxShadow: activeView === 'settings' ? redTheme.shadows.glowPrimary : 'none',
                }}
                onClick={() => setActiveView('settings')}
                title="Room codes, LiveKit cloud endpoints, and latency diagnostics"
                aria-pressed={activeView === 'settings'}
              >
                <span>⚙️ Settings</span>
                <span
                  style={{
                    ...styles.tabPill,
                    backgroundColor: activeView === 'settings' ? 'rgba(0,0,0,0.2)' : 'rgba(254, 205, 211, 0.15)',
                    color: activeView === 'settings' ? '#ffffff' : redTheme.colors.textSecondary,
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
                  borderColor: isAudioUnlocked ? redTheme.colors.statusOnAir : redTheme.colors.primary,
                  color: isAudioUnlocked ? '#34d399' : redTheme.colors.accentBright,
                }}
                title={isAudioUnlocked ? 'Web Audio DSP 48kHz active' : 'Click start session to unlock'}
              >
                <span
                  style={{
                    ...styles.pipelineDot,
                    backgroundColor: isAudioUnlocked ? '#34d399' : redTheme.colors.primary,
                  }}
                />
                <span>{isAudioUnlocked ? 'PA Engine (48kHz)' : 'Audio Locked'}</span>
              </div>

              {/* Attendance counter */}
              <div style={styles.attendanceBadge} title="Active attendee smartphones in this room">
                <span className="pulse-red" style={styles.attendanceDot} aria-hidden="true" />
                <span>{memberCount} {memberCount === 1 ? 'Attendee' : 'Attendees'}</span>
              </div>

              {/* SFU Status */}
              <div style={styles.connectionStatus}>
                <span
                  style={{
                    ...styles.statusDot,
                    backgroundColor: isConnected ? redTheme.colors.statusOnAir : isConnecting ? redTheme.colors.statusInQueue : '#64748b',
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

              <button style={styles.fsHeaderBtn} onClick={toggleBrowserFullscreen} title="Toggle Fullscreen" aria-label="Toggle Fullscreen">
                ⤡ Fullscreen
              </button>

              {isConnected ? (
                <button style={styles.disconnectBtn} onClick={disconnectHost} aria-label="Leave room">
                  LEAVE ROOM
                </button>
              ) : (
                <button style={styles.connectBtn} onClick={connectHost} disabled={isConnecting} aria-label="Connect to room">
                  {isConnecting ? 'CONNECTING...' : 'CONNECT'}
                </button>
              )}
            </div>
          </header>

          {/* Render cold-start helper notice if connecting */}
          {isConnecting && (
            <div style={styles.connectingBanner} role="status">
              <span>⏳ Establishing WebRTC bridge to LiveKit server... (Note: Free-tier server cold start may take ~30s if waking up)</span>
            </div>
          )}

          {error && <div style={styles.errorAlert} role="alert">{error}</div>}

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
                    aria-label="Open Stage Display for audience projection"
                  >
                    📺 Open Stage Display (Screen-Share Safe for Audience) →
                  </button>
                </div>

                {/* Quick PA Control Strip for Operator */}
                <div style={styles.card} role="region" aria-label="Floor PA Controls">
                  <div style={styles.cardHeaderRow}>
                    <div style={styles.cardTitleGroup}>
                      <span style={styles.cardSubBadge}>FLOOR PA CONTROLS</span>
                      <h3 style={styles.cardHeader}>MASTER VOLUME &amp; EMERGENCY</h3>
                    </div>

                    {/* WEB-OP-05: EmergencyMuteButton (Protected Press Safety Guard) */}
                    <button
                      style={{
                        ...styles.emergencyCutBtn,
                        backgroundColor: isEmergencyMuted
                          ? redTheme.colors.emergency
                          : emergencyConfirmArmed
                          ? '#f59e0b'
                          : redTheme.colors.emergencyBg,
                        color: isEmergencyMuted || emergencyConfirmArmed ? '#ffffff' : redTheme.colors.emergencyText,
                        borderColor: isEmergencyMuted
                          ? redTheme.colors.emergencyBorder
                          : emergencyConfirmArmed
                          ? '#fbbf24'
                          : redTheme.colors.emergencyBorder,
                        boxShadow: isEmergencyMuted
                          ? redTheme.shadows.glowEmergency
                          : emergencyConfirmArmed
                          ? '0 0 16px rgba(245, 158, 11, 0.85)'
                          : 'none',
                      }}
                      className={isEmergencyMuted ? 'pulse-emergency' : ''}
                      onClick={handleToggleEmergencyMute}
                      title={
                        isEmergencyMuted
                          ? 'PA is muted. Click to restore audio output.'
                          : emergencyConfirmArmed
                          ? 'Click again to confirm emergency audio cut!'
                          : 'Emergency Audio Cut (requires two-step confirmation)'
                      }
                      aria-label={
                        isEmergencyMuted
                          ? 'Emergency PA Mute Active. Click to restore audio'
                          : emergencyConfirmArmed
                          ? 'Confirm Emergency Mute Audio Cut'
                          : 'Emergency Audio Cut'
                      }
                      aria-live="assertive"
                    >
                      {isEmergencyMuted
                        ? '🚨 PA MUTED (CLICK TO RESTORE)'
                        : emergencyConfirmArmed
                        ? '⚠️ CLICK AGAIN TO CONFIRM CUT!'
                        : '🔇 EMERGENCY CUT'}
                    </button>
                  </div>

                  {/* WEB-OP-04: MasterVolumeSlider */}
                  <div style={styles.sliderGroup}>
                    <div style={styles.sliderLabelRow}>
                      <span style={styles.sliderLabel}>PA ROOM GAIN</span>
                      <div style={styles.volumePresetRow}>
                        <button
                          style={styles.presetPill}
                          onClick={() => handleSetVolumePreset(0.5)}
                          aria-label="Set volume to 50%"
                        >
                          50%
                        </button>
                        <button
                          style={styles.presetPill}
                          onClick={() => handleSetVolumePreset(0.75)}
                          aria-label="Set volume to 75% nominal"
                        >
                          75% (Nominal)
                        </button>
                        <button
                          style={styles.presetPill}
                          onClick={() => handleSetVolumePreset(HARD_VOLUME_CEILING)}
                          aria-label="Set volume to 90% max"
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
                      aria-label="PA Room Volume Gain"
                      aria-valuenow={Math.round(volume * 100)}
                      aria-valuemin={0}
                      aria-valuemax={Math.round(HARD_VOLUME_CEILING * 100)}
                    />
                  </div>

                  {/* WEB-OP-07: PaLevelMeter */}
                  <LevelMeter audioGraph={audioGraph} />

                  <div style={styles.quickNavDspRow}>
                    <span style={styles.quickNavText}>Need low-level rumble filter or soundcard routing?</span>
                    <button
                      style={styles.quickNavBtn}
                      onClick={() => setActiveView('dsp')}
                      aria-label="Open Audio DSP settings"
                    >
                      Open Audio DSP &rarr;
                    </button>
                  </div>
                </div>

                {/* Physical Audio Interface Selector (WEB-OP-11) */}
                <div style={styles.card}>
                  <DeviceSelector
                    onSelectDevice={handleDeviceSelect}
                    onPlayTestTone={handlePlayTestTone}
                  />
                </div>
              </section>

              {/* Right Column: Authoritative Floor Arbiter & Attendee Roster */}
              <section style={styles.rightColumn}>
                {/* Authoritative Floor Queue & Speaker Controls (WEB-OP-08 & WEB-OP-09) */}
                <FloorQueueDisplay
                  currentSpeaker={currentSpeaker}
                  queue={queue}
                  onForceRevoke={forceRevokeCurrentSpeaker}
                  onClearQueue={clearQueue}
                  onGrantFloor={grantFloorTo}
                  onRemoveFromQueue={removeFromQueue}
                />

                {/* Attendee Roster List */}
                <BoardroomRoster
                  members={members}
                  currentSpeaker={currentSpeaker}
                  queue={queue}
                  onGrantFloor={grantFloorTo}
                />

                {/* Acoustic Operation Guidance Card */}
                <div style={styles.guidanceCard}>
                  <div style={styles.guidanceTitle}>📋 ACOUSTIC OPERATION PROTOCOL</div>
                  <ol style={styles.guidanceList}>
                    <li>Always arm the 80Hz rumble cut if attendees place phones directly on tabletops.</li>
                    <li>The peak limiter engages dynamically at -18dBFS to safeguard venue PA tweeters.</li>
                    <li>If acoustic howling begins, immediately tap <strong>EMERGENCY CUT</strong> to silence stage audio.</li>
                  </ol>
                </div>
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
    backgroundColor: redTheme.colors.bgDeepest,
    color: redTheme.colors.textPrimary,
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    padding: '24px',
    boxSizing: 'border-box',
  },
  topHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '16px',
    padding: '16px 24px',
    marginBottom: '20px',
    boxShadow: redTheme.shadows.card,
    flexWrap: 'wrap',
    gap: '16px',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  appTitle: {
    fontSize: '20px',
    fontWeight: 900,
    letterSpacing: '-0.5px',
    margin: 0,
    color: redTheme.colors.textPrimary,
  },
  latencyPill: {
    fontSize: '10px',
    fontWeight: 800,
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
    color: redTheme.colors.accentBright,
    border: `1px solid ${redTheme.colors.borderStrong}`,
    borderRadius: '6px',
    padding: '2px 8px',
    letterSpacing: '0.8px',
  },
  roomSwitcherRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    fontWeight: 700,
    color: redTheme.colors.textSecondary,
  },
  roomCodeLabel: {
    letterSpacing: '1px',
    color: redTheme.colors.textMuted,
  },
  roomCodeDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  roomCodeBadge: {
    fontFamily: 'monospace',
    fontWeight: 800,
    fontSize: '12px',
    color: redTheme.colors.accentBright,
    backgroundColor: redTheme.colors.bgSurfaceDark,
    padding: '3px 8px',
    borderRadius: '6px',
    border: `1px solid ${redTheme.colors.borderMedium}`,
    letterSpacing: '1px',
  },
  roomEditBtn: {
    background: 'none',
    border: 'none',
    color: redTheme.colors.textSecondary,
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '2px 4px',
  },
  roomCopyBtn: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    color: redTheme.colors.textSecondary,
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  roomRandomBtn: {
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
    border: `1px solid ${redTheme.colors.borderStrong}`,
    color: redTheme.colors.accentBright,
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
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.primary}`,
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
    backgroundColor: redTheme.colors.primary,
    color: redTheme.colors.textOnPrimary,
    border: 'none',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  roomCancelBtn: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    color: redTheme.colors.textSecondary,
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
    backgroundColor: redTheme.colors.bgDeepest,
    padding: '4px',
    borderRadius: '12px',
    border: `1px solid ${redTheme.colors.borderMedium}`,
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
    backgroundColor: redTheme.colors.bgSurfaceCard,
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
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    padding: '6px 12px',
    borderRadius: '8px',
    color: redTheme.colors.accentBright,
    fontSize: '11px',
    fontWeight: 700,
  },
  attendanceDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: redTheme.colors.accentBright,
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderMedium}`,
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
    color: redTheme.colors.textSecondary,
    letterSpacing: '0.8px',
  },
  fsHeaderBtn: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    color: redTheme.colors.textSecondary,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  connectBtn: {
    backgroundColor: redTheme.colors.primary,
    color: redTheme.colors.textOnPrimary,
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '0.8px',
    cursor: 'pointer',
    boxShadow: redTheme.shadows.glowPrimary,
  },
  disconnectBtn: {
    backgroundColor: redTheme.colors.emergencyBg,
    border: `1px solid ${redTheme.colors.emergencyBorder}`,
    color: redTheme.colors.emergencyText,
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
  },
  connectingBanner: {
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
    border: `1px solid ${redTheme.colors.primary}`,
    color: redTheme.colors.accentLight,
    padding: '10px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '12px',
    fontWeight: 600,
  },
  errorAlert: {
    backgroundColor: redTheme.colors.emergencyBg,
    border: `1px solid ${redTheme.colors.emergencyBorder}`,
    color: redTheme.colors.emergencyText,
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
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.primary}`,
    color: redTheme.colors.accentBright,
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
    boxShadow: redTheme.shadows.glowPrimary,
  },
  card: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '14px',
    padding: '20px',
    boxShadow: redTheme.shadows.card,
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
    color: redTheme.colors.textSecondary,
    letterSpacing: '1px',
  },
  cardHeader: {
    fontSize: '13px',
    fontWeight: 900,
    color: redTheme.colors.textPrimary,
    letterSpacing: '0.8px',
    margin: 0,
  },
  emergencyCutBtn: {
    border: '1px solid',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
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
    color: redTheme.colors.textSecondary,
  },
  volumePresetRow: {
    display: 'flex',
    gap: '4px',
  },
  presetPill: {
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    color: redTheme.colors.textSecondary,
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer',
  },
  sliderValue: {
    color: redTheme.colors.accentBright,
    fontFamily: 'monospace',
    fontWeight: 800,
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
    accentColor: redTheme.colors.primary,
  },
  quickNavDspRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: `1px solid ${redTheme.colors.borderSubtle}`,
  },
  quickNavText: {
    fontSize: '11px',
    color: redTheme.colors.textMuted,
  },
  quickNavBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: redTheme.colors.accentBright,
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  guidanceCard: {
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '14px',
    padding: '20px',
  },
  guidanceTitle: {
    fontSize: '12px',
    fontWeight: 800,
    color: redTheme.colors.accentBright,
    letterSpacing: '0.8px',
    marginBottom: '12px',
  },
  guidanceList: {
    fontSize: '12px',
    color: redTheme.colors.textSecondary,
    lineHeight: '1.7',
    paddingLeft: '20px',
  },
};
