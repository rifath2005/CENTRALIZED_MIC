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
          <span style={{ ...styles.dbValue, color: isClipping ? '#f43f5e' : '#fbbf24' }}>
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
                ? 'linear-gradient(90deg, #10b981 0%, #fbbf24 70%, #f43f5e 100%)'
                : levelPercent > 65
                ? 'linear-gradient(90deg, #10b981 0%, #fbbf24 100%)'
                : '#10b981',
          }}
        />

        {/* Peak Hold Tick */}
        {peakPercent > 0 && (
          <div
            style={{
              ...styles.peakTick,
              left: `calc(${peakPercent}% - 2px)`,
              backgroundColor: peakPercent > 85 ? '#f43f5e' : peakPercent > 65 ? '#fbbf24' : '#10b981',
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
        <span style={{ color: '#f43f5e' }}>0dB PEAK</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#160a22',
    border: '1px solid #441e6a',
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
    color: '#cbd5e1',
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
    color: '#fb7185',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    padding: '2px 8px',
    borderRadius: '4px',
    border: '1px solid #f43f5e',
  },
  vuTrack: {
    height: '14px',
    backgroundColor: '#0d0515',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #441e6a',
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
    color: '#94a3b8',
    fontFamily: 'monospace',
    fontWeight: 700,
  },
};
