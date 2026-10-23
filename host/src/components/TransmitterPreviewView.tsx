import React, { useState, useEffect } from 'react';

interface TransmitterPreviewViewProps {
  roomCode: string;
  tokenServerUrl: string;
}

export const TransmitterPreviewView: React.FC<TransmitterPreviewViewProps> = ({
  roomCode,
}) => {
  const [screen, setScreen] = useState<'join' | 'stage'>('stage');
  const [attendeeState, setAttendeeState] = useState<'standby' | 'queued' | 'onair'>('standby');
  const [isHolding, setIsHolding] = useState(false);
  const [isLatchMode, setIsLatchMode] = useState(false);
  const [showError, setShowError] = useState(false);
  const [meterLevel, setMeterLevel] = useState(0);

  // Meter simulation while on-air or holding
  useEffect(() => {
    let interval: number;
    if (attendeeState === 'onair' || isHolding) {
      interval = window.setInterval(() => {
        setMeterLevel(Math.floor(40 + Math.random() * 50));
      }, 100);
    } else {
      setMeterLevel(0);
    }
    return () => clearInterval(interval);
  }, [attendeeState, isHolding]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isLatchMode) {
      if (attendeeState === 'onair') {
        setAttendeeState('standby');
      } else {
        setAttendeeState('onair');
      }
    } else {
      setIsHolding(true);
      setAttendeeState('onair');
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!isLatchMode && isHolding) {
      setIsHolding(false);
      setAttendeeState('standby');
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 max-w-5xl mx-auto">
      {/* Workbench Header Ribbon */}
      <div className="px-4 py-2.5 bg-[#10141c] rounded-xl border border-[#222834] flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#181d28] text-slate-300 border border-[#273244] text-[11px] font-mono font-bold uppercase tracking-wider">
            SPEC: WEB-TR-01..10
          </span>
          <span className="text-[#94a3b8] text-xs font-mono">
            ATTENDEE TRANSMITTER / MOBILE PWA PREVIEW (server/public/mic.html)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-[#10b981] bg-[#0c1017] px-2 py-0.5 rounded border border-[#222834]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
            WEBRTC OPUS 48kHz
          </span>
          <span className="text-[11px] font-mono text-[#64748b]">REV 4.2.1-PROD</span>
        </div>
      </div>

      {/* Main Grid: Mobile Phone Frame + State Controls Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left: Mobile Phone Device Frame */}
        <div className="md:col-span-6 flex justify-center">
          <div className="w-full max-w-[380px] bg-[#080a0e] border-2 border-[#222834] rounded-[36px] p-4 shadow-2xl relative flex flex-col min-h-[660px]">
            {/* Phone Notch */}
            <div className="w-32 h-4 bg-[#10141c] rounded-full mx-auto mb-3 border border-[#222834] flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-[#181d28]" />
            </div>

            {/* Status Bar Telemetry */}
            <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-mono text-[#64748b] border-b border-[#181d28]">
              <span>STAGEPULSE PWA // WEBRTC</span>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px]">wifi</span>
                <span className="font-bold text-[#f1f5f9]">98%</span>
                <span className="material-symbols-outlined text-[13px]">battery_full</span>
              </div>
            </div>

            {/* Dismissible Error Banner (WEB-TR-04) */}
            {showError && (
              <div className="mt-2 w-full bg-[#ef4444] text-white p-2.5 rounded-lg flex items-center justify-between text-xs shadow-md">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">mic_off</span>
                  <span className="font-bold">Microphone access requested</span>
                </div>
                <button onClick={() => setShowError(false)} className="text-white hover:text-red-200 font-bold ml-2">
                  ✕
                </button>
              </div>
            )}

            {/* Viewport Content */}
            {screen === 'join' ? (
              /* Screen A: Join Screen */
              <div className="flex-1 flex flex-col justify-center px-2 py-6 space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-[#141923] border border-[#222834] rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl shadow-inner">
                    🎙️
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">AirMic Live Stage</h3>
                  <p className="text-xs text-[#94a3b8]">Audience Floor Transmitter</p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-[#94a3b8] uppercase mb-1">
                      Event Room Code
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={roomCode}
                      className="w-full bg-[#141923] border border-[#222834] rounded-xl px-3 py-2 text-sm font-mono font-bold text-[#f59e0b]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-[#94a3b8] uppercase mb-1">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex"
                      defaultValue="Alex Chen"
                      className="w-full bg-[#141923] border border-[#222834] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ef4444]"
                    />
                  </div>
                  <button
                    onClick={() => setScreen('stage')}
                    className="w-full py-3 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
                  >
                    <span>Join Stage</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Screen B: Connected Stage */
              <div className="flex-1 flex flex-col justify-between py-2">
                {/* Header Pill */}
                <div className="flex items-center justify-between bg-[#141923] p-2 rounded-xl border border-[#222834]">
                  <div className="flex items-center gap-2">
                    <div className="relative w-4 h-4 flex items-center justify-center">
                      <span className="absolute w-4 h-4 rounded-full bg-[#ef4444]/30 animate-ping" />
                      <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#f1f5f9]">Main Stage</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#f59e0b] bg-[#0c1017] px-2 py-0.5 rounded border border-[#222834]">
                    {roomCode}
                  </span>
                </div>

                {/* Pulsar Graphic & Status Card */}
                <div className="my-auto flex flex-col items-center py-4">
                  <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                    <div className={`absolute w-32 h-32 rounded-full border border-[#222834] ${attendeeState === 'onair' ? 'animate-ping border-[#ef4444]/40' : ''}`} />
                    <div className="absolute w-24 h-24 rounded-full border border-[#273244]" />
                    <div className={`w-16 h-16 rounded-full bg-[#141923] border-2 flex items-center justify-center text-2xl shadow-xl z-10 transition-all ${
                      attendeeState === 'onair' ? 'border-[#ef4444] shadow-[0_0_16px_rgba(239,68,68,0.4)]' : attendeeState === 'queued' ? 'border-[#f59e0b]' : 'border-[#475569]'
                    }`}>
                      {attendeeState === 'onair' ? '🎙️' : attendeeState === 'queued' ? '⏳' : '⚪'}
                    </div>
                  </div>

                  <div className="w-full bg-[#141923] border border-[#222834] rounded-xl p-3 text-center">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748b] block">
                      TRANSMITTER STATUS
                    </span>
                    <h4 className="text-sm font-bold text-[#f1f5f9] mt-0.5">
                      {attendeeState === 'onair' ? '🎙️ YOU ARE ON AIR' : attendeeState === 'queued' ? '⏳ IN LINE (#1)' : '⚪ FLOOR STANDBY'}
                    </h4>
                    <p className="text-[11px] text-[#94a3b8] mt-0.5">
                      {attendeeState === 'onair'
                        ? 'Broadcasting live to room sound system'
                        : attendeeState === 'queued'
                        ? 'Operator will open your mic shortly'
                        : isLatchMode
                        ? 'Tap button below to talk'
                        : 'Hold button below to talk'}
                    </p>
                  </div>
                </div>

                {/* Bottom Controls */}
                <div className="space-y-3 pt-2">
                  {/* Meter Bar */}
                  <div className="bg-[#141923] p-2 rounded-xl border border-[#222834]">
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-[#94a3b8]">MIC INPUT</span>
                      <span className="text-[#f1f5f9] font-bold">
                        {meterLevel > 0 ? `${Math.round(-40 + (meterLevel * 0.4))} dBFS` : '-∞ dBFS'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#0c1017] rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-gradient-to-r from-[#10b981] via-[#f59e0b] to-[#ef4444] transition-all duration-75"
                        style={{ width: `${meterLevel}%` }}
                      />
                    </div>
                  </div>

                  {/* PTT Button */}
                  <button
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className={`w-full py-4 rounded-2xl flex flex-col items-center justify-center border-2 transition-all select-none cursor-pointer ${
                      attendeeState === 'onair'
                        ? 'bg-[#ef4444] border-[#ef4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                        : 'bg-[#141923] border-[#222834] hover:border-[#ef4444]/60 text-white'
                    }`}
                  >
                    <span className="text-sm font-black tracking-wider">
                      {attendeeState === 'onair'
                        ? isLatchMode
                          ? 'TAP TO MUTE'
                          : 'RELEASE TO MUTE'
                        : isLatchMode
                        ? 'TAP TO TALK'
                        : 'HOLD TO TALK'}
                    </span>
                    <span className="text-[10px] text-[#94a3b8]">
                      {attendeeState === 'onair' ? 'Transmitting Live' : 'Push-to-Talk Enabled'}
                    </span>
                  </button>

                  {/* Latch Toggle */}
                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-[11px] text-[#94a3b8]">Hands-Free Latch Mode:</span>
                    <button
                      onClick={() => setIsLatchMode(!isLatchMode)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        isLatchMode ? 'bg-[#ef4444] text-white' : 'bg-[#181d28] text-[#94a3b8] border border-[#222834]'
                      }`}
                    >
                      {isLatchMode ? 'ON (TAP)' : 'OFF (HOLD)'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Home Pill Indicator */}
            <div className="w-24 h-1 bg-[#222834] rounded-full mx-auto mt-3" />
          </div>
        </div>

        {/* Right: State Simulator & Inspector Panel */}
        <div className="md:col-span-6 bg-[#10141c] rounded-2xl p-4 border border-[#222834] shadow-xl space-y-4">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-[#38bdf8] tracking-wider block">
              OPERATOR EMULATOR CONTROLS
            </span>
            <h3 className="text-base font-bold text-[#f1f5f9]">Transmitter State Injection</h3>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Simulate floor transitions and audio policies as perceived on attendee smartphones.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-mono text-[#94a3b8] block">Force Floor State:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setAttendeeState('standby')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  attendeeState === 'standby' ? 'bg-[#334155] text-white border border-[#475569]' : 'bg-[#141923] text-[#94a3b8] border border-[#222834] hover:bg-[#181d28]'
                }`}
              >
                ⚪ Standby
              </button>
              <button
                onClick={() => setAttendeeState('queued')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  attendeeState === 'queued' ? 'bg-[#f59e0b] text-[#1c1917]' : 'bg-[#141923] text-[#94a3b8] border border-[#222834] hover:bg-[#181d28]'
                }`}
              >
                ⏳ In Queue (#1)
              </button>
              <button
                onClick={() => setAttendeeState('onair')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  attendeeState === 'onair' ? 'bg-[#ef4444] text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]' : 'bg-[#141923] text-[#94a3b8] border border-[#222834] hover:bg-[#181d28]'
                }`}
              >
                🔴 On-Air Live
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#222834]">
            <span className="text-[11px] font-mono text-[#94a3b8] block">Switch Screens:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setScreen('join')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  screen === 'join' ? 'bg-[#ef4444] text-white' : 'bg-[#141923] text-[#94a3b8] border border-[#222834] hover:bg-[#181d28]'
                }`}
              >
                Join Form Screen
              </button>
              <button
                onClick={() => setScreen('stage')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  screen === 'stage' ? 'bg-[#ef4444] text-white' : 'bg-[#141923] text-[#94a3b8] border border-[#222834] hover:bg-[#181d28]'
                }`}
              >
                Connected Stage Screen
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#222834]">
            <span className="text-[11px] font-mono text-[#94a3b8] block">Simulate Error Banner:</span>
            <button
              onClick={() => setShowError(!showError)}
              className="w-full py-1.5 rounded-lg text-xs font-bold bg-[#181d28] hover:bg-[#ef4444] text-slate-300 hover:text-white border border-[#273244] transition-all"
            >
              {showError ? 'Hide Permission Error' : 'Trigger Audio Permission Error Banner'}
            </button>
          </div>

          <div className="p-3 bg-[#0c1017] rounded-xl border border-[#222834] text-xs text-[#94a3b8] space-y-1">
            <div className="font-bold text-[#f1f5f9]">Direct URL for Attendees:</div>
            <div className="font-mono text-[#38bdf8] text-[11px] break-all">
              /mic?room={roomCode}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
