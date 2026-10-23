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
      <div className="px-4 py-2.5 bg-[#1a1c20] rounded-xl border border-[#333539]/60 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#ff544c] text-[#5c0005] text-[11px] font-mono font-bold uppercase tracking-wider">
            SPEC: WEB-TR-01..10
          </span>
          <span className="text-[#a3717c] text-xs font-mono">
            ATTENDEE TRANSMITTER / MOBILE PWA PREVIEW (server/public/mic.html)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-mono text-[#7dffa2] bg-[#0c0e12] px-2 py-0.5 rounded border border-[#333539]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e475] animate-ping" />
            WEBRTC OPUS 48kHz
          </span>
          <span className="text-[11px] font-mono text-[#a3717c]">REV 4.2.1-PROD</span>
        </div>
      </div>

      {/* Main Grid: Mobile Phone Frame + State Controls Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left: Mobile Phone Device Frame */}
        <div className="md:col-span-6 flex justify-center">
          <div className="w-full max-w-[380px] bg-[#0c0e12] border-2 border-[#333539] rounded-[36px] p-4 shadow-2xl relative flex flex-col min-h-[660px]">
            {/* Phone Notch */}
            <div className="w-32 h-4 bg-[#111317] rounded-full mx-auto mb-3 border border-[#333539]/60 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-[#1e2024]" />
            </div>

            {/* Status Bar Telemetry */}
            <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-mono text-[#a3717c] border-b border-[#1e2024]">
              <span>STAGEPULSE PWA // WEBRTC</span>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px]">wifi</span>
                <span className="font-bold text-[#e2e2e8]">98%</span>
                <span className="material-symbols-outlined text-[13px]">battery_full</span>
              </div>
            </div>

            {/* Dismissible Error Banner (WEB-TR-04) */}
            {showError && (
              <div className="mt-2 w-full bg-[#93000a] text-[#ffdad6] p-2 rounded-lg flex items-center justify-between text-xs shadow-md">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">mic_off</span>
                  <span className="font-bold">Microphone access requested</span>
                </div>
                <button onClick={() => setShowError(false)} className="text-[#ffdad6] hover:text-white font-bold ml-2">
                  ✕
                </button>
              </div>
            )}

            {/* Viewport Content */}
            {screen === 'join' ? (
              /* Screen A: Join Screen */
              <div className="flex-1 flex flex-col justify-center px-2 py-6 space-y-4">
                <div className="text-center">
                  <div className="w-14 h-14 bg-[#1e2024] border border-[#ff544c]/40 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl shadow-inner">
                    🎙️
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">AirMic Live Stage</h3>
                  <p className="text-xs text-[#a3717c]">Audience Floor Transmitter</p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-[#ffb4ac] uppercase mb-1">
                      Event Room Code
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={roomCode}
                      className="w-full bg-[#1e2024] border border-[#ff544c]/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-[#ffb4ac] uppercase mb-1">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Alex"
                      defaultValue="Alex Chen"
                      className="w-full bg-[#1e2024] border border-[#333539] rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <button
                    onClick={() => setScreen('stage')}
                    className="w-full py-3 bg-[#ff544c] hover:bg-[#ffb4ac] text-[#5c0005] hover:text-[#000] font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
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
                <div className="flex items-center justify-between bg-[#1a1c20] p-2 rounded-xl border border-[#333539]/60">
                  <div className="flex items-center gap-2">
                    <div className="relative w-4 h-4 flex items-center justify-center">
                      <span className="absolute w-4 h-4 rounded-full bg-[#ff544c]/30 animate-ping" />
                      <span className="w-2 h-2 rounded-full bg-[#ff544c]" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#e2e2e8]">Main Stage</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#ffba38] bg-[#0c0e12] px-2 py-0.5 rounded border border-[#333539]/40">
                    {roomCode}
                  </span>
                </div>

                {/* Pulsar Graphic & Status Card */}
                <div className="my-auto flex flex-col items-center py-4">
                  <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                    <div className={`absolute w-32 h-32 rounded-full border border-[#ff544c]/30 ${attendeeState === 'onair' ? 'animate-ping' : ''}`} />
                    <div className="absolute w-24 h-24 rounded-full border border-[#ffba38]/40" />
                    <div className={`w-16 h-16 rounded-full bg-[#1e2024] border-2 flex items-center justify-center text-2xl shadow-xl z-10 ${
                      attendeeState === 'onair' ? 'border-[#00e475]' : attendeeState === 'queued' ? 'border-[#ffba38]' : 'border-[#ff544c]'
                    }`}>
                      {attendeeState === 'onair' ? '🎙️' : attendeeState === 'queued' ? '⏳' : '⚪'}
                    </div>
                  </div>

                  <div className="w-full bg-[#1e2024] border border-[#333539] rounded-xl p-3 text-center">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#a3717c] block">
                      TRANSMITTER STATUS
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      {attendeeState === 'onair' ? '🎙️ YOU ARE ON AIR' : attendeeState === 'queued' ? '⏳ IN LINE (#1)' : '⚪ FLOOR STANDBY'}
                    </h4>
                    <p className="text-[11px] text-[#a3717c] mt-0.5">
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
                  <div className="bg-[#1e2024] p-2 rounded-xl border border-[#333539]/60">
                    <div className="flex justify-between text-[10px] font-mono mb-1">
                      <span className="text-[#a3717c]">MIC INPUT</span>
                      <span className="text-[#ffb4ac] font-bold">
                        {meterLevel > 0 ? `${Math.round(-40 + (meterLevel * 0.4))} dBFS` : '-∞ dBFS'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#0c0e12] rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-gradient-to-r from-[#00e475] via-[#ffba38] to-[#ff544c] transition-all duration-75"
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
                        ? 'bg-[#93000a] border-[#ff544c] text-white shadow-[0_0_20px_rgba(255,84,76,0.6)]'
                        : 'bg-[#1e2024] border-[#333539] hover:border-[#ff544c] text-white'
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
                    <span className="text-[10px] text-[#a3717c]">
                      {attendeeState === 'onair' ? 'Transmitting Live' : 'Push-to-Talk Enabled'}
                    </span>
                  </button>

                  {/* Latch Toggle */}
                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-[11px] text-[#a3717c]">Hands-Free Latch Mode:</span>
                    <button
                      onClick={() => setIsLatchMode(!isLatchMode)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        isLatchMode ? 'bg-[#ff544c] text-[#5c0005]' : 'bg-[#1e2024] text-[#a3717c] border border-[#333539]'
                      }`}
                    >
                      {isLatchMode ? 'ON (TAP)' : 'OFF (HOLD)'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Home Pill Indicator */}
            <div className="w-24 h-1 bg-[#333539] rounded-full mx-auto mt-3" />
          </div>
        </div>

        {/* Right: State Simulator & Inspector Panel */}
        <div className="md:col-span-6 bg-[#1a1c20] rounded-2xl p-4 border border-[#333539]/60 shadow-xl space-y-4">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-[#ffb4ac] tracking-wider block">
              OPERATOR EMULATOR CONTROLS
            </span>
            <h3 className="text-base font-bold text-white">Transmitter State Injection</h3>
            <p className="text-xs text-[#a3717c] mt-0.5">
              Simulate floor transitions and audio policies as perceived on attendee smartphones.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-mono text-[#a3717c] block">Force Floor State:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setAttendeeState('standby')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  attendeeState === 'standby' ? 'bg-[#ff544c] text-[#5c0005]' : 'bg-[#1e2024] text-[#e2e2e8] border border-[#333539]'
                }`}
              >
                ⚪ Standby
              </button>
              <button
                onClick={() => setAttendeeState('queued')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  attendeeState === 'queued' ? 'bg-[#ffba38] text-[#432c00]' : 'bg-[#1e2024] text-[#e2e2e8] border border-[#333539]'
                }`}
              >
                ⏳ In Queue (#1)
              </button>
              <button
                onClick={() => setAttendeeState('onair')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  attendeeState === 'onair' ? 'bg-[#00e475] text-[#003918]' : 'bg-[#1e2024] text-[#e2e2e8] border border-[#333539]'
                }`}
              >
                🔴 On-Air Live
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#333539]/40">
            <span className="text-[11px] font-mono text-[#a3717c] block">Switch Screens:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setScreen('join')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                  screen === 'join' ? 'bg-[#ff544c] text-[#5c0005]' : 'bg-[#1e2024] text-[#a3717c] border border-[#333539]'
                }`}
              >
                Join Form Screen
              </button>
              <button
                onClick={() => setScreen('stage')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                  screen === 'stage' ? 'bg-[#ff544c] text-[#5c0005]' : 'bg-[#1e2024] text-[#a3717c] border border-[#333539]'
                }`}
              >
                Connected Stage Screen
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#333539]/40">
            <span className="text-[11px] font-mono text-[#a3717c] block">Simulate Error Banner:</span>
            <button
              onClick={() => setShowError(!showError)}
              className="w-full py-1.5 rounded-lg text-xs font-bold bg-[#93000a] text-white hover:bg-[#ff544c] hover:text-[#5c0005] transition-all"
            >
              {showError ? 'Hide Permission Error' : 'Trigger Audio Permission Error Banner'}
            </button>
          </div>

          <div className="p-3 bg-[#0c0e12] rounded-xl border border-[#333539]/40 text-xs text-[#a3717c] space-y-1">
            <div className="font-bold text-[#e2e2e8]">Direct URL for Attendees:</div>
            <div className="font-mono text-[#ffba38] text-[11px] break-all">
              /mic?room={roomCode}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
