import React, { useState, useEffect, useRef } from 'react';
import { AudioProcessingGraph } from '../audio/AudioProcessingGraph';

interface LevelMeterProps {
  audioGraph: AudioProcessingGraph;
}

export const LevelMeter: React.FC<LevelMeterProps> = ({ audioGraph }) => {
  const [metrics, setMetrics] = useState({ level: 0, gainReduction: 0 });
  const [peakHold, setPeakHold] = useState(0);
  const peakDecayTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let animId: number;

    const poll = () => {
      const data = audioGraph.getAudioMetrics();
      setMetrics(data);

      setPeakHold((prevPeak) => {
        if (data.level > prevPeak) {
          if (peakDecayTimerRef.current) clearTimeout(peakDecayTimerRef.current);
          peakDecayTimerRef.current = setTimeout(() => {
            setPeakHold((p) => Math.max(0, p - 0.08));
          }, 1200);
          return data.level;
        }
        return prevPeak;
      });

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(animId);
      if (peakDecayTimerRef.current) clearTimeout(peakDecayTimerRef.current);
    };
  }, [audioGraph]);

  const levelPercent = Math.min(Math.round(metrics.level * 100), 100);
  const peakPercent = Math.min(Math.round(peakHold * 100), 100);
  const isClipping = levelPercent >= 98;
  const grDb = metrics.gainReduction.toFixed(1);

  // Approximate dBFS level
  const dbfs = levelPercent === 0 ? '-∞' : `${Math.round(20 * Math.log10(Math.max(metrics.level, 0.001)))} dBFS`;

  return (
    <div style={styles.container}>
      <div style={styles.meterHeader}>
        <div style={styles.titleWithVal}>
          <span style={styles.meterTitle}>PA OUTPUT RMS &amp; PEAK</span>
          <span style={{ ...styles.dbValue, color: isClipping ? '#ef4444' : '#38bdf8' }}>
            {isClipping ? '🚨 CLIP!' : dbfs}
          </span>
        </div>

        {metrics.gainReduction > 0.5 && (
          <span style={styles.limiterActiveBadge}>
            PEAK LIMITING: -{grDb} dB
          </span>
        )}
      </div>

      {/* Main VU Meter Bar with Peak Hold Tick */}
      <div style={styles.vuTrack}>
        {/* RMS fill */}
        <div
          style={{
            ...styles.vuBar,
            width: `${levelPercent}%`,
            background:
              levelPercent > 85
                ? 'linear-gradient(90deg, #10b981 0%, #f59e0b 70%, #ef4444 100%)'
                : levelPercent > 65
                ? 'linear-gradient(90deg, #10b981 0%, #f59e0b 100%)'
                : '#10b981',
          }}
        />

        {/* Peak Hold Tick */}
        {peakPercent > 0 && (
          <div
            style={{
              ...styles.peakTick,
              left: `calc(${peakPercent}% - 2px)`,
              backgroundColor: peakPercent > 85 ? '#ef4444' : peakPercent > 65 ? '#f59e0b' : '#34d399',
            }}
          />
        )}
      </div>

      <div style={styles.scaleLabels}>
        <span>-∞</span>
        <span>-24</span>
        <span>-18</span>
        <span>-12</span>
        <span>-6</span>
        <span style={{ color: '#ef4444' }}>0dB PEAK</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '10px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  meterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWithVal: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  meterTitle: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#94a3b8',
    letterSpacing: '1px',
  },
  dbValue: {
    fontSize: '11px',
    fontWeight: 800,
    fontFamily: 'monospace',
  },
  limiterActiveBadge: {
    fontSize: '10px',
    fontWeight: 800,
    color: '#f87171',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid #ef4444',
  },
  vuTrack: {
    height: '14px',
    backgroundColor: '#090d16',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #1e293b',
    position: 'relative',
  },
  vuBar: {
    height: '100%',
    transition: 'width 0.05s ease-out',
    borderRadius: '4px',
  },
  peakTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '3px',
    zIndex: 2,
    borderRadius: '1px',
    boxShadow: '0 0 4px rgba(255,255,255,0.4)',
  },
  scaleLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9px',
    color: '#64748b',
    fontFamily: 'monospace',
    fontWeight: 700,
  },
};
