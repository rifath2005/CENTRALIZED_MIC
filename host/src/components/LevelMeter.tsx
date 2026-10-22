import React, { useState, useEffect } from 'react';
import { AudioProcessingGraph } from '../audio/AudioProcessingGraph';

interface LevelMeterProps {
  audioGraph: AudioProcessingGraph;
}

export const LevelMeter: React.FC<LevelMeterProps> = ({ audioGraph }) => {
  const [metrics, setMetrics] = useState({ level: 0, gainReduction: 0 });

  useEffect(() => {
    let animId: number;

    const poll = () => {
      setMetrics(audioGraph.getAudioMetrics());
      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [audioGraph]);

  const levelPercent = Math.min(Math.round(metrics.level * 100), 100);
  const grDb = metrics.gainReduction.toFixed(1);

  return (
    <div style={styles.container}>
      <div style={styles.meterHeader}>
        <span style={styles.meterTitle}>PA OUTPUT SIGNAL & LIMITER</span>
        {metrics.gainReduction > 0.5 && (
          <span style={styles.limiterActiveBadge}>
            LIMITING: -{grDb} dB
          </span>
        )}
      </div>

      {/* Main RMS VU meter */}
      <div style={styles.vuTrack}>
        <div
          style={{
            ...styles.vuBar,
            width: `${levelPercent}%`,
            backgroundColor:
              levelPercent > 85 ? '#ef4444' : levelPercent > 65 ? '#eab308' : '#22c55e',
          }}
        />
      </div>

      <div style={styles.scaleLabels}>
        <span>-inf</span>
        <span>-24dB</span>
        <span>-12dB</span>
        <span>-6dB</span>
        <span>0dB (PEAK)</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '16px 20px',
  },
  meterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  meterTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '1px',
  },
  limiterActiveBadge: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#f87171',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: '3px 8px',
    borderRadius: '4px',
    border: '1px solid #ef4444',
  },
  vuTrack: {
    height: '14px',
    backgroundColor: '#0f172a',
    borderRadius: '7px',
    overflow: 'hidden',
    border: '1px solid #1e293b',
    position: 'relative',
  },
  vuBar: {
    height: '100%',
    transition: 'width 0.05s ease-out, background-color 0.1s ease',
  },
  scaleLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '6px',
    fontSize: '9px',
    color: '#64748b',
    fontFamily: 'monospace',
    fontWeight: 600,
  },
};
