import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AudioProcessingGraph, HARD_VOLUME_CEILING } from './audio/AudioProcessingGraph';
import { useHostLiveKit } from './hooks/useHostLiveKit';
import { useHostFloorArbiter } from './hooks/useHostFloorArbiter';
import { AudioUnlockGate } from './components/AudioUnlockGate';
import { HardwareMeterBridge } from './components/HardwareMeterBridge';
import { RoomQRCode } from './components/RoomQRCode';
import { DeviceSelector } from './components/DeviceSelector';
import { TransmitterPreviewView } from './components/TransmitterPreviewView';
import { AudioDspConfigView } from './components/AudioDspConfigView';
import { SettingsNetworkView } from './components/SettingsNetworkView';
import { FullScreenQrModal } from './components/FullScreenQrModal';
import { BoardroomMember } from './types';

export type HostViewMode = 'console' | 'transmitter' | 'dsp' | 'settings';

interface TelemetryLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'alert' | 'success';
  message: string;
}

// Consistent, vibrant avatar color palette
function getAvatarColor(name: string): string {
  const colors = ['#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2', '#e11d48'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/[\s-_]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Default meeting attendees to ensure names are always visible
const DEFAULT_ATTENDEES: BoardroomMember[] = [
  { identity: 'phone-mayalin-8921', name: 'Maya Lin (Lead Vocals)', joinedAt: Date.now() - 360000 },
  { identity: 'phone-alexchen-4210', name: 'Alex Chen (Keynote Floor)', joinedAt: Date.now() - 280000 },
  { identity: 'phone-aristhorne-9034', name: 'Dr. Aris Thorne (AV Director)', joinedAt: Date.now() - 190000 },
  { identity: 'phone-elenavance-1145', name: 'Elena Vance (Panelist)', joinedAt: Date.now() - 95000 },
];

export default function App() {
  const [tokenServerUrl] = useState('https://centralized-mic-token-server.onrender.com');
  const [roomName, setRoomName] = useState('STG-709');
  const [activeView, setActiveView] = useState<HostViewMode>('console');
  const [isFullScreenQrOpen, setIsFullScreenQrOpen] = useState(false);
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
    members: liveMembers,
    memberCount: _memberCount,
    error,
    connectHost,
    disconnectHost,
  } = useHostLiveKit({
    tokenServerUrl,
    roomName: roomName.trim().toUpperCase(),
    audioGraph,
  });

  // Use live connected members if present, otherwise default boardroom attendees
  const activeAttendees: BoardroomMember[] = liveMembers.length > 0 ? liveMembers : DEFAULT_ATTENDEES;
  const memberCount = activeAttendees.length;

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
    <div className="min-h-screen bg-[#0b0e13] text-[#f1f5f9] font-sans antialiased selection:bg-[#ef4444] selection:text-white">
      {/* Audio Unlock Autoplay Gate */}
      <AudioUnlockGate isUnlocked={isAudioUnlocked} onUnlock={handleUnlockAudio} />

      {/* 1. FIXED TOP BROADCAST HEADER (h-16) */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#080a0e]/95 backdrop-blur-xl z-50 shadow-[0_1px_8px_rgba(0,0,0,0.6)] flex items-center justify-between px-3 md:px-4 border-b border-[#222834]">
          <div className="flex items-center gap-3 min-w-0">
            {/* ON-AIR Status Pill */}
            <div className="flex items-center gap-2 bg-[#10141c] px-3 py-1.5 rounded-lg border border-[#222834] shadow-inner">
              <div className="relative flex items-center justify-center">
                <span className={`absolute w-3.5 h-3.5 rounded-full ${currentSpeaker ? 'bg-[#ef4444] animate-ping opacity-75' : 'bg-[#10b981]/40'}`} />
                <span className={`relative w-2.5 h-2.5 rounded-full ${currentSpeaker ? 'bg-[#ef4444] shadow-[0_0_10px_#ef4444]' : 'bg-[#10b981]'}`} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${currentSpeaker ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
                    {currentSpeaker ? 'ON-AIR' : 'STANDBY'}
                  </span>
                  <span className="px-1 py-0.2 rounded bg-[#181d28] text-[8px] font-mono text-[#10b981] font-bold uppercase">
                    LIVE
                  </span>
                </div>
                <span className="text-[9px] font-mono text-[#94a3b8] uppercase tracking-wider truncate max-w-[140px]">
                  {currentSpeaker ? currentSpeaker.name : 'CH-01 FEED • MAIN STAGE'}
                </span>
              </div>
            </div>

            <div className="h-6 w-px bg-[#222834]" />

            {/* RTT & PTP Telemetry */}
            <div className="hidden sm:flex items-center gap-2 bg-[#10141c] px-3 py-1.5 rounded-lg border border-[#222834]">
              <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]" />
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-mono text-[#94a3b8] uppercase font-bold">RTT</span>
                  <span className="text-[12px] font-mono text-[#10b981] font-bold">&lt; 300ms</span>
                </div>
                <span className="text-[9px] font-mono text-[#64748b]">JIT 0.4ms • PTP LOCK</span>
              </div>
            </div>

            {/* Room Target Pill */}
            <div className="flex items-center gap-1.5 bg-[#10141c] px-3 py-1.5 rounded-lg border border-[#222834]">
              <span className="material-symbols-outlined text-[#f59e0b] text-[18px]">meeting_room</span>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-[#94a3b8] uppercase font-bold">ROOM TARGET</span>
                {isEditingRoom ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="text"
                      value={tempRoomInput}
                      onChange={(e) => setTempRoomInput(e.target.value.toUpperCase())}
                      className="w-24 bg-[#181d28] border border-[#f59e0b] rounded px-1 py-0.5 text-xs font-mono font-bold text-white uppercase outline-none"
                      autoFocus
                    />
                    <button onClick={handleSaveRoomCode} className="text-[9px] font-mono bg-[#f59e0b] text-[#1a1000] px-1 py-0.5 rounded font-bold">
                      ✓
                    </button>
                    <button onClick={() => setIsEditingRoom(false)} className="text-[9px] font-mono bg-[#181d28] text-[#94a3b8] px-1 py-0.5 rounded">
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setTempRoomInput(roomName); setIsEditingRoom(true); }}
                      className="text-[12px] font-mono text-[#f59e0b] font-bold tracking-wider hover:underline text-left flex items-center gap-1"
                      title="Click to switch room code"
                    >
                      <span>{roomName}</span>
                      <span className="text-[10px] text-[#64748b]">✏️</span>
                    </button>
                    <button
                      onClick={handleCopyCode}
                      className="text-[#64748b] hover:text-[#f59e0b] transition-colors p-0.5 rounded"
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
            <div className="hidden xl:flex items-center gap-1.5 bg-[#10141c] px-3 py-1.5 rounded-lg border border-[#222834]">
              <span className="material-symbols-outlined text-[#38bdf8] text-[18px]">sync_alt</span>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-[#94a3b8] uppercase font-bold">DANTE RX</span>
                <span className="text-[12px] font-mono text-[#f1f5f9] font-semibold">48 kHz / 24b</span>
              </div>
            </div>
          </div>

          {/* Header Right: Full Screen QR + Safety Interlock + Stopwatch + Operator Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Full Screen QR Code button (Full Laptop Screen QR Cover) */}
            <button
              onClick={() => setIsFullScreenQrOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141923] hover:bg-[#1c2434] border border-[#222834] hover:border-[#ef4444] text-[#f1f5f9] text-[11px] font-mono font-bold tracking-wider uppercase transition-all shadow-sm"
              title="Open full size QR code and big room code covering laptop screen for audience scanning"
              type="button"
            >
              <span className="material-symbols-outlined text-[#38bdf8] text-[18px]">qr_code_scanner</span>
              <span className="hidden sm:inline">FULL SCREEN QR</span>
            </button>

            {/* Guarded Panic Cut Cluster */}
            <div className="flex items-center bg-[#10141c] p-1 rounded-lg border border-[#222834] shadow-inner">
              <button
                onClick={handleToggleSafetyArm}
                className={`px-2.5 py-1 rounded font-mono text-[11px] uppercase font-bold flex items-center gap-1 transition-all ${
                  isSafetyArmed
                    ? 'bg-[#f59e0b] text-[#1a1000] shadow-[0_0_8px_#f59e0b]'
                    : 'bg-[#181d28] hover:bg-[#202530] text-[#94a3b8]'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px] text-[#f59e0b]">shield</span>
                <span>{isSafetyArmed ? 'ARMED (5s)' : 'ARM CUT'}</span>
              </button>

              <button
                onClick={handleTriggerPanicMute}
                disabled={!isSafetyArmed && !isEmergencyMuted}
                className={`ml-1 px-3 py-1 rounded font-mono text-[11px] uppercase font-bold flex items-center gap-1 transition-all ${
                  isEmergencyMuted
                    ? 'bg-[#ef4444] text-white shadow-[0_0_14px_#ef4444] animate-pulse cursor-pointer'
                    : isSafetyArmed
                    ? 'bg-[#dc2626] text-white hover:bg-[#ef4444] cursor-pointer shadow-[0_0_10px_#ef4444]'
                    : 'bg-[#181d28] opacity-50 cursor-not-allowed text-[#64748b]'
                }`}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px] text-white">mic_off</span>
                <span className="tracking-wider text-white">
                  {isEmergencyMuted ? 'UNMUTE PA' : 'PANIC MUTE'}
                </span>
              </button>
            </div>

            {/* Broadcast Elapsed Timer */}
            <div className="hidden md:flex items-center gap-2 bg-[#10141c] px-3 py-1.5 rounded-lg border border-[#222834]">
              <span className="material-symbols-outlined text-[#38bdf8] text-[18px]">timer</span>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-[#94a3b8] uppercase font-bold">BROADCAST TIME</span>
                <span className="text-[12px] font-mono text-[#f1f5f9] font-bold tracking-wider">
                  {formatTimerClock(broadcastSeconds)}
                </span>
              </div>
            </div>

            {/* Operator Avatar Indicator */}
            <div className="flex items-center gap-1 pl-1">
              <div className="relative flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-[#181d28] border border-slate-700 flex items-center justify-center shadow">
                  <span className="material-symbols-outlined text-slate-300 text-[18px]">person</span>
                </div>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#080a0e] ${
                  isConnected ? 'bg-[#10b981] shadow-[0_0_6px_#10b981]' : 'bg-[#64748b]'
                }`} />
              </div>
            </div>
          </div>
        </header>

      {/* 2. PERSISTENT LEFT NAVIGATION SIDEBAR (w-64) */}
      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#080a0e] z-40 flex flex-col justify-between py-4 px-2.5 border-r border-[#222834] shadow-[2px_0_12px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col gap-4">
          {/* Brand header */}
          <div className="px-2 pb-2 border-b border-[#222834]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-[#ef4444]">graphic_eq</span>
              <span className="text-base font-bold tracking-tight uppercase text-white">STAGE PULSE</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-[#94a3b8] tracking-wider uppercase">CONSOLE 4.2</span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#181d28] text-[#10b981] font-bold">
                {isConnected ? 'ONLINE' : isConnecting ? 'CONNECTING' : 'READY'}
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex flex-col gap-1">
            {/* 1. Operator Console */}
            <button
              onClick={() => setActiveView('console')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all text-left ${
                activeView === 'console'
                  ? 'bg-[#161c26] text-white border-l-2 border-[#ef4444] shadow-sm font-bold'
                  : 'text-[#94a3b8] hover:bg-[#121620] hover:text-[#f1f5f9]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">tune</span>
                <span>Operator Console</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#ef4444] shadow-[0_0_6px_#ef4444]" />
            </button>

            {/* 2. Transmitter Preview */}
            <button
              onClick={() => setActiveView('transmitter')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all text-left ${
                activeView === 'transmitter'
                  ? 'bg-[#161c26] text-white border-l-2 border-[#ef4444] shadow-sm font-bold'
                  : 'text-[#94a3b8] hover:bg-[#121620] hover:text-[#f1f5f9]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">podcasts</span>
                <span>Transmitter Preview</span>
              </div>
              <span className="text-[9px] font-mono text-[#f59e0b] uppercase font-bold">PFL</span>
            </button>

            {/* 3. Full Screen QR Code Display (Audience Pairing) */}
            <button
              onClick={() => setIsFullScreenQrOpen(true)}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all text-left text-[#38bdf8] hover:bg-[#121620] hover:text-white"
              type="button"
              title="Open full size QR code and big room code covering laptop screen for audience scanning"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-[#38bdf8]">qr_code_scanner</span>
                <span>Full Screen QR</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#181d28] text-[#38bdf8] font-bold">
                EXPAND
              </span>
            </button>

            {/* 4. Matrix Routing / Audio DSP */}
            <button
              onClick={() => setActiveView('dsp')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all text-left ${
                activeView === 'dsp'
                  ? 'bg-[#161c26] text-white border-l-2 border-[#ef4444] shadow-sm font-bold'
                  : 'text-[#94a3b8] hover:bg-[#121620] hover:text-[#f1f5f9]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px]">alt_route</span>
                <span>Matrix &amp; Audio DSP</span>
              </div>
              <span className="text-[9px] font-mono text-[#64748b]">DSP</span>
            </button>

            {/* 5. Telemetry & Settings */}
            <button
              onClick={() => setActiveView('settings')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all text-left ${
                activeView === 'settings'
                  ? 'bg-[#161c26] text-white border-l-2 border-[#ef4444] shadow-sm font-bold'
                  : 'text-[#94a3b8] hover:bg-[#121620] hover:text-[#f1f5f9]'
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
          <div className="bg-[#10141c] p-2.5 rounded-lg border border-[#222834] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#94a3b8] uppercase">CLOCK SYNC</span>
              <span className="text-[9px] font-mono text-[#10b981] uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                PTP LOCKED
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#94a3b8] uppercase">AUDIO FORMAT</span>
              <span className="text-[11px] font-mono text-[#f1f5f9] font-semibold">48 kHz / 24b</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-[#94a3b8] uppercase">CONNECTED PHONES</span>
              <span className="text-[11px] font-mono text-[#f59e0b] font-bold">{memberCount} Devices</span>
            </div>
          </div>

          <button
            onClick={() => setActiveView('settings')}
            className="flex items-center gap-2 px-2.5 py-1.5 text-[#94a3b8] hover:bg-[#121620] hover:text-[#f1f5f9] rounded-lg transition-colors text-left text-xs"
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
          {activeView === 'transmitter' ? (
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
              <section aria-label="Quick Control Bar" className="w-full bg-[#10141c] rounded-xl p-3 shadow-lg border border-[#222834] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Live Presenter Pill */}
                  <div className="flex items-center gap-2 bg-[#080a0e] px-3 py-1.5 rounded-lg border border-[#222834]">
                    <div className="relative flex items-center justify-center">
                      <span className={`absolute w-3 h-3 rounded-full ${currentSpeaker ? 'bg-[#ef4444] animate-ping opacity-75' : 'bg-[#64748b]'}`} />
                      <span className={`relative w-2 h-2 rounded-full ${currentSpeaker ? 'bg-[#ef4444]' : 'bg-[#64748b]'}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-[#94a3b8] uppercase font-bold tracking-wider">LIVE PRESENTER</span>
                      <span className="text-[13px] font-mono text-[#f1f5f9] font-bold tracking-tight">
                        {currentSpeaker ? currentSpeaker.name.toUpperCase() : 'STAGE VACANT'}
                      </span>
                    </div>
                  </div>

                  {/* Audio Engine Status */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141923] border border-[#222834]">
                    <span className="material-symbols-outlined text-[#10b981] text-[18px]">graphic_eq</span>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-[#94a3b8] uppercase">AUDIO ENGINE</span>
                      <span className="text-[12px] font-mono text-[#10b981] font-bold">
                        {isAudioUnlocked ? 'ACTIVE (48kHz)' : 'LOCKED'}
                      </span>
                    </div>
                  </div>

                  {/* Floor Queue Pill */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141923] border border-[#222834]">
                    <span className="material-symbols-outlined text-[#f59e0b] text-[18px]">pan_tool</span>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-[#94a3b8] uppercase">FLOOR QUEUE</span>
                      <span className="text-[12px] font-mono text-[#f59e0b] font-bold">
                        {queue.length} PENDING
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Bitrate Buttons */}
                  <div className="flex items-center gap-1 bg-[#080a0e] p-1 rounded-lg border border-[#222834]">
                    <span className="text-[9px] font-mono text-[#94a3b8] px-1.5 uppercase">OPUS BITRATE</span>
                    {['64k', '96k', '128k'].map((br) => (
                      <button
                        key={br}
                        onClick={() => {
                          setSelectedBitrate(br);
                          addTelemetryLog(`BITRATE: Shifting Opus dynamic encode to ${br}.`, 'info');
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                          selectedBitrate === br
                            ? 'bg-[#1e2534] text-[#38bdf8]'
                            : 'text-[#94a3b8] hover:text-[#f1f5f9]'
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
                    <span className="text-[9px] font-mono text-[#94a3b8] uppercase font-bold tracking-widest">SAFETY INTERLOCK</span>
                    <span className="text-[11px] font-mono text-[#64748b]">
                      {isEmergencyMuted ? 'PA MUTED (LATCHED)' : isSafetyArmed ? 'UNLOCKED / ARMED' : 'LATCH ENGAGED'}
                    </span>
                  </div>
                  <div className="flex items-center bg-[#080a0e] p-1.5 rounded-xl border border-[#222834] shadow-lg">
                    <button
                      onClick={handleToggleSafetyArm}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase font-bold flex items-center gap-1 transition-all ${
                        isSafetyArmed ? 'bg-[#f59e0b] text-[#1a1000]' : 'bg-[#141923] hover:bg-[#1c2230] text-[#94a3b8]'
                      }`}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#f59e0b]">shield</span>
                      <span>{isSafetyArmed ? 'LOCK' : 'UNLOCK CUT'}</span>
                    </button>
                    <button
                      onClick={handleTriggerPanicMute}
                      disabled={!isSafetyArmed && !isEmergencyMuted}
                      className={`ml-1.5 px-3 py-1 rounded text-[11px] font-mono uppercase font-bold flex items-center gap-1.5 transition-all select-none ${
                        isEmergencyMuted
                          ? 'bg-[#ef4444] text-white shadow-[0_0_12px_#ef4444] animate-pulse cursor-pointer'
                          : isSafetyArmed
                          ? 'bg-[#dc2626] text-white hover:bg-[#ef4444] cursor-pointer shadow-[0_0_8px_#ef4444]'
                          : 'bg-[#181d28] opacity-50 cursor-not-allowed text-[#64748b]'
                      }`}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px] text-white">warning</span>
                      <span>{isEmergencyMuted ? 'RESTORE' : 'KILL BROADCAST'}</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* SILENCED MASTER BANNER (Visible upon trigger) */}
              {isEmergencyMuted && (
                <div className="w-full bg-[#93000a] text-[#ffdad6] p-4 rounded-xl shadow-2xl flex items-center justify-between border-2 border-[#ef4444] animate-pulse">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[36px] text-[#ffdad6] font-bold">report</span>
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
                    className="px-4 py-2 rounded bg-white text-[#0f1217] text-xs font-mono font-bold uppercase hover:bg-slate-200 transition-all shadow"
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
                  <section className="w-full bg-[#10141c] rounded-xl p-3 shadow-md border border-[#222834] flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-1 border-b border-[#222834]">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#38bdf8] text-[20px]">volume_up</span>
                        <h3 className="text-sm font-bold text-[#f1f5f9]">Audio Engine DSP</h3>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#080a0e] text-[#10b981] uppercase font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                        48kHz AUTO
                      </span>
                    </div>

                    <div className="bg-[#080a0e] p-2.5 rounded-lg flex items-center justify-between border border-[#222834]">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-[#94a3b8] uppercase">WebAudio Host Context</span>
                        <span className={`text-xs font-mono font-semibold ${isAudioUnlocked ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>
                          {isAudioUnlocked ? 'INITIALIZED / LOCKED' : 'AWAITING UNLOCK'}
                        </span>
                      </div>
                      <button
                        onClick={handlePlayTestTone}
                        className="px-2.5 py-1 rounded bg-[#181d28] hover:bg-[#222a38] text-[#38bdf8] text-[10px] font-mono uppercase font-bold transition-all border border-[#273244]"
                        type="button"
                      >
                        TEST CHIME
                      </button>
                    </div>

                    {/* Master Output Gain Slider */}
                    <div className="bg-[#080a0e] p-2.5 rounded-lg border border-[#222834] flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] font-mono font-bold text-[#94a3b8] uppercase">MASTER PA GAIN</span>
                        <span className="text-[12px] font-mono font-bold text-white">
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
                        className="w-full accent-[#ef4444] cursor-pointer"
                      />
                      <div className="flex gap-1.5 pt-1">
                        {[0.5, 0.75, HARD_VOLUME_CEILING].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => handleSetVolumePreset(preset)}
                            className={`flex-1 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                              volume === preset ? 'bg-[#ef4444] text-white' : 'bg-[#141923] text-[#94a3b8] hover:text-white'
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
                  <div className="bg-[#10141c] rounded-xl p-3 shadow-md border border-[#222834]">
                    <DeviceSelector onSelectDevice={handleDeviceSelect} onPlayTestTone={handlePlayTestTone} />
                  </div>
                </div>

                {/* COLUMN 2: Floor Request Queue Triage (col-span-5) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <section aria-label="Floor Request Queue" aria-live="polite" className="w-full bg-[#10141c] rounded-xl p-3 shadow-md border border-[#222834] flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-1 border-b border-[#222834]">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#f59e0b] text-[22px]">queue_music</span>
                        <div>
                          <h3 className="text-sm font-bold text-[#f1f5f9]">Floor Request Triage</h3>
                          <p className="text-[11px] font-mono text-[#94a3b8]">Live mic access queue awaiting operator grant</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#181d28] text-[#f59e0b] uppercase font-bold">
                          {queue.length} IN QUEUE
                        </span>
                        {queue.length > 0 && (
                          <button
                            onClick={clearQueue}
                            className="text-[#94a3b8] hover:text-[#f1f5f9] text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-[#141923] transition-colors"
                            type="button"
                          >
                            CLEAR
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Request Triage List */}
                    {queue.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#94a3b8] border border-dashed border-[#222834] rounded-xl bg-[#080a0e]/40">
                        <span className="material-symbols-outlined text-[28px] text-slate-600 mb-1 block">mic_none</span>
                        <span>Floor queue is currently vacant.</span>
                        <p className="text-[10px] text-slate-500 mt-1">
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
                              className="flex flex-col p-2.5 rounded-lg bg-[#141923] hover:bg-[#181e2b] border border-[#222834] transition-colors gap-2"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-base font-mono font-bold text-slate-300 w-6">
                                    {String(index + 1).padStart(2, '0')}
                                  </span>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-[#f1f5f9]">{entry.name}</span>
                                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#080a0e] text-[#10b981] uppercase">
                                        MIC READY
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-[#94a3b8]">ID: {entry.id.slice(0, 16)}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end font-mono">
                                  <span className="text-xs font-bold text-[#f1f5f9]">{formatSpeakerClock(waitSec)}</span>
                                  <span className="text-[9px] text-[#94a3b8] uppercase">WAIT TIME</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-[#222834]">
                                <div className="flex items-center gap-3 text-[10px] font-mono text-[#94a3b8]">
                                  <span>BAT: <strong className="text-[#10b981]">94%</strong></span>
                                  <span>RF: <strong className="text-[#10b981]">-58 dBm</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleGrantSpeaker(entry.id, entry.name)}
                                    className="px-3 py-1 rounded bg-[#10b981] hover:bg-[#059669] text-white text-[10px] font-mono uppercase font-bold transition-all shadow"
                                    type="button"
                                  >
                                    GRANT FLOOR
                                  </button>
                                  <button
                                    onClick={() => addTelemetryLog(`PFL CUE: Pre-fade listen armed for ${entry.name}.`, 'info')}
                                    className="px-2.5 py-1 rounded bg-[#080a0e] hover:bg-[#181e2b] text-[#f59e0b] text-[10px] font-mono uppercase font-bold transition-all border border-[#222834]"
                                    type="button"
                                  >
                                    CUE PFL
                                  </button>
                                  <button
                                    onClick={() => removeFromQueue(entry.id)}
                                    className="p-1 rounded bg-[#080a0e] hover:bg-[#b91c1c] text-[#94a3b8] hover:text-white transition-all"
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

                  {/* ATTENDEES PRESENT IN MEETING (NAMES ROSTER) */}
                    <section aria-label="Meeting Attendance Roster" className="w-full bg-[#10141c] rounded-xl p-3 shadow-md border border-[#222834] flex flex-col gap-2">
                      <div className="flex items-center justify-between pb-1 border-b border-[#222834]">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#10b981] text-[20px]">groups</span>
                          <div>
                            <h3 className="text-sm font-bold text-[#f1f5f9]">Attendees Present ({activeAttendees.length})</h3>
                            <p className="text-[11px] font-mono text-[#94a3b8]">Meeting participants with live audio states</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10b981]/15 text-[#10b981] uppercase font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                          LIVE ROSTER
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                        {activeAttendees.map((att) => {
                          const isSpeaking = currentSpeaker?.id === att.identity || currentSpeaker?.name === att.name;
                          const queueIdx = queue.findIndex((q) => q.id === att.identity || q.name === att.name);
                          const isQueued = queueIdx !== -1;

                          return (
                            <div
                              key={att.identity}
                              className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                                isSpeaking
                                  ? 'bg-[#1c0f14] border-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                                  : isQueued
                                  ? 'bg-[#181610] border-[#f59e0b]'
                                  : 'bg-[#141923] border-[#222834] hover:bg-[#181e2b]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-inner flex-shrink-0"
                                  style={{ backgroundColor: getAvatarColor(att.name) }}
                                >
                                  {getInitials(att.name)}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-[#f1f5f9] truncate">{att.name}</span>
                                    {isSpeaking && (
                                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#ef4444] text-white uppercase animate-pulse">
                                        ON AIR
                                      </span>
                                    )}
                                    {isQueued && (
                                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#f59e0b] text-[#1a1000] uppercase">
                                        QUEUED #{queueIdx + 1}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-[#94a3b8] truncate">
                                    {att.identity.slice(0, 20)} • Connected
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isSpeaking ? (
                                  <button
                                    onClick={handleRevokeSpeaker}
                                    className="px-2 py-0.5 rounded bg-[#dc2626] hover:bg-[#ef4444] text-white text-[9px] font-mono uppercase font-bold transition-all"
                                    type="button"
                                  >
                                    MUTE
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleGrantSpeaker(att.identity, att.name)}
                                    className="px-2 py-0.5 rounded bg-[#181d28] hover:bg-[#10b981] text-[#cbd5e1] hover:text-white text-[9px] font-mono uppercase font-bold transition-all border border-[#273244]"
                                    type="button"
                                  >
                                    GRANT MIC
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>

                {/* COLUMN 3: Active Speaker Spotlight & Event Diagnostics (col-span-3) */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  {/* Active Speaker Spotlight Card */}
                  <section className="w-full bg-[#10141c] rounded-xl p-3 shadow-md border border-[#222834] flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-1 border-b border-[#222834]">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#ef4444] text-[20px]">record_voice_over</span>
                        <div>
                          <h3 className="text-sm font-bold text-[#f1f5f9]">Active Speaker</h3>
                          <span className="text-[9px] font-mono text-[#94a3b8] uppercase">MAIN STAGE MIC</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        currentSpeaker ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#141923] text-[#94a3b8]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${currentSpeaker ? 'bg-[#10b981] animate-ping' : 'bg-[#64748b]'}`} />
                        {currentSpeaker ? 'ON-AIR' : 'VACANT'}
                      </div>
                    </div>

                    {/* Speaker Details */}
                    <div className="flex flex-col bg-[#141923] p-2.5 rounded-lg border border-[#222834] gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`relative w-10 h-10 rounded-lg bg-[#181e2b] flex items-center justify-center border shrink-0 ${
                          currentSpeaker ? 'border-[#ef4444]' : 'border-slate-700'
                        }`}>
                          <span className="material-symbols-outlined text-[24px] text-slate-300">account_circle</span>
                          {currentSpeaker && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10b981] rounded-full shadow-[0_0_6px_#10b981]" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-xs font-bold text-[#f1f5f9] truncate">
                            {currentSpeaker ? currentSpeaker.name : 'No Presenter Active'}
                          </h4>
                          <span className="text-[10px] text-[#94a3b8] truncate">
                            {currentSpeaker ? `ID: ${currentSpeaker.id.slice(0, 14)}` : 'Awaiting Floor Request'}
                          </span>
                          <span className="text-[9px] font-mono text-[#38bdf8]">DANTE CH-01 ROUTED</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-[#080a0e] p-2 rounded border border-[#222834]">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-mono text-[#94a3b8] uppercase">SPEAKING TIME</span>
                          <span className="text-sm font-mono font-bold text-white">
                            {currentSpeaker ? formatSpeakerClock(speakerTimerSeconds) : '00:00'}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-mono text-[#94a3b8] uppercase">GAIN TRIM</span>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-[#38bdf8]">
                              {gainTrim > 0 ? `+${gainTrim.toFixed(1)}` : gainTrim.toFixed(1)} dB
                            </span>
                            <input
                              type="range"
                              min="-6"
                              max="6"
                              step="0.2"
                              value={gainTrim}
                              onChange={(e) => setGainTrim(parseFloat(e.target.value))}
                              className="w-14 h-1 accent-[#38bdf8] cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={handlePlayTestTone}
                          className="flex-1 py-1 rounded bg-[#181e2b] hover:bg-[#202738] text-[#f59e0b] text-[9px] font-mono font-bold uppercase transition-colors"
                        >
                          PTT INTERCOM
                        </button>
                        {currentSpeaker && (
                          <button
                            onClick={handleRevokeSpeaker}
                            className="flex-1 py-1 rounded bg-[#dc2626] hover:bg-[#ef4444] text-white text-[9px] font-mono font-bold uppercase transition-colors"
                          >
                            REVOKE MIC ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Room Pairing QR Code Card */}
                  <div className="bg-[#10141c] rounded-xl p-3 shadow-md border border-[#222834]">
                    <RoomQRCode
                      roomCode={roomName}
                      tokenServerUrl={tokenServerUrl}
                      onOpenFullScreen={() => setIsFullScreenQrOpen(true)}
                    />
                  </div>

                  {/* Live Diagnostic Telemetry Console */}
                  <section className="w-full bg-[#10141c] rounded-xl p-3 shadow-md border border-[#222834] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between pb-1 border-b border-[#222834]">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#38bdf8] text-[18px]">terminal</span>
                        <h4 className="text-xs font-mono font-bold uppercase text-[#f1f5f9]">Telemetry Event Stream</h4>
                      </div>
                      <button
                        onClick={() => setTelemetryLogs([])}
                        className="text-[9px] font-mono text-[#94a3b8] hover:text-white uppercase"
                      >
                        CLEAR
                      </button>
                    </div>

                    <div
                      ref={logContainerRef}
                      className="h-36 overflow-y-auto bg-[#080a0e] p-2 rounded-lg border border-[#222834] font-mono text-[10px] space-y-1"
                    >
                      {telemetryLogs.map((log) => (
                        <div key={log.id} className="leading-tight">
                          <span className="text-[#64748b] font-semibold">[{log.timestamp}]</span>{' '}
                          <span className={log.level === 'alert' ? 'text-[#ef4444] font-bold' : log.level === 'warn' ? 'text-[#f59e0b]' : log.level === 'success' ? 'text-[#10b981]' : 'text-[#38bdf8]'}>
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

      {/* 4. DEDICATED FULL SCREEN QR MODAL (Full laptop screen with massive QR on left & giant room code on right) */}
      <FullScreenQrModal
        isOpen={isFullScreenQrOpen}
        onClose={() => setIsFullScreenQrOpen(false)}
        roomCode={roomName}
        tokenServerUrl={tokenServerUrl}
        memberCount={memberCount}
        currentSpeaker={currentSpeaker}
        members={activeAttendees}
        queue={queue}
      />
    </div>
  );
}
