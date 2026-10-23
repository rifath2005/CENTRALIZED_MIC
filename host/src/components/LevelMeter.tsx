import React, { useState, useEffect, useRef } from 'react';
import { AudioProcessingGraph } from '../audio/AudioProcessingGraph';
import { redTheme } from '../tokens/redTheme';

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
      // Direct fast read of precomputed audio metrics without blocking audio thread
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
    <div
      style={styles.container}
      role="region"
      aria-label="PA Output Level Monitoring"
    >
      <div style={styles.meterHeader}>
        <div style={styles.titleWithVal}>
          <span style={styles.meterTitle}>PA OUTPUT RMS &amp; PEAK</span>
          <span
            style={{
              ...styles.dbValue,
              color: isClipping ? redTheme.colors.statusClip : redTheme.colors.accentBright,
            }}
            aria-live="polite"
          >
            {isClipping ? '🚨 CLIP!' : dbfs}
          </span>
        </div>

        {metrics.gainReduction > 0.5 && (
          <span style={styles.limiterActiveBadge} aria-live="polite">
            PEAK LIMITING: -{grDb} dB
          </span>
        )}
      </div>

      {/* Main VU Meter Bar with Peak Hold Tick */}
      <div
        style={styles.vuTrack}
        role="meter"
        aria-label="Master audio level"
        aria-valuenow={levelPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* RMS fill */}
        <div
          style={{
            ...styles.vuBar,
            width: `${levelPercent}%`,
            background:
              levelPercent > 85
                ? 'linear-gradient(90deg, #10b981 0%, #f59e0b 65%, #e11d48 90%, #ef4444 100%)'
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
              backgroundColor: peakPercent > 85 ? redTheme.colors.primaryHover : peakPercent > 65 ? redTheme.colors.statusInQueue : redTheme.colors.statusOnAir,
            }}
          />
        )}
      </div>

      <div style={styles.scaleLabels} aria-hidden="true">
        <span>-∞</span>
        <span>-24</span>
        <span>-18</span>
        <span>-12</span>
        <span>-6</span>
        <span style={{ color: redTheme.colors.primaryHover }}>0dB PEAK</span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderMedium}`,
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
    color: redTheme.colors.textSecondary,
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
    color: redTheme.colors.accentLight,
    backgroundColor: redTheme.colors.emergencyBg,
    padding: '2px 8px',
    borderRadius: '4px',
    border: `1px solid ${redTheme.colors.borderStrong}`,
  },
  vuTrack: {
    height: '14px',
    backgroundColor: redTheme.colors.bgDeepest,
    borderRadius: '6px',
    overflow: 'hidden',
    border: `1px solid ${redTheme.colors.borderSubtle}`,
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
    boxShadow: '0 0 6px rgba(255, 255, 255, 0.6)',
  },
  scaleLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '9px',
    color: redTheme.colors.textMuted,
    fontFamily: 'monospace',
    fontWeight: 700,
  },
};
