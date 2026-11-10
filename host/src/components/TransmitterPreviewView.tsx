import React, { useState, useEffect, useRef } from 'react';

interface TransmitterPreviewViewProps {
  roomCode: string;
  tokenServerUrl: string;
}

export type MicInteractionMode = 'hold' | 'toggle';
export type AudioInputHardware = 'builtin' | 'interface' | 'bluetooth';
export type FloorHoldState = 'idle' | 'requesting' | 'speaking' | 'queued';

export const TransmitterPreviewView: React.FC<TransmitterPreviewViewProps> = ({
  roomCode,
  tokenServerUrl = 'https://centralized-mic-token-server.onrender.com',
}) => {
  // Screen state: 'join' | 'connecting' | 'stage'
  const [screen, setScreen] = useState<'join' | 'connecting' | 'stage'>('join');

  // Input states (matching mobile/App.tsx)
  const [inputRoom, setInputRoom] = useState(roomCode || 'STG-709');
  const [userName, setUserName] = useState('Maya Lin');
  const [interactionMode, setInteractionMode] = useState<MicInteractionMode>('toggle');
  const [audioInputDevice, setAudioInputDevice] = useState<AudioInputHardware>('builtin');
  const [agcLimiter, setAgcLimiter] = useState(true);
  const [iemMonitoring, setIemMonitoring] = useState(true);
  const [gainBoostDb, setGainBoostDb] = useState<number>(6); // 0, 6, 12, 18
  const [friendlyError, setFriendlyError] = useState<string | null>(null);

  // Stage Floor & PTT states
  const [holdState, setHoldState] = useState<FloorHoldState>('idle');
  const [queuePosition, setQueuePosition] = useState<number>(1);
  const [meterLevel, setMeterLevel] = useState<number>(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isRealMicActive, setIsRealMicActive] = useState(false);

  // Real AudioContext and Analyser references
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setInputRoom(roomCode || 'STG-709');
  }, [roomCode]);

  // Clean room code sanitization (uppercase, alphanumeric + hyphen)
  const handleRoomCodeChange = (val: string) => {
    setFriendlyError(null);
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10);
    setInputRoom(cleaned);
  };

  // Connect action with radar simulation
  const handleConnect = () => {
    if (!inputRoom.trim() || inputRoom.trim().length < 3) {
      setFriendlyError('Please enter a valid room code (e.g. STG-709)');
      return;
    }
    if (!userName.trim()) {
      setFriendlyError('Please enter your performer name / label');
      return;
    }

    setFriendlyError(null);
    setScreen('connecting');

    // Radar connecting animation timer (simulating WebRTC setup ~1.5s)
    setTimeout(() => {
      setScreen('stage');
      setHoldState('idle');
    }, 1600);
  };

  // Exit Stage action
  const handleExitStage = () => {
    setShowExitModal(false);
    stopRealMic();
    setHoldState('idle');
    setScreen('join');
  };

  // Real Microphone activation for testing on web
  const startRealMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: agcLimiter,
        },
      });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsRealMicActive(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Boost factor from gainBoostDb (0dB = 1x, 18dB = 2.5x)
        const boostMultiplier = 1.0 + (gainBoostDb / 18) * 1.5;
        const normalized = Math.min(100, Math.round((avg / 128) * 100 * boostMultiplier));

        if (holdState === 'speaking') {
          setMeterLevel(normalized);
        } else {
          setMeterLevel(0);
        }

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      setIsRealMicActive(false);
      setFriendlyError('Microphone access denied or not available.');
    }
  };

  const stopRealMic = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsRealMicActive(false);
    setMeterLevel(0);
  };

  // Simulated meter levels when real mic is not engaged
  useEffect(() => {
    if (isRealMicActive) return;
    let timer: number;
    if (holdState === 'speaking') {
      timer = window.setInterval(() => {
        const boost = (gainBoostDb / 18) * 20;
        setMeterLevel(Math.floor(45 + Math.random() * 40 + boost));
      }, 90);
    } else {
      setMeterLevel(0);
    }
    return () => clearInterval(timer);
  }, [holdState, isRealMicActive, gainBoostDb]);

  // Push-To-Talk Handlers (Single Tap for Mute / Unmute in Toggle Mode)
  const lastToggleTimeRef = useRef<number>(0);

  const toggleMicState = () => {
    const now = Date.now();
    if (now - lastToggleTimeRef.current < 300) return;
    lastToggleTimeRef.current = now;

    setHoldState((prev) => (prev === 'speaking' ? 'idle' : 'speaking'));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (interactionMode === 'toggle') {
      e.preventDefault();
      toggleMicState();
    } else {
      e.preventDefault();
      setHoldState('speaking');
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (interactionMode === 'hold' && holdState === 'speaking') {
      e.preventDefault();
      setHoldState('idle');
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (interactionMode === 'toggle') {
      e.preventDefault();
      toggleMicState();
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 max-w-6xl mx-auto text-left">
      {/* Top Workbench Ribbon */}
      <div className="px-4 py-3 bg-[#0d1117] rounded-2xl border border-[#21262d] flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-md bg-[#161b22] text-rose-400 border border-rose-500/30 text-xs font-mono font-bold tracking-wider">
            AIRMIC WEB
          </span>
          <span className="text-slate-300 text-xs font-medium">
            Mobile-App Feature Parity &bull; Dual Talk Modes &bull; Gain Boost &bull; Studio VU Meter
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${tokenServerUrl.replace(/\/$/, '')}/mic.html?room=${encodeURIComponent(inputRoom)}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <span>📱 Open Standalone Web App</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>
      </div>

      {/* Main Grid: Phone Frame Preview (Left) + Inspector Controls (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Mobile Phone Device Frame */}
        <div className="lg:col-span-6 flex justify-center w-full">
          <div className="w-full max-w-[420px] bg-[#090305] border-[2px] sm:border-[3px] border-[#3b0d1a] rounded-[28px] sm:rounded-[42px] p-3.5 sm:p-5 shadow-2xl relative flex flex-col min-h-[580px] sm:min-h-[660px] overflow-hidden select-none">
            {/* Phone Speaker Dynamic Island Notch */}
            <div className="w-32 h-4 bg-[#14060b] rounded-full mx-auto mb-3 border border-[#3b0d1a] flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2a0b14]" />
            </div>

            {/* Mobile Status Bar Header */}
            <div className="flex items-center justify-between px-1 pb-3 text-[11px] font-mono text-rose-300/70 border-b border-[#3b0d1a]">
              <span className="font-bold tracking-wider text-white">AIRMIC STAGE</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-emerald-950/80 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  HD AUDIO
                </span>
                <span className="material-symbols-outlined text-[14px] text-emerald-400">wifi</span>
                <span className="material-symbols-outlined text-[14px] text-white">battery_full</span>
              </div>
            </div>

            {/* Viewport Dynamic Content */}
            {screen === 'connecting' ? (
              /* ========================================================= */
              /* SCREEN 2: ACOUSTIC RADAR CONNECTING SCREEN                */
              /* ========================================================= */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fadeIn my-auto">
                {/* Sonar Radar Rings */}
                <div className="relative w-44 h-44 flex items-center justify-center mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" />
                  <div className="absolute w-36 h-36 rounded-full border-2 border-red-500/40 animate-pulse" />
                  <div className="absolute w-28 h-28 rounded-full border border-red-500/60" />
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-rose-900 flex items-center justify-center shadow-lg shadow-red-600/40 z-10">
                    <span className="material-symbols-outlined text-[36px] text-white animate-spin">
                      radar
                    </span>
                  </div>
                </div>

                <div className="px-3 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-mono font-bold uppercase tracking-wider mb-2">
                  ROOM: {inputRoom}
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight mb-1">Connecting to Stage...</h3>
                <p className="text-xs text-rose-200/70 max-w-[260px] mb-8">
                  Negotiating ultra-low latency WebRTC audio pipeline with meeting sound system.
                </p>

                <button
                  onClick={() => setScreen('join')}
                  className="px-6 py-2.5 rounded-xl bg-[#1c070e] hover:bg-[#280a14] border border-[#5a1529] text-rose-300 font-bold text-xs transition-all active:scale-95"
                >
                  ✕ Cancel Connection
                </button>
              </div>
            ) : screen === 'join' ? (
              /* ========================================================= */
              /* SCREEN 1: JOIN STAGE SCREEN (Feature Parity with App)     */
              /* ========================================================= */
              <div className="flex-1 flex flex-col justify-between py-3 space-y-4 animate-fadeIn overflow-y-auto">
                <div>
                  {/* Join Header Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/80 border border-red-500/30 text-[10px] font-bold text-red-300 uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      AIRMIC WIRELESS
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1c070e] border border-[#3b0d1a] text-[10px] font-mono text-emerald-400">
                      <span>📶 HD Audio Ready</span>
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-white tracking-tight">Stage Access</h2>
                  <p className="text-xs text-rose-200/70 mt-0.5">
                    Connect as an ultra-low latency stage microphone feeding the room sound system.
                  </p>
                </div>

                {/* Stage Audio Anchor Card */}
                <div className="p-3.5 rounded-2xl bg-[#1c070e] border border-[#5a1529] flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-xl">
                      🎙️
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black uppercase text-white tracking-wider">
                          AIRMIC STAGE AUDIO
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                      </div>
                      <span className="text-[11px] text-rose-300/70">Sound System Connected</span>
                    </div>
                  </div>
                  {/* Signal 5-Bar Meter */}
                  <div className="flex items-end gap-1 h-5 px-2 py-1 rounded bg-[#090305] border border-[#3b0d1a]">
                    <div className="w-1 h-2 bg-emerald-500 rounded-sm" />
                    <div className="w-1 h-3 bg-emerald-500 rounded-sm" />
                    <div className="w-1 h-4 bg-emerald-500 rounded-sm" />
                    <div className="w-1 h-5 bg-emerald-500 rounded-sm" />
                    <div className="w-1 h-5 bg-emerald-400 rounded-sm animate-pulse" />
                  </div>
                </div>

                {/* Main Code Input Card */}
                <div className="p-4 rounded-2xl bg-[#14050a] border border-[#3b0d1a] space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span className="text-rose-300/80 flex items-center gap-1">
                      <span>📌</span>
                      <span>STAGE ROOM CODE</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRoomCodeChange('STG-709')}
                      className="px-2 py-0.5 rounded bg-[#280a14] hover:bg-[#350d1b] border border-[#5a1529] text-[10px] text-amber-300 font-bold transition-all"
                    >
                      📋 Auto: STG-709
                    </button>
                  </div>

                  {/* Segmented Hardware Style Monospace Input */}
                  <div className="flex gap-1 sm:gap-1.5 justify-center">
                    {(inputRoom.padEnd(7, ' ').slice(0, 7)).split('').map((char, idx) => (
                      <div
                        key={idx}
                        className={`w-7 h-9 sm:w-10 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-sm sm:text-lg font-mono font-black border transition-all ${
                          char.trim()
                            ? 'bg-[#1c070e] border-rose-500 text-white shadow-[0_0_8px_rgba(225,29,72,0.3)]'
                            : 'bg-[#090305] border-[#3b0d1a] text-slate-600'
                        }`}
                      >
                        {char.trim() || '·'}
                      </div>
                    ))}
                  </div>

                  {/* Hidden Real Input for typing */}
                  <input
                    type="text"
                    value={inputRoom}
                    onChange={(e) => handleRoomCodeChange(e.target.value)}
                    placeholder="Enter Room Code"
                    className="w-full bg-[#1c070e] border border-[#5a1529] rounded-xl px-3 py-2 text-center text-xs font-mono font-bold text-amber-300 uppercase tracking-widest focus:outline-none focus:border-red-500"
                  />

                  {/* Validation pill */}
                  <div className="flex items-center justify-between text-[10px] text-rose-300/60 pt-1">
                    <span>STAGE CODE FORMAT</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Valid Format
                    </span>
                  </div>
                </div>

                {/* Performer Name & Hardware Module */}
                <div className="p-4 rounded-2xl bg-[#14050a] border border-[#3b0d1a] space-y-3">
                  {/* Performer Name Input */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-rose-300/80 mb-1.5">
                      👤 PERFORMER NAME / LABEL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => {
                        setUserName(e.target.value);
                        setFriendlyError(null);
                      }}
                      placeholder="e.g. Maya Lin (Lead Vocals)"
                      className="w-full bg-[#1c070e] border border-[#3b0d1a] focus:border-red-500 rounded-xl px-3 py-2 text-xs text-white placeholder-rose-300/30 font-medium focus:outline-none"
                    />
                  </div>

                  {/* Audio Hardware Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono font-bold uppercase text-rose-300/80">
                      <span>🎤 AUDIO INPUT HARDWARE</span>
                      <span className="text-emerald-400">HD Ready</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'builtin', label: 'Built-in Omni' },
                        { id: 'interface', label: 'USB/Type-C' },
                        { id: 'bluetooth', label: 'IEM / BT' },
                      ].map((dev) => (
                        <button
                          key={dev.id}
                          type="button"
                          onClick={() => setAudioInputDevice(dev.id as any)}
                          className={`py-2 px-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                            audioInputDevice === dev.id
                              ? 'bg-red-600 border-red-500 text-white shadow-sm'
                              : 'bg-[#1c070e] border-[#3b0d1a] text-rose-300/70 hover:border-[#5a1529]'
                          }`}
                        >
                          {dev.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Acoustic Safety Toggles */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#3b0d1a]">
                    <div className="p-2.5 rounded-xl bg-[#1c070e] border border-[#3b0d1a] flex items-center justify-between">
                      <div className="text-left">
                        <div className="text-[11px] font-bold text-white leading-tight">AGC & Limiter</div>
                        <div className="text-[9px] text-rose-300/60">Prevent clip</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={agcLimiter}
                        onChange={(e) => setAgcLimiter(e.target.checked)}
                        className="w-4 h-4 rounded text-red-600 focus:ring-0 border-[#5a1529] bg-[#090305] cursor-pointer"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#1c070e] border border-[#3b0d1a] flex items-center justify-between">
                      <div className="text-left">
                        <div className="text-[11px] font-bold text-white leading-tight">In-Ear IEM</div>
                        <div className="text-[9px] text-emerald-400/80">Zero latency</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={iemMonitoring}
                        onChange={(e) => setIemMonitoring(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 focus:ring-0 border-[#5a1529] bg-[#090305] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Friendly Error */}
                {friendlyError && (
                  <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-red-500">error</span>
                    <span>{friendlyError}</span>
                  </div>
                )}

                {/* Primary CTA Connect Button */}
                <button
                  type="button"
                  onClick={handleConnect}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">sensors</span>
                  <span>Connect to Stage</span>
                </button>
              </div>
            ) : (
              /* ========================================================= */
              /* SCREEN 3: ACTIVE STAGE SCREEN (Feature Parity with App)   */
              /* ========================================================= */
              <div className="flex-1 flex flex-col justify-between py-2 space-y-3 animate-fadeIn overflow-y-auto">
                {/* Top Utility Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1c070e] border border-[#5a1529] text-[11px] font-mono font-bold text-white">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{inputRoom} • LIVE</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExitModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-transparent hover:bg-rose-950/40 border border-[#3b0d1a] text-rose-300 text-xs font-bold transition-all"
                  >
                    ✕ Exit Stage
                  </button>
                </div>

                {/* MOB-ST-01: Performer Status Card */}
                <div className="p-3.5 rounded-2xl bg-[#1c070e] border border-[#5a1529] flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full bg-[#280a14] border border-rose-500/40 flex items-center justify-center text-lg">
                      👤
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#1c070e]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white">{userName || 'Maya Lin'}</span>
                        <span className="text-emerald-400 font-bold text-xs">✓</span>
                      </div>
                      <span className="text-[10px] text-rose-300/70">Stage Microphone</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="px-2 py-0.5 rounded bg-red-950 border border-red-500/30 text-[9px] font-mono font-bold text-red-300">
                      AIRMIC
                    </span>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold">LIVE ON STAGE</span>
                  </div>
                </div>

                {/* MOB-ST-02: Connection Quality Telemetry Badge */}
                <div className="px-3 py-1.5 rounded-xl bg-[#14050a] border border-[#3b0d1a] flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-end gap-0.5 h-3">
                      <div className="w-1 h-1.5 bg-emerald-400 rounded-xs" />
                      <div className="w-1 h-2 bg-emerald-400 rounded-xs" />
                      <div className="w-1 h-2.5 bg-emerald-400 rounded-xs" />
                      <div className="w-1 h-3 bg-emerald-400 rounded-xs" />
                    </div>
                    <span className="text-slate-300 text-[10px]">Signal Quality: Excellent</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-[10px]">LIVE STREAMING</span>
                </div>

                {/* MOB-ST-03: Multi-Segment Studio-Grade LED Peak VU Meter */}
                <div className="p-3 rounded-2xl bg-[#14050a] border border-[#3b0d1a]">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-rose-300/70 mb-1.5">
                    <span>STUDIO VU METER</span>
                    <span className={meterLevel > 80 ? 'text-rose-400' : 'text-emerald-400'}>
                      {holdState === 'speaking'
                        ? `${Math.round(-48 + (meterLevel * 0.48))} dBFS`
                        : '-∞ dBFS'}
                    </span>
                  </div>
                  {/* Multi-segment LED bar */}
                  <div className="w-full h-3 bg-[#090305] rounded-lg p-0.5 border border-[#280a14] flex gap-0.5 overflow-hidden">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const threshold = (i / 24) * 100;
                      const isActive = meterLevel >= threshold;
                      let color = 'bg-emerald-500';
                      if (i >= 16 && i < 20) color = 'bg-amber-400';
                      if (i >= 20) color = 'bg-red-500';

                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-xs transition-opacity duration-75 ${
                            isActive ? `${color} opacity-100 shadow-[0_0_4px_currentColor]` : 'bg-[#1c070e] opacity-30'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Giant PTT Button */}
                <div className="flex flex-col items-center justify-center py-2">
                  <button
                    type="button"
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onClick={handleClick}
                    className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 flex flex-col items-center justify-center transition-all select-none cursor-pointer ${
                      holdState === 'speaking'
                        ? 'bg-gradient-to-br from-emerald-600 to-emerald-950 border-emerald-400 text-white shadow-[0_0_35px_rgba(16,185,129,0.7)] scale-98'
                        : holdState === 'queued'
                        ? 'bg-gradient-to-br from-amber-600 to-amber-950 border-amber-400 text-white shadow-[0_0_30px_rgba(245,158,11,0.5)]'
                        : 'bg-gradient-to-br from-[#280a14] to-[#120408] border-red-500 text-white shadow-[0_0_25px_rgba(225,29,72,0.4)] active:scale-95'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[38px] sm:text-[48px] mb-1">
                      {holdState === 'speaking' ? 'mic' : holdState === 'queued' ? 'hourglass_top' : 'mic_none'}
                    </span>
                    <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-center px-2">
                      {holdState === 'speaking'
                        ? interactionMode === 'toggle'
                          ? 'TAP TO MUTE'
                          : 'LIVE ON AIR'
                        : holdState === 'queued'
                        ? `IN QUEUE (#${queuePosition})`
                        : interactionMode === 'toggle'
                        ? 'TAP TO TALK'
                        : 'HOLD TO TALK'}
                    </span>
                  </button>
                </div>

                {/* Dual Mode Switcher (Pill Style) */}
                <div className="flex items-center justify-center gap-1.5 p-1 rounded-full bg-[#1c070e] border border-[#3b0d1a] mx-auto w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setInteractionMode('hold');
                      setHoldState('idle');
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      interactionMode === 'hold'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-rose-300/60 hover:text-white'
                    }`}
                  >
                    🖐️ Hold to Talk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInteractionMode('toggle');
                      setHoldState('idle');
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      interactionMode === 'toggle'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-rose-300/60 hover:text-white'
                    }`}
                  >
                    🎙️ Tap to Toggle (Lock)
                  </button>
                </div>

                {/* MOB-ST-08: Software Gain Boost Card (0dB to +18dB) */}
                <div className="p-3 rounded-2xl bg-[#14050a] border border-[#3b0d1a] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span>🔊</span>
                      <span>Software Gain Boost</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-red-950 border border-red-500/30 text-[10px] font-mono font-bold text-red-300">
                      +{gainBoostDb.toFixed(1)} dB
                    </span>
                  </div>
                  {/* Stepped Preset Buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 6, 12, 18].map((db) => (
                      <button
                        key={db}
                        type="button"
                        onClick={() => setGainBoostDb(db)}
                        className={`py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          gainBoostDb === db
                            ? 'bg-red-600 border-red-500 text-white shadow-sm'
                            : 'bg-[#1c070e] border-[#3b0d1a] text-rose-300/60 hover:text-white'
                        }`}
                      >
                        {db === 0 ? '0 dB' : `+${db} dB`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* MOB-ST-07: Stream Audio Profile Badge */}
                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#14050a] border border-[#3b0d1a] text-[10px] font-mono">
                  <span className="text-rose-300/60 flex items-center gap-1">
                    <span>🎚️</span>
                    <span>AUDIO STREAM</span>
                  </span>
                  <span className="text-emerald-400 font-bold">High Definition Audio</span>
                </div>
              </div>
            )}

            {/* Bottom Home Indicator Bar */}
            <div className="w-28 h-1 bg-[#3b0d1a] rounded-full mx-auto mt-2" />

            {/* Safe Exit Modal Confirmation */}
            {showExitModal && (
              <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
                <div className="w-full max-w-[280px] bg-[#1c070e] border border-red-500/40 rounded-3xl p-5 text-center space-y-4 shadow-2xl">
                  <div className="w-12 h-12 rounded-full bg-red-950 border border-red-500/40 flex items-center justify-center mx-auto text-2xl text-red-400">
                    ⚠️
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Leave Stage?</h4>
                    <p className="text-xs text-rose-200/70 mt-1">
                      Disconnect your microphone from the sound system?
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowExitModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-[#280a14] border border-[#5a1529] text-rose-300 font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExitStage}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Operator Control & Simulation Inspector Panel */}
        <div className="lg:col-span-6 bg-[#0d1117] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#21262d] shadow-xl space-y-4 sm:space-y-6 w-full">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-500/30 text-[10px] font-mono font-bold text-sky-400 uppercase">
                WEB TRANSMITTER CONTROLLER
              </span>
              <span className="text-xs text-slate-400 font-mono">SPEC: AIRMIC-WEB-01..08</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Stage Feature Parity Matrix</h3>
            <p className="text-xs text-slate-400 mt-1">
              Test and verify all native mobile app features rendered in the browser for web attendees.
            </p>
          </div>

          {/* Quick Actions / Testing */}
          <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-3">
            <span className="text-xs font-mono font-bold text-slate-300 block">
              1. Physical Hardware Microphone Testing
            </span>
            <p className="text-xs text-slate-400">
              Enable your laptop/computer microphone to verify real Web Audio processing, AGC, and VU meter.
            </p>
            <div className="flex gap-2">
              {!isRealMicActive ? (
                <button
                  type="button"
                  onClick={startRealMic}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">mic</span>
                  <span>Enable Live Laptop Mic</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRealMic}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">mic_off</span>
                  <span>Stop Laptop Mic</span>
                </button>
              )}
            </div>
          </div>

          {/* Floor State Injections */}
          <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-3">
            <span className="text-xs font-mono font-bold text-slate-300 block">
              2. Inject Floor & Queue Transitions
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setScreen('stage');
                  setHoldState('idle');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  holdState === 'idle'
                    ? 'bg-slate-700 border-slate-600 text-white shadow-sm'
                    : 'bg-[#0d1117] border-[#21262d] text-slate-400 hover:border-slate-700'
                }`}
              >
                ⚪ Idle Standby
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreen('stage');
                  setHoldState('queued');
                  setQueuePosition(1);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  holdState === 'queued'
                    ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                    : 'bg-[#0d1117] border-[#21262d] text-slate-400 hover:border-slate-700'
                }`}
              >
                ⏳ Queued (#1)
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreen('stage');
                  setHoldState('speaking');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  holdState === 'speaking'
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                    : 'bg-[#0d1117] border-[#21262d] text-slate-400 hover:border-slate-700'
                }`}
              >
                🔴 On-Air Live
              </button>
            </div>
          </div>

          {/* Feature Checklist Summary */}
          <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-2.5">
            <span className="text-xs font-mono font-bold text-slate-300 block mb-1">
              3. Native Features Integrated in Web
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span>✓</span>
                <span className="text-slate-300">Dual Talk Modes (Hold/Tap)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span>✓</span>
                <span className="text-slate-300">Segmented Monospace Input</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span>✓</span>
                <span className="text-slate-300">Radar Sonar Connecting Screen</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span>✓</span>
                <span className="text-slate-300">Hardware Audio Selector</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span>✓</span>
                <span className="text-slate-300">Multi-Segment LED VU Meter</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span>✓</span>
                <span className="text-slate-300">Software Gain Boost (+18dB)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span>✓</span>
                <span className="text-slate-300">AGC & Limiter Toggle</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span>✓</span>
                <span className="text-slate-300">Safe Exit Stage Confirmation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
