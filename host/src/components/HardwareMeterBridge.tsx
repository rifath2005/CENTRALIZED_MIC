import React, { useState, useEffect, useRef } from 'react';
import { AudioProcessingGraph } from '../audio/AudioProcessingGraph';

interface HardwareMeterBridgeProps {
  audioGraph: AudioProcessingGraph;
}

const TOTAL_SEGMENTS = 18;

export const HardwareMeterBridge: React.FC<HardwareMeterBridgeProps> = ({ audioGraph }) => {
  const [metrics, setMetrics] = useState({ level: 0, gainReduction: 0 });
  const [clips, setClips] = useState({ ch1: false, ch2: false, ch3: false, mst: false });
  const [mutes, setMutes] = useState({ ch1: false, ch2: false, ch3: false });
  const [pfls, setPfls] = useState({ ch1: false, ch2: false, ch3: false });
  const peakHoldRef = useRef(0);

  useEffect(() => {
    let animId: number;

    const poll = () => {
      const data = audioGraph.getAudioMetrics();
      setMetrics(data);

      if (data.level >= 0.98) {
        setClips((prev) => ({ ...prev, ch1: true, mst: true }));
      }

      if (data.level > peakHoldRef.current) {
        peakHoldRef.current = data.level;
      } else {
        peakHoldRef.current = Math.max(0, peakHoldRef.current - 0.005);
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [audioGraph]);

  const ch1Level = mutes.ch1 ? 0 : metrics.level;
  const mstLevel = metrics.level;
  // Floor & Keynote auxiliary channels have realistic ambient telemetry simulation
  const ch2Level = mutes.ch2 ? 0 : Math.max(0, (metrics.level > 0.1 ? metrics.level * 0.45 + (Math.sin(Date.now() / 300) * 0.04) : 0));
  const ch3Level = mutes.ch3 ? 0 : Math.max(0, (metrics.level > 0.2 ? metrics.level * 0.7 + (Math.cos(Date.now() / 450) * 0.05) : 0));

  const getActiveSegments = (val: number) => Math.min(TOTAL_SEGMENTS, Math.round(val * TOTAL_SEGMENTS));

  const ch1Segments = getActiveSegments(ch1Level);
  const ch2Segments = getActiveSegments(ch2Level);
  const ch3Segments = getActiveSegments(ch3Level);
  const mstSegments = getActiveSegments(mstLevel);

  const getDbReadout = (val: number) => {
    if (val <= 0.001) return '-∞';
    const db = Math.round(20 * Math.log10(Math.max(val, 0.001)));
    return `${db.toFixed(1)} dB`;
  };

  const handleResetClips = () => {
    setClips({ ch1: false, ch2: false, ch3: false, mst: false });
  };

  const toggleMute = (ch: 'ch1' | 'ch2' | 'ch3') => {
    setMutes((prev) => ({ ...prev, [ch]: !prev[ch] }));
  };

  const togglePfl = (ch: 'ch1' | 'ch2' | 'ch3') => {
    setPfls((prev) => ({ ...prev, [ch]: !prev[ch] }));
  };

  // Render LED segments with authentic color zones:
  // 0-9: Green (secondary #00e475)
  // 10-14: Amber (tertiary #ffba38)
  // 15-17: Red (primary-container #ff544c)
  const renderLadder = (activeCount: number) => {
    return Array.from({ length: TOTAL_SEGMENTS }).map((_, idx) => {
      const isLit = idx < activeCount;
      let litColor = 'bg-[#00e475] shadow-[0_0_6px_#00e475]';
      if (idx >= 15) {
        litColor = 'bg-[#ff544c] shadow-[0_0_8px_#ff544c]';
      } else if (idx >= 10) {
        litColor = 'bg-[#ffba38] shadow-[0_0_6px_#ffba38]';
      }

      return (
        <div
          key={idx}
          className={`w-full h-2 rounded-[2px] transition-colors duration-75 ${
            isLit ? litColor : 'bg-[#282a2e]'
          }`}
        />
      );
    });
  };

  return (
    <div className="w-full bg-[#1a1c20] rounded-xl p-3 shadow-md border border-[#333539]/60 flex flex-col gap-2">
      {/* Header Row */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[#ffb4ac] text-[20px]">equalizer</span>
          <div>
            <h3 className="text-sm font-bold text-[#e2e2e8] leading-none">Hardware VU Bridge</h3>
            <span className="text-[9px] font-mono font-bold uppercase text-[#a3717c] tracking-wider">
              RMS &amp; PEAK LADDER METERS
            </span>
          </div>
        </div>
        <button
          onClick={handleResetClips}
          className="px-2 py-0.5 rounded bg-[#333539] hover:bg-[#37393e] text-[#e2e2e8] text-[9px] font-mono font-bold uppercase transition-all"
          type="button"
        >
          RESET CLIPS
        </button>
      </div>

      {/* 4-Channel Meter Bank */}
      <div className="grid grid-cols-4 gap-1.5 bg-[#0c0e12] p-2 rounded-lg border border-[#333539]/40">
        {/* CH-01 Podium Mic */}
        <div className="flex flex-col items-center gap-1 bg-[#1a1c20]/60 p-1.5 rounded border border-[#333539]/30">
          <span className="text-[10px] font-mono font-bold text-[#e2e2e8]">CH-01</span>
          <span className="text-[8px] font-mono font-bold text-[#7dffa2] uppercase truncate max-w-[54px]">
            PODIUM
          </span>

          <div className="relative w-6 h-52 bg-[#1e2024] rounded flex flex-col-reverse p-0.5 gap-0.5 overflow-hidden">
            <div
              className={`w-full h-2 rounded-[2px] flex items-center justify-center text-[7px] font-mono font-bold ${
                clips.ch1 ? 'bg-[#ff544c] text-white shadow-[0_0_8px_#ff544c]' : 'bg-[#333539] text-[#a3717c]'
              }`}
            >
              0dB
            </div>
            <div className="w-full flex-1 flex flex-col-reverse gap-0.5">
              {renderLadder(ch1Segments)}
            </div>
          </div>

          <span className="text-[10px] font-mono font-semibold text-[#e2e2e8]">
            {getDbReadout(ch1Level)}
          </span>

          <div className="flex flex-col w-full gap-1 pt-1 border-t border-[#333539]/50">
            <button
              onClick={() => toggleMute('ch1')}
              className={`w-full py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-colors ${
                mutes.ch1 ? 'bg-[#93000a] text-white' : 'bg-[#1e2024] hover:bg-[#93000a] text-[#e2e2e8]'
              }`}
            >
              {mutes.ch1 ? 'MUTED' : 'MUTE'}
            </button>
            <button
              onClick={() => togglePfl('ch1')}
              className={`w-full py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-colors ${
                pfls.ch1 ? 'bg-[#ffba38] text-[#432c00]' : 'bg-[#1e2024] hover:bg-[#ffba38]/20 text-[#ffba38]'
              }`}
            >
              {pfls.ch1 ? 'PFL ON' : 'PFL'}
            </button>
          </div>
        </div>

        {/* CH-02 Floor Mic Preview */}
        <div className="flex flex-col items-center gap-1 bg-[#1a1c20]/60 p-1.5 rounded border border-[#333539]/30">
          <span className="text-[10px] font-mono font-bold text-[#e2e2e8]">CH-02</span>
          <span className="text-[8px] font-mono font-bold text-[#ffba38] uppercase truncate max-w-[54px]">
            FLOOR
          </span>

          <div className="relative w-6 h-52 bg-[#1e2024] rounded flex flex-col-reverse p-0.5 gap-0.5 overflow-hidden">
            <div
              className={`w-full h-2 rounded-[2px] flex items-center justify-center text-[7px] font-mono font-bold ${
                clips.ch2 ? 'bg-[#ff544c] text-white shadow-[0_0_8px_#ff544c]' : 'bg-[#333539] text-[#a3717c]'
              }`}
            >
              0dB
            </div>
            <div className="w-full flex-1 flex flex-col-reverse gap-0.5">
              {renderLadder(ch2Segments)}
            </div>
          </div>

          <span className="text-[10px] font-mono font-semibold text-[#e2e2e8]">
            {getDbReadout(ch2Level)}
          </span>

          <div className="flex flex-col w-full gap-1 pt-1 border-t border-[#333539]/50">
            <button
              onClick={() => toggleMute('ch2')}
              className={`w-full py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-colors ${
                mutes.ch2 ? 'bg-[#93000a] text-white' : 'bg-[#1e2024] hover:bg-[#93000a] text-[#e2e2e8]'
              }`}
            >
              {mutes.ch2 ? 'MUTED' : 'MUTE'}
            </button>
            <button
              onClick={() => togglePfl('ch2')}
              className={`w-full py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-colors ${
                pfls.ch2 ? 'bg-[#ffba38] text-[#432c00]' : 'bg-[#1e2024] hover:bg-[#ffba38]/20 text-[#ffba38]'
              }`}
            >
              {pfls.ch2 ? 'PFL ON' : 'PFL'}
            </button>
          </div>
        </div>

        {/* CH-03 Keynote Feed */}
        <div className="flex flex-col items-center gap-1 bg-[#1a1c20]/60 p-1.5 rounded border border-[#333539]/30">
          <span className="text-[10px] font-mono font-bold text-[#e2e2e8]">CH-03</span>
          <span className="text-[8px] font-mono font-bold text-[#ffb4ac] uppercase truncate max-w-[54px]">
            KEYNOTE
          </span>

          <div className="relative w-6 h-52 bg-[#1e2024] rounded flex flex-col-reverse p-0.5 gap-0.5 overflow-hidden">
            <div
              className={`w-full h-2 rounded-[2px] flex items-center justify-center text-[7px] font-mono font-bold ${
                clips.ch3 ? 'bg-[#ff544c] text-white shadow-[0_0_8px_#ff544c]' : 'bg-[#333539] text-[#a3717c]'
              }`}
            >
              0dB
            </div>
            <div className="w-full flex-1 flex flex-col-reverse gap-0.5">
              {renderLadder(ch3Segments)}
            </div>
          </div>

          <span className="text-[10px] font-mono font-semibold text-[#e2e2e8]">
            {getDbReadout(ch3Level)}
          </span>

          <div className="flex flex-col w-full gap-1 pt-1 border-t border-[#333539]/50">
            <button
              onClick={() => toggleMute('ch3')}
              className={`w-full py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-colors ${
                mutes.ch3 ? 'bg-[#93000a] text-white' : 'bg-[#1e2024] hover:bg-[#93000a] text-[#e2e2e8]'
              }`}
            >
              {mutes.ch3 ? 'MUTED' : 'MUTE'}
            </button>
            <button
              onClick={() => togglePfl('ch3')}
              className={`w-full py-0.5 rounded text-[8px] font-mono font-bold uppercase transition-colors ${
                pfls.ch3 ? 'bg-[#ffba38] text-[#432c00]' : 'bg-[#1e2024] hover:bg-[#ffba38]/20 text-[#ffba38]'
              }`}
            >
              {pfls.ch3 ? 'PFL ON' : 'PFL'}
            </button>
          </div>
        </div>

        {/* Master Dante Mix */}
        <div className="flex flex-col items-center gap-1 bg-[#1a1c20]/60 p-1.5 rounded border border-[#ff544c]/30">
          <span className="text-[10px] font-mono font-bold text-[#ff544c]">MASTER</span>
          <span className="text-[8px] font-mono font-bold text-[#ffb4ac] uppercase truncate max-w-[54px]">
            DANTE
          </span>

          <div className="relative w-6 h-52 bg-[#1e2024] rounded flex flex-col-reverse p-0.5 gap-0.5 overflow-hidden">
            <div
              className={`w-full h-2 rounded-[2px] flex items-center justify-center text-[7px] font-mono font-bold ${
                clips.mst ? 'bg-[#ff544c] text-white shadow-[0_0_8px_#ff544c]' : 'bg-[#333539] text-[#a3717c]'
              }`}
            >
              0dB
            </div>
            <div className="w-full flex-1 flex flex-col-reverse gap-0.5">
              {renderLadder(mstSegments)}
            </div>
          </div>

          <span className="text-[10px] font-mono font-bold text-[#ff544c]">
            {getDbReadout(mstLevel)}
          </span>

          <div className="flex flex-col w-full gap-1 pt-1 border-t border-[#333539]/50">
            <span className="w-full py-0.5 text-center rounded bg-[#ff544c] text-[#5c0005] text-[8px] font-mono font-bold uppercase">
              LIVE
            </span>
            <span className="w-full py-0.5 text-center rounded bg-[#1e2024] text-[#7dffa2] text-[8px] font-mono font-bold">
              0dB NOM
            </span>
          </div>
        </div>
      </div>

      {/* Scale Legend */}
      <div className="flex items-center justify-between px-1.5 py-1 rounded bg-[#1e2024] text-[9px] text-[#a3717c] font-mono">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#00e475]" />
          <span>-48 to -12dB</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#ffba38]" />
          <span>-12 to -3dB</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#ff544c]" />
          <span>&gt; -3dB PEAK</span>
        </div>
      </div>
    </div>
  );
};
