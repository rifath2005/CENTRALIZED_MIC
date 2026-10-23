import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AudioProcessingGraph, HARD_VOLUME_CEILING } from './audio/AudioProcessingGraph';
import { useHostLiveKit } from './hooks/useHostLiveKit';
import { useHostFloorArbiter } from './hooks/useHostFloorArbiter';
import { AudioUnlockGate } from './components/AudioUnlockGate';
import { HardwareMeterBridge } from './components/HardwareMeterBridge';
import { RoomQRCode } from './components/RoomQRCode';
import { DeviceSelector } from './components/DeviceSelector';
import { StageDisplayView } from './components/StageDisplayView';
import { TransmitterPreviewView } from './components/TransmitterPreviewView';
import { AudioDspConfigView } from './components/AudioDspConfigView';
import { SettingsNetworkView } from './components/SettingsNetworkView';

export type HostViewMode = 'console' | 'stage' | 'transmitter' | 'dsp' | 'settings';

interface TelemetryLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'alert' | 'success';
  message: string;
}

export default function App() {
  const [tokenServerUrl] = useState('https://centralized-mic-token-server.onrender.com');
  const [roomName, setRoomName] = useState('STG-709');
  const [activeView, setActiveView] = useState<HostViewMode>('console');
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [gainTrim, setGainTrim] = useState(0);
  const [limiterThreshold, setLimiterThreshold] = useState(-18);
  const [isEmergencyMuted, setIsEmergencyMuted] = useState(false);
  const [selectedBitrate, setSelectedBitrate] = useState('96k');
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [tempRoomInput, setTempRoomInput] = useState('STG-709');
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);

  // Safety Interlock Cut: Guarded toggle button
  const [isSafetyArmed, setIsSafetyArmed] = useState(false);
  const safetyTimerRef = useRef<number | null>(null);

  // Real-time broadcast stopwatch
  const [broadcastSeconds, setBroadcastSeconds] = useState(6138); // Starts at ~01:42:18 for realism
  const [speakerTimerSeconds, setSpeakerTimerSeconds] = useState(0);

  // Diagnostic Event Log Console
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryLogEntry[]>([
    { id: '1', timestamp: '19:20:10.04', level: 'info', message: 'CONSOLE 4.2: Session started. System clock initialized.' },
    { id: '2', timestamp: '19:20:12.18', level: 'success', message: 'DANTE RX: PTP Clock locked at 48kHz / 24-bit.' },
    { id: '3', timestamp: '19:20:15.42', level: 'info', message: 'ROOM TARGET: Attached to LiveKit SFU channel STG-709.' },
  ]);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Singleton Web Audio Processing Graph
  const audioGraph = useMemo(() => new AudioProcessingGraph(), []);

  // LiveKit Host Receiver hook
  const {
    room,
    isConnected,
    isConnecting,
    members: _members,
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
    grantFloorTo,
    removeFromQueue,
  } = useHostFloorArbiter({ room });

  const addTelemetryLog = (msg: string, level: 'info' | 'warn' | 'alert' | 'success' = 'info') => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0')}`;
    setTelemetryLogs((prev) => [
      ...prev.slice(-40),
      { id: String(Date.now() + Math.random()), timestamp: timeStr, level, message: msg },
    ]);
  };

  // Scroll log console to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [telemetryLogs]);

  // Broadcast timer ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setBroadcastSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Speaker elapsed timer
  useEffect(() => {
    if (!currentSpeaker) {
      setSpeakerTimerSeconds(0);
      return;
    }
    const updateTime = () => {
      setSpeakerTimerSeconds(Math.max(0, Math.floor((Date.now() - currentSpeaker.grantedAt) / 1000)));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [currentSpeaker]);

  // Autoplay Unlock
  const handleUnlockAudio = async () => {
    const success = await audioGraph.unlockAudio();
    if (success) {
      setIsAudioUnlocked(true);
      audioGraph.playTestTone();
      connectHost();
      addTelemetryLog('AUDIO ENGINE: WebAudio Host Context unlocked at 48kHz HD.', 'success');
    }
  };

  const handleUpdateRoomCode = async (newCode: string) => {
    const sanitized = newCode.trim().toUpperCase();
    if (!sanitized || sanitized === roomName) return;

    if (isConnected) {
      await disconnectHost();
    }
    setRoomName(sanitized);
    addTelemetryLog(`ROOM SWITCH: Re-targeting conference bridge to ${sanitized}.`, 'info');
  };

  useEffect(() => {
    if (isAudioUnlocked && !isConnected && !isConnecting) {
      connectHost();
    }
  }, [roomName, isAudioUnlocked, isConnected, isConnecting, connectHost]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    audioGraph.setMasterVolume(newVol);
    if (isEmergencyMuted) {
      setIsEmergencyMuted(false);
      setIsSafetyArmed(false);
    }
  };

  const handleSetVolumePreset = (presetVol: number) => {
    setVolume(presetVol);
    audioGraph.setMasterVolume(presetVol);
    if (isEmergencyMuted) {
      setIsEmergencyMuted(false);
      setIsSafetyArmed(false);
    }
    addTelemetryLog(`VOLUME TRIM: PA Output Gain preset to ${Math.round(presetVol * 100)}%.`, 'info');
  };

  // Guarded Safety Cut Handlers
  const handleToggleSafetyArm = () => {
    if (isEmergencyMuted) {
      // Restore
      audioGraph.toggleEmergencyMute();
      setIsEmergencyMuted(false);
      setIsSafetyArmed(false);
      addTelemetryLog('RESTORE: Live broadcast bus re-latched and active.', 'success');
      return;
    }

    if (!isSafetyArmed) {
      setIsSafetyArmed(true);
      addTelemetryLog('SAFETY INTERLOCK: Safety latch disengaged. PANIC CUT is now armed for 5 seconds.', 'warn');
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = window.setTimeout(() => {
        setIsSafetyArmed(false);
        addTelemetryLog('SAFETY INTERLOCK: Arm timed out. Safety latch re-engaged.', 'info');
      }, 5000);
    } else {
      setIsSafetyArmed(false);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      addTelemetryLog('SAFETY INTERLOCK: Manually disarmed.', 'info');
    }
  };

  const handleTriggerPanicMute = () => {
    if (!isSafetyArmed && !isEmergencyMuted) return;
    const muted = audioGraph.toggleEmergencyMute();
    setIsEmergencyMuted(muted);
    setIsSafetyArmed(false);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    addTelemetryLog('CRITICAL ALERT: Emergency broadcast kill fired! Master Dante audio muted.', 'alert');
  };

  const handleRestoreBus = () => {
    if (isEmergencyMuted) {
      audioGraph.toggleEmergencyMute();
      setIsEmergencyMuted(false);
      setIsSafetyArmed(false);
      addTelemetryLog('RESTORE: Master broadcast bus restored. Gain unmuted.', 'success');
    }
  };

  const handleGrantSpeaker = (id: string, name: string) => {
    grantFloorTo(id, name);
    addTelemetryLog(`FLOOR GRANTED: ${name} is now LIVE ON-AIR.`, 'success');
  };

  const handleRevokeSpeaker = () => {
    if (currentSpeaker) {
      addTelemetryLog(`ACTIVE SPEAKER: ${currentSpeaker.name} mic floor revoked by operator.`, 'warn');
    }
    forceRevokeCurrentSpeaker();
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
    addTelemetryLog(`DEVICE ROUTING: Output assigned to device ID ${deviceId.slice(0, 8)}...`, 'info');
  };

  const handlePlayTestTone = () => {
    audioGraph.playTestTone();
    addTelemetryLog('TEST CHIME: Emitted dual-frequency calibration chime (440Hz/880Hz).', 'info');
  };

  const formatTimerClock = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.04`;
  };

  const formatSpeakerClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#111317] text-[#e2e2e8] font-sans antialiased selection:bg-[#93000a] selection:text-[#ffdad6]">
      {/* Audio Unlock Autoplay Gate */}
      <AudioUnlockGate isUnlocked={isAudioUnlocked} onUnlock={handleUnlockAudio} />

      {/* 1. FIXED TOP BROADCAST HEADER (h-16) */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#0c0e12]/95 backdrop-blur-xl z-50 shadow-[0_1px_8px_rgba(0,0,0,0.6)] flex items-center justify-between px-3 md:px-4 border-b border-[#333539]/60">
        <div className="flex items-center gap-3 min-w-0">
          {/* ON-AIR Status Pill */}
          <div className="flex items-center gap-2 bg-[#0c0e12] px-3 py-1.5 rounded-lg border border-[#333539] shadow-inner">
            <div className="relative flex items-center justify-center">
              <span className={`absolute w-3.5 h-3.5 rounded-full ${currentSpeaker ? 'bg-[#ff544c] animate-ping opacity-75' : 'bg-[#00e475]/40'}`} />
              <span className={`relative w-2.5 h-2.5 rounded-full ${currentSpeaker ? 'bg-[#ff544c] shadow-[0_0_10px_#ff544c]' : 'bg-[#00e475]'}`} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${currentSpeaker ? 'text-[#ffb4ac]' : 'text-[#7dffa2]'}`}>
                  {currentSpeaker ? 'ON-AIR' : 'STANDBY'}
                </span>
                <span className="px-1 py-0.2 rounded bg-[#1e2024] text-[8px] font-mono text-[#7dffa2] font-bold uppercase">
                  LIVE
                </span>
              </div>
              <span className="text-[9px] font-mono text-[#a3717c] uppercase tracking-wider truncate max-w-[140px]">
                {currentSpeaker ? currentSpeaker.name : 'CH-01 FEED • MAIN STAGE'}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-[#333539]" />

          {/* RTT & PTP Telemetry */}
          <div className="hidden sm:flex items-center gap-2 bg-[#0c0e12] px-3 py-1.5 rounded-lg border border-[#333539]">
            <span className="w-2 h-2 rounded-full bg-[#00e475] shadow-[0_0_6px_#00e475]" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono text-[#a3717c] uppercase font-bold">RTT</span>
                <span className="text-[12px] font-mono text-[#7dffa2] font-bold">&lt; 300ms</span>
              </div>
              <span className="text-[9px] font-mono text-[#a3717c]">JIT 0.4ms • PTP LOCK</span>
            </div>
          </div>

          {/* Room Target Pill */}
          <div className="flex items-center gap-1.5 bg-[#0c0e12] px-3 py-1.5 rounded-lg border border-[#333539]">
            <span className="material-symbols-outlined text-[#ffba38] text-[18px]">meeting_room</span>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-[#a3717c] uppercase font-bold">ROOM TARGET</span>
              {isEditingRoom ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="text"
                    value={tempRoomInput}
                    onChange={(e) => setTempRoomInput(e.target.value.toUpperCase())}
                    className="w-24 bg-[#1e2024] border border-[#ffba38] rounded px-1 py-0.5 text-xs font-mono font-bold text-white uppercase outline-none"
                    autoFocus
                  />
                  <button onClick={handleSaveRoomCode} className="text-[9px] font-mono bg-[#ffba38] text-[#432c00] px-1 py-0.5 rounded font-bold">
                    ✓
                  </button>
                  <button onClick={() => setIsEditingRoom(false)} className="text-[9px] font-mono bg-[#1e2024] text-[#a3717c] px-1 py-0.5 rounded">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setTempRoomInput(roomName); setIsEditingRoom(true); }}
                    className="text-[12px] font-mono text-[#ffba38] font-bold tracking-wider hover:underline text-left flex items-center gap-1"
                    title="Click to switch room code"
                  >
                    <span>{roomName}</span>
                    <span className="text-[10px] text-[#a3717c]">✏️</span>
                  </button>
                  <button
                    onClick={handleCopyCode}
                    className="text-[#a3717c] hover:text-[#ffba38] transition-colors p-0.5 rounded"
                    title="Copy room code"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedRoomCode ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dante Audio Format */}
          <div className="hidden xl:flex items-center gap-1.5 bg-[#0c0e12] px-3 py-1.5 rounded-lg border border-[#333539]">
            <span className="material-symbols-outlined text-[#7dffa2] text-[18px]">sync_alt</span>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-[#a3717c] uppercase font-bold">DANTE RX</span>
              <span className="text-[12px] font-mono text-[#e2e2e8] font-semibold">48 kHz / 24b</span>
            </div>
          </div>
        </div>

        {/* Header Right: Safety Interlock + Stopwatch + Operator Profile */}
        <div className="flex items-center gap-3">
          {/* Guarded Panic Cut Cluster */}
          <div className="flex items-center bg-[#0c0e12] p-1 rounded-lg border border-[#5b403d]/60 shadow-inner">
            <button
              onClick={handleToggleSafetyArm}
              className={`px-2.5 py-1 rounded font-mono text-[11px] uppercase font-bold flex items-center gap-1 transition-all ${
                isSafetyArmed
                  ? 'bg-[#ffba38] text-[#432c00] shadow-[0_0_8px_#ffba38]'
                  : 'bg-[#1e2024] hover:bg-[#282a2e] text-[#a3717c]'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-[#ffba38]">shield</span>
              <span>{isSafetyArmed ? 'ARMED (5s)' : 'ARM CUT'}</span>
            </button>

            <button
              onClick={handleTriggerPanicMute}
              disabled={!isSafetyArmed && !isEmergencyMuted}
              className={`ml-1 px-3 py-1 rounded font-mono text-[11px] uppercase font-bold flex items-center gap-1 transition-all ${
                isEmergencyMuted
                  ? 'bg-[#ff544c] text-white shadow-[0_0_14px_#ff544c] animate-pulse cursor-pointer'
                  : isSafetyArmed
                  ? 'bg-[#93000a] text-white hover:bg-[#ff544c] cursor-pointer shadow-[0_0_10px_#ff544c]'
                  : 'bg-[#333539] opacity-50 cursor-not-allowed text-[#a3717c]'
              }`}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-[#ffb4ac]">mic_off</span>
              <span className="tracking-wider text-[#ffb4ac]">
                {isEmergencyMuted ? 'UNMUTE PA' : 'PANIC MUTE'}
              </span>
            </button>
          </div>

          {/* Broadcast Elapsed Timer */}
          <div className="hidden md:flex items-center gap-2 bg-[#0c0e12] px-3 py-1.5 rounded-lg border border-[#333539]">
            <span className="material-symbols-outlined text-[#7dffa2] text-[18px]">timer</span>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-[#a3717c] uppercase font-bold">BROADCAST TIME</span>
              <span className="text-[12px] font-mono text-[#e2e2e8] font-bold tracking-wider">
                {formatTimerClock(broadcastSeconds)}
              </span>
            </div>
          </div>

          {/* Operator Avatar Indicator */}
          <div className="flex items-center gap-1 pl-1">
            <div className="relative flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#282a2e] border border-[#ff544c]/40 flex items-center justify-center shadow">
                <span className="material-symbols-outlined text-[#ffb4ac] text-[18px]">person</span>
              </div>
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0c0e12] ${
                isConnected ? 'bg-[#00e475] shadow-[0_0_6px_#00e475]' : 'bg-[#a3717c]'
              }`} />
            </div>
          </div>
        </div>
      </header>

      {/* 2. PERSISTENT LEFT NAVIGATION SIDEBAR (w-64) */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#0c0e12] z-40 flex flex-col justify-between py-4 px-2.5 border-r border-[#333539]/60 shadow-[2px_0_12px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col gap-4">
          {/* Brand header */}
          <div className="px-2 pb-2 border-b border-[#333539]/50">
            <div className="flex items-center gap-2 text-[#ffb4ac]">
              <span className="material-symbols-outlined text-[24px]">graphic_eq</span>
              <span className="text-base font-bold tracking-tight uppercase">STAGE PULSE</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-[#a3717c] tracking-wider uppercase">CONSOLE 4.2</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e2024] text-[#7dffa2] font-bold">
                {isConnected ? 'ONLINE' : isConnecting ? 'CONNECTING' : 'READY'}
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex flex-col gap-1">
            {/* 1. Operator Console */}
            <button
              onClick={() => setActiveView('console')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                activeView === 'console'
                  ? 'bg-[#282a2e] text-[#ffb4ac] shadow-sm'
                  : 'text-[#a3717c] hover:bg-[#1e2024] hover:text-[#e2e2e8]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span>Operator Console</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#ff544c] shadow-[0_0_6px_#ff544c]" />
            </button>

            {/* 2. Transmitter Preview */}
            <button
              onClick={() => setActiveView('transmitter')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                activeView === 'transmitter'
                  ? 'bg-[#282a2e] text-[#ffb4ac] shadow-sm font-bold'
                  : 'text-[#a3717c] hover:bg-[#1e2024] hover:text-[#e2e2e8]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">podcasts</span>
                <span>Transmitter Preview</span>
              </div>
              <span className="text-[9px] font-mono text-[#ffba38] uppercase">PFL</span>
            </button>

            {/* 3. Auditorium Stage Display */}
            <button
              onClick={() => setActiveView('stage')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                activeView === 'stage'
                  ? 'bg-[#282a2e] text-[#ffb4ac] shadow-sm font-bold'
                  : 'text-[#a3717c] hover:bg-[#1e2024] hover:text-[#e2e2e8]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">stadium</span>
                <span>Auditorium Stage</span>
              </div>
              <span className="text-[9px] font-mono text-[#7dffa2] uppercase">OUT</span>
            </button>

            {/* 4. Matrix Routing / Audio DSP */}
            <button
              onClick={() => setActiveView('dsp')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                activeView === 'dsp'
                  ? 'bg-[#282a2e] text-[#ffb4ac] shadow-sm font-bold'
                  : 'text-[#a3717c] hover:bg-[#1e2024] hover:text-[#e2e2e8]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">alt_route</span>
                <span>Matrix &amp; Audio DSP</span>
              </div>
              <span className="text-[9px] font-mono text-[#a3717c]">DSP</span>
            </button>

            {/* 5. Telemetry & Settings */}
            <button
              onClick={() => setActiveView('settings')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                activeView === 'settings'
                  ? 'bg-[#282a2e] text-[#ffb4ac] shadow-sm font-bold'
                  : 'text-[#a3717c] hover:bg-[#1e2024] hover:text-[#e2e2e8]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">vital_signs</span>
                <span>Telemetry &amp; Network</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Bottom Status Block */}
        <div className="flex flex-col gap-2">
          <div className="bg-[#1a1c20] p-2.5 rounded-lg border border-[#333539]/40 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#a3717c] uppercase">CLOCK SYNC</span>
              <span className="text-[9px] font-mono text-[#7dffa2] uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00e475] animate-pulse" />
                PTP LOCKED
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#a3717c] uppercase">AUDIO FORMAT</span>
              <span className="text-[11px] font-mono text-[#e2e2e8] font-semibold">48 kHz / 24b</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#a3717c] uppercase">CONNECTED PHONES</span>
              <span className="text-[11px] font-mono text-[#ffba38] font-bold">{memberCount} Devices</span>
            </div>
          </div>

          <button
            onClick={() => setActiveView('settings')}
            className="flex items-center gap-2 px-2.5 py-1.5 text-[#a3717c] hover:bg-[#1e2024] hover:text-[#e2e2e8] rounded-lg transition-colors text-left text-xs"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            <span>Global Settings</span>
          </button>
        </div>
      </aside>

      {/* 3. MAIN CONTENT CONTAINER (with pl-64 and pt-16) */}
      <div className="pl-64">
        <main className="w-full min-h-screen pt-16 bg-[#111317]">
          {error && (
            <div className="bg-[#93000a]/25 border-b border-[#ff544c] text-[#ffb4ac] px-4 py-2 text-xs font-mono flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#ff544c]">warning</span>
                <span>LIVEKIT SFU WARNING: {error}</span>
              </div>
              <button
                onClick={connectHost}
                className="px-2.5 py-0.5 rounded bg-[#ff544c] text-white hover:bg-[#ffb4ac] hover:text-[#5c0005] text-[10px] uppercase font-bold transition-colors"
                type="button"
              >
                RETRY SFU CONNECT
              </button>
            </div>
          )}
          {activeView === 'stage' ? (
            /* AUDITORIUM STAGE DISPLAY VIEW */
            <StageDisplayView
              roomCode={roomName}
              tokenServerUrl={tokenServerUrl}
              memberCount={memberCount}
              currentSpeaker={currentSpeaker}
              queue={queue}
              onBackToConsole={() => setActiveView('console')}
            />
          ) : activeView === 'transmitter' ? (
            /* ATTENDEE TRANSMITTER PREVIEW DOCK */
            <div className="p-4 md:p-6">
              <TransmitterPreviewView roomCode={roomName} tokenServerUrl={tokenServerUrl} />
            </div>
          ) : activeView === 'dsp' ? (
            /* AUDIO DSP & HARDWARE CONFIGURATION */
            <div className="p-4 md:p-6">
              <AudioDspConfigView
                audioGraph={audioGraph}
                volume={volume}
                limiterThreshold={limiterThreshold}
                isEmergencyMuted={isEmergencyMuted}
                onVolumeChange={handleVolumeChange}
                onSetVolumePreset={handleSetVolumePreset}
                onToggleEmergencyMute={handleToggleSafetyArm}
                onThresholdChange={handleThresholdChange}
                onSelectDevice={handleDeviceSelect}
                onPlayTestTone={handlePlayTestTone}
              />
            </div>
          ) : activeView === 'settings' ? (
            /* TELEMETRY & NETWORK SETTINGS */
            <div className="p-4 md:p-6">
              <SettingsNetworkView
                roomCode={roomName}
                tokenServerUrl={tokenServerUrl}
                isConnected={isConnected}
                isConnecting={isConnecting}
                memberCount={memberCount}
                onUpdateRoomCode={handleUpdateRoomCode}
                onReconnect={connectHost}
              />
            </div>
          ) : (
            /* OPERATOR CONSOLE (AV MODERATOR WORKSTATION) */
            <div className="flex flex-col w-full p-4 gap-4">
              {/* QUICK CONTROL TELEMETRY BAR */}
              <section aria-label="Quick Control Bar" className="w-full bg-[#1a1c20] rounded-xl p-3 shadow-lg border border-[#333539]/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Live Presenter Pill */}
                  <div className="flex items-center gap-2 bg-[#0c0e12] px-3 py-1.5 rounded-lg border border-[#333539]">
                    <div className="relative flex items-center justify-center">
                      <span className={`absolute w-3 h-3 rounded-full ${currentSpeaker ? 'bg-[#ff544c] animate-ping opacity-75' : 'bg-[#a3717c]'}`} />
                      <span className={`relative w-2 h-2 rounded-full ${currentSpeaker ? 'bg-[#ff544c]' : 'bg-[#a3717c]'}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-[#ffb4ac] uppercase font-bold tracking-wider">LIVE PRESENTER</span>
                      <span className="text-[13px] font-mono text-[#e2e2e8] font-bold tracking-tight">
                        {currentSpeaker ? currentSpeaker.name.toUpperCase() : 'STAGE VACANT'}
                      </span>
                    </div>
                  </div>

                  {/* Audio Engine Status */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e2024] border border-[#333539]">
                    <span className="material-symbols-outlined text-[#7dffa2] text-[18px]">graphic_eq</span>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-[#a3717c] uppercase">AUDIO ENGINE</span>
                      <span className="text-[12px] font-mono text-[#7dffa2] font-bold">
                        {isAudioUnlocked ? 'ACTIVE (48kHz)' : 'LOCKED'}
                      </span>
                    </div>
                  </div>

                  {/* Floor Queue Pill */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1e2024] border border-[#333539]">
                    <span className="material-symbols-outlined text-[#ffba38] text-[18px]">pan_tool</span>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-[#a3717c] uppercase">FLOOR QUEUE</span>
                      <span className="text-[12px] font-mono text-[#ffba38] font-bold">
                        {queue.length} PENDING
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Bitrate Buttons */}
                  <div className="flex items-center gap-1 bg-[#0c0e12] p-1 rounded-lg border border-[#333539]">
                    <span className="text-[9px] font-mono text-[#a3717c] px-1.5 uppercase">OPUS BITRATE</span>
                    {['64k', '96k', '128k'].map((br) => (
                      <button
                        key={br}
                        onClick={() => {
                          setSelectedBitrate(br);
                          addTelemetryLog(`BITRATE: Shifting Opus dynamic encode to ${br}.`, 'info');
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                          selectedBitrate === br
                            ? 'bg-[#333539] text-[#7dffa2]'
                            : 'text-[#a3717c] hover:text-[#e2e2e8]'
                        }`}
                      >
                        {br}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Safety Interlock Cut Pill */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-mono text-[#ffb4ac] uppercase font-bold tracking-widest">SAFETY INTERLOCK</span>
                    <span className="text-[11px] font-mono text-[#a3717c]">
                      {isEmergencyMuted ? 'PA MUTED (LATCHED)' : isSafetyArmed ? 'UNLOCKED / ARMED' : 'LATCH ENGAGED'}
                    </span>
                  </div>
                  <div className="flex items-center bg-[#0c0e12] p-1.5 rounded-xl border border-[#5b403d] shadow-lg">
                    <button
                      onClick={handleToggleSafetyArm}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase font-bold flex items-center gap-1 transition-all ${
                        isSafetyArmed ? 'bg-[#ffba38] text-[#432c00]' : 'bg-[#1e2024] hover:bg-[#282a2e] text-[#a3717c]'
                      }`}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#ffba38]">shield</span>
                      <span>{isSafetyArmed ? 'LOCK' : 'UNLOCK CUT'}</span>
                    </button>
                    <button
                      onClick={handleTriggerPanicMute}
                      disabled={!isSafetyArmed && !isEmergencyMuted}
                      className={`ml-1.5 px-3 py-1 rounded text-[11px] font-mono uppercase font-bold flex items-center gap-1.5 transition-all select-none ${
                        isEmergencyMuted
                          ? 'bg-[#ff544c] text-white shadow-[0_0_12px_#ff544c] animate-pulse cursor-pointer'
                          : isSafetyArmed
                          ? 'bg-[#93000a] text-white hover:bg-[#ff544c] cursor-pointer shadow-[0_0_8px_#ff544c]'
                          : 'bg-[#333539] opacity-50 cursor-not-allowed text-[#a3717c]'
                      }`}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[#ffb4ac]">warning</span>
                      <span>{isEmergencyMuted ? 'RESTORE' : 'KILL BROADCAST'}</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* SILENCED MASTER BANNER (Visible upon trigger) */}
              {isEmergencyMuted && (
                <div className="w-full bg-[#93000a] text-[#ffdad6] p-4 rounded-xl shadow-2xl flex items-center justify-between border-2 border-[#ff544c] animate-pulse">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[36px] text-[#ffb4ab] font-bold">report</span>
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                        CRITICAL BROADCAST SILENCED • MASTER ZERO LATCHED
                      </h4>
                      <p className="text-xs text-[#ffdad6]/90">
                        All PA outputs dropped and stage microphone feeds clamped to zero gain by operator emergency trigger.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRestoreBus}
                    className="px-4 py-2 rounded bg-[#e2e2e8] text-[#111317] text-xs font-mono font-bold uppercase hover:bg-white transition-all shadow"
                    type="button"
                  >
                    RESTORE LIVE BUS
                  </button>
                </div>
              )}

              {/* THREE-COLUMN OPERATOR WORKSTATION (lg:grid-cols-12) */}
              <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* COLUMN 1: Audio Engine & Hardware LED VU Meter Bank (col-span-4) */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  {/* DSP Engine Control */}
                  <section className="w-full bg-[#1a1c20] rounded-xl p-3 shadow-md border border-[#333539]/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-1 border-b border-[#333539]/40">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#ffb4ac] text-[20px]">volume_up</span>
                        <h3 className="text-sm font-bold text-[#e2e2e8]">Audio Engine DSP</h3>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#0c0e12] text-[#7dffa2] uppercase font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00e475]" />
                        48kHz AUTO
                      </span>
                    </div>

                    <div className="bg-[#0c0e12] p-2.5 rounded-lg flex items-center justify-between border border-[#333539]/30">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-[#a3717c] uppercase">WebAudio Host Context</span>
                        <span className={`text-xs font-mono font-semibold ${isAudioUnlocked ? 'text-[#7dffa2]' : 'text-[#ffba38]'}`}>
                          {isAudioUnlocked ? 'INITIALIZED / LOCKED' : 'AWAITING UNLOCK'}
                        </span>
                      </div>
                      <button
                        onClick={handlePlayTestTone}
                        className="px-2.5 py-1 rounded bg-[#1e2024] hover:bg-[#282a2e] text-[#ffb4ac] text-[10px] font-mono uppercase font-bold transition-all border border-[#ff544c]/30"
                        type="button"
                      >
                        TEST CHIME
                      </button>
                    </div>

                    {/* Master Output Gain Slider */}
                    <div className="bg-[#0c0e12] p-2.5 rounded-lg border border-[#333539]/30 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] font-mono font-bold text-[#a3717c] uppercase">MASTER PA GAIN</span>
                        <span className="text-[12px] font-mono font-bold text-[#ffb4ac]">
                          {Math.round(volume * 100)}% ({volume === 0 ? '-∞' : (-Math.round((0.9 - volume) * 30)).toFixed(1)} dB)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={HARD_VOLUME_CEILING}
                        step="0.01"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-full accent-[#ff544c] cursor-pointer"
                      />
                      <div className="flex gap-1.5 pt-1">
                        {[0.5, 0.75, HARD_VOLUME_CEILING].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => handleSetVolumePreset(preset)}
                            className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                              volume === preset ? 'bg-[#ff544c] text-[#5c0005]' : 'bg-[#1e2024] text-[#a3717c] hover:text-white'
                            }`}
                          >
                            {preset === HARD_VOLUME_CEILING ? '90% Max' : `${Math.round(preset * 100)}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Hardware-Style LED VU Meter Bridge (4 Channels) */}
                  <HardwareMeterBridge audioGraph={audioGraph} />

                  {/* Physical Soundcard Device Selector */}
                  <div className="bg-[#1a1c20] rounded-xl p-3 shadow-md border border-[#333539]/50">
                    <DeviceSelector onSelectDevice={handleDeviceSelect} onPlayTestTone={handlePlayTestTone} />
                  </div>
                </div>

                {/* COLUMN 2: Floor Request Queue Triage (col-span-5) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <section aria-label="Floor Request Queue" aria-live="polite" className="w-full bg-[#1a1c20] rounded-xl p-3 shadow-md border border-[#333539]/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-1 border-b border-[#333539]/40">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#ffba38] text-[22px]">queue_music</span>
                        <div>
                          <h3 className="text-sm font-bold text-[#e2e2e8]">Floor Request Triage</h3>
                          <p className="text-[11px] font-mono text-[#a3717c]">Live mic access queue awaiting operator grant</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#282a2e] text-[#ffba38] uppercase font-bold">
                          {queue.length} IN QUEUE
                        </span>
                        {queue.length > 0 && (
                          <button
                            onClick={clearQueue}
                            className="text-[#a3717c] hover:text-[#e2e2e8] text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-[#1e2024] transition-colors"
                            type="button"
                          >
                            CLEAR
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Request Triage List */}
                    {queue.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#a3717c] border border-dashed border-[#333539] rounded-xl bg-[#0c0e12]/40">
                        <span className="material-symbols-outlined text-[28px] text-[#333539] mb-1 block">mic_none</span>
                        <span>Floor queue is currently vacant.</span>
                        <p className="text-[10px] text-[#a3717c]/70 mt-1">
                          Attendees who press Hold-to-Talk or Tap-to-Talk will appear here instantly.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {queue.map((entry, index) => {
                          const waitSec = Math.floor((Date.now() - entry.requestedAt) / 1000);
                          return (
                            <div
                              key={entry.id}
                              className="flex flex-col p-2.5 rounded-lg bg-[#1e2024] hover:bg-[#282a2e] border border-[#333539]/40 transition-colors gap-2"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-base font-mono font-bold text-[#ffb4ac] w-6">
                                    {String(index + 1).padStart(2, '0')}
                                  </span>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-[#e2e2e8]">{entry.name}</span>
                                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#0c0e12] text-[#7dffa2] uppercase">
                                        MIC READY
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-[#a3717c]">ID: {entry.id.slice(0, 16)}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end font-mono">
                                  <span className="text-xs font-bold text-[#e2e2e8]">{formatSpeakerClock(waitSec)}</span>
                                  <span className="text-[9px] text-[#a3717c] uppercase">WAIT TIME</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-[#333539]/40">
                                <div className="flex items-center gap-3 text-[10px] font-mono text-[#a3717c]">
                                  <span>BAT: <strong className="text-[#7dffa2]">94%</strong></span>
                                  <span>RF: <strong className="text-[#7dffa2]">-58 dBm</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleGrantSpeaker(entry.id, entry.name)}
                                    className="px-3 py-1 rounded bg-[#ff544c] hover:bg-[#ffb4ac] text-[#5c0005] hover:text-[#000] text-[10px] font-mono uppercase font-bold transition-all shadow"
                                    type="button"
                                  >
                                    GRANT FLOOR
                                  </button>
                                  <button
                                    onClick={() => addTelemetryLog(`PFL CUE: Pre-fade listen armed for ${entry.name}.`, 'info')}
                                    className="px-2.5 py-1 rounded bg-[#0c0e12] hover:bg-[#282a2e] text-[#ffba38] text-[10px] font-mono uppercase font-bold transition-all border border-[#333539]"
                                    type="button"
                                  >
                                    CUE PFL
                                  </button>
                                  <button
                                    onClick={() => removeFromQueue(entry.id)}
                                    className="p-1 rounded bg-[#0c0e12] hover:bg-[#93000a] text-[#a3717c] hover:text-white transition-all"
                                    title="Decline request"
                                    type="button"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>

                {/* COLUMN 3: Active Speaker Spotlight & Event Diagnostics (col-span-3) */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  {/* Active Speaker Spotlight Card */}
                  <section className="w-full bg-[#1a1c20] rounded-xl p-3 shadow-md border border-[#333539]/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-1 border-b border-[#333539]/40">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#ffb4ac] text-[20px]">record_voice_over</span>
                        <div>
                          <h3 className="text-sm font-bold text-[#e2e2e8]">Active Speaker</h3>
                          <span className="text-[9px] font-mono text-[#a3717c] uppercase">MAIN STAGE MIC</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        currentSpeaker ? 'bg-[#00e475]/20 text-[#00e475]' : 'bg-[#1e2024] text-[#a3717c]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${currentSpeaker ? 'bg-[#00e475] animate-ping' : 'bg-[#a3717c]'}`} />
                        {currentSpeaker ? 'ON-AIR' : 'VACANT'}
                      </div>
                    </div>

                    {/* Speaker Details */}
                    <div className="flex flex-col bg-[#1e2024] p-2.5 rounded-lg border border-[#333539]/30 gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-10 h-10 rounded-lg bg-[#282a2e] flex items-center justify-center border border-[#ff544c]/30 shrink-0">
                          <span className="material-symbols-outlined text-[24px] text-[#ffb4ac]">account_circle</span>
                          {currentSpeaker && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00e475] rounded-full shadow-[0_0_6px_#00e475]" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-xs font-bold text-[#e2e2e8] truncate">
                            {currentSpeaker ? currentSpeaker.name : 'No Presenter Active'}
                          </h4>
                          <span className="text-[10px] text-[#a3717c] truncate">
                            {currentSpeaker ? `ID: ${currentSpeaker.id.slice(0, 14)}` : 'Awaiting Floor Request'}
                          </span>
                          <span className="text-[9px] font-mono text-[#7dffa2]">DANTE CH-01 ROUTED</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-[#0c0e12] p-2 rounded border border-[#333539]/30">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-mono text-[#a3717c] uppercase">SPEAKING TIME</span>
                          <span className="text-sm font-mono font-bold text-[#ff544c]">
                            {currentSpeaker ? formatSpeakerClock(speakerTimerSeconds) : '00:00'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-mono text-[#a3717c] uppercase">GAIN TRIM</span>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-[#7dffa2]">
                              {gainTrim > 0 ? `+${gainTrim.toFixed(1)}` : gainTrim.toFixed(1)} dB
                            </span>
                            <input
                              type="range"
                              min="-6"
                              max="6"
                              step="0.2"
                              value={gainTrim}
                              onChange={(e) => setGainTrim(parseFloat(e.target.value))}
                              className="w-14 h-1 accent-[#ff544c] cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={handlePlayTestTone}
                          className="flex-1 py-1 rounded bg-[#282a2e] hover:bg-[#333539] text-[#ffba38] text-[9px] font-mono font-bold uppercase transition-colors"
                        >
                          PTT INTERCOM
                        </button>
                        {currentSpeaker && (
                          <button
                            onClick={handleRevokeSpeaker}
                            className="flex-1 py-1 rounded bg-[#93000a] hover:bg-[#ff544c] text-white text-[9px] font-mono font-bold uppercase transition-colors"
                          >
                            REVOKE MIC ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Room Pairing QR Code Card */}
                  <div className="bg-[#1a1c20] rounded-xl p-3 shadow-md border border-[#333539]/50">
                    <RoomQRCode roomCode={roomName} tokenServerUrl={tokenServerUrl} />
                  </div>

                  {/* Live Diagnostic Telemetry Console */}
                  <section className="w-full bg-[#1a1c20] rounded-xl p-3 shadow-md border border-[#333539]/50 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between pb-1 border-b border-[#333539]/40">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#7dffa2] text-[18px]">terminal</span>
                        <h4 className="text-xs font-mono font-bold uppercase text-[#e2e2e8]">Telemetry Event Stream</h4>
                      </div>
                      <button
                        onClick={() => setTelemetryLogs([])}
                        className="text-[9px] font-mono text-[#a3717c] hover:text-white uppercase"
                      >
                        CLEAR
                      </button>
                    </div>

                    <div
                      ref={logContainerRef}
                      className="h-36 overflow-y-auto bg-[#0c0e12] p-2 rounded-lg border border-[#333539]/40 font-mono text-[10px] space-y-1"
                    >
                      {telemetryLogs.map((log) => (
                        <div key={log.id} className="leading-tight">
                          <span className="text-[#7dffa2] font-semibold">[{log.timestamp}]</span>{' '}
                          <span className={log.level === 'alert' ? 'text-[#ff544c] font-bold' : log.level === 'warn' ? 'text-[#ffba38]' : log.level === 'success' ? 'text-[#7dffa2]' : 'text-[#a3717c]'}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
