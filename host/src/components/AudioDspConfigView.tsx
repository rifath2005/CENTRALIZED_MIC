import React from 'react';
import { AudioProcessingGraph, HARD_VOLUME_CEILING } from '../audio/AudioProcessingGraph';
import { DeviceSelector } from './DeviceSelector';
import { LevelMeter } from './LevelMeter';
import { redTheme } from '../tokens/redTheme';

interface AudioDspConfigViewProps {
  audioGraph: AudioProcessingGraph;
  volume: number;
  limiterThreshold: number;
  isEmergencyMuted: boolean;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSetVolumePreset: (val: number) => void;
  onToggleEmergencyMute: () => void;
  onThresholdChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectDevice: (deviceId: string) => Promise<void>;
  onPlayTestTone: () => void;
}

export const AudioDspConfigView: React.FC<AudioDspConfigViewProps> = ({
  audioGraph,
  volume,
  limiterThreshold,
  isEmergencyMuted,
  onVolumeChange,
  onSetVolumePreset,
  onToggleEmergencyMute,
  onThresholdChange,
  onSelectDevice,
  onPlayTestTone,
}) => {
  return (
    <div style={styles.container}>
      {/* Header Banner */}
      <div style={styles.headerCard}>
        <div style={styles.headerLeft}>
          <div style={styles.badgeRow}>
            <span style={styles.sectionBadge}>AUDIO DSP &amp; HARDWARE CALIBRATION</span>
            <span style={styles.internalBadge}>🔒 SOUND ENGINEER ONLY</span>
          </div>
          <h2 style={styles.title}>Venue PA &amp; Signal Processing Engine</h2>
          <p style={styles.description}>
            Configure physical soundcard routing, acoustic rumble filters, and dynamic peak limiting.
            These low-level controls are hidden from event attendees during screen-shares.
          </p>
        </div>

        <div style={styles.headerRight}>
          <button
            style={styles.testToneBtn}
            onClick={onPlayTestTone}
            title="Emit clean dual-chime through room sound system"
          >
            🔔 Emit Test Chime (440/880Hz)
          </button>
        </div>
      </div>

      {/* Grid: Audio Meter + Device Selector */}
      <div style={styles.twoColumnGrid}>
        {/* Left: Real-time Level Meter & Limiter Status */}
        <div style={styles.panelCard}>
          <div style={styles.cardHeader}>
            <span style={styles.cardBadge}>ACOUSTIC METERING</span>
            <h3 style={styles.cardTitle}>Live PA Output &amp; Limiter Reduction</h3>
          </div>
          <LevelMeter audioGraph={audioGraph} />

          <div style={styles.meterSpecs}>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Sample Rate:</span>
              <span style={styles.specVal}>48,000 Hz HD</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Target Latency:</span>
              <span style={styles.specVal}>&lt; 300ms Glass-to-Glass</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Channel Profile:</span>
              <span style={styles.specVal}>Opus Mono (32 kbps)</span>
            </div>
          </div>
        </div>

        {/* Right: Soundcard / Interface Routing */}
        <div style={styles.panelCard}>
          <div style={styles.cardHeader}>
            <span style={styles.cardBadge}>PHYSICAL SOUNDCARD</span>
            <h3 style={styles.cardTitle}>Audio Output Device Routing</h3>
          </div>
          <p style={styles.cardHelp}>
            Select the audio interface connected to the meeting room PA mixer, amplifier, or Dante network.
          </p>
          <DeviceSelector onSelectDevice={onSelectDevice} onPlayTestTone={onPlayTestTone} />
        </div>
      </div>

      {/* Second Row: Master Gain & Limiter Calibration */}
      <div style={styles.twoColumnGrid}>
        {/* Master Output Level & Ceiling */}
        <div style={styles.panelCard}>
          <div style={styles.cardHeader}>
            <span style={styles.cardBadge}>VOLUME CEILING</span>
            <h3 style={styles.cardTitle}>Master PA Output Level</h3>
          </div>

          <div style={styles.volumeControlBlock}>
            <div style={styles.sliderHeader}>
              <span style={styles.sliderLabel}>Gain Setting</span>
              <span style={styles.sliderValue}>
                {Math.round(volume * 100)}%
                <span style={styles.clampedNote}> (Max {Math.round(HARD_VOLUME_CEILING * 100)}%)</span>
              </span>
            </div>

            <input
              type="range"
              min="0"
              max={HARD_VOLUME_CEILING.toString()}
              step="0.01"
              value={volume}
              onChange={onVolumeChange}
              style={styles.rangeSlider}
            />

            <div style={styles.presetButtonsRow}>
              {[0.3, 0.5, 0.75, HARD_VOLUME_CEILING].map((preset) => (
                <button
                  key={preset}
                  style={{
                    ...styles.presetChip,
                    backgroundColor: volume === preset ? redTheme.colors.primary : redTheme.colors.bgSurfaceElevated,
                    color: volume === preset ? redTheme.colors.textOnPrimary : redTheme.colors.textSecondary,
                    borderColor: volume === preset ? redTheme.colors.borderStrong : redTheme.colors.borderSubtle,
                  }}
                  onClick={() => onSetVolumePreset(preset)}
                >
                  {preset === HARD_VOLUME_CEILING ? '90% (Max)' : `${Math.round(preset * 100)}%`}
                </button>
              ))}
            </div>

            <div style={styles.muteSection}>
              <button
                style={{
                  ...styles.emergencyMuteButton,
                  backgroundColor: isEmergencyMuted ? redTheme.colors.emergency : redTheme.colors.emergencyBg,
                  borderColor: redTheme.colors.emergencyBorder,
                  color: isEmergencyMuted ? '#ffffff' : redTheme.colors.emergencyText,
                  boxShadow: isEmergencyMuted ? redTheme.shadows.glowEmergency : 'none',
                }}
                onClick={onToggleEmergencyMute}
              >
                {isEmergencyMuted ? '🚨 EMERGENCY PA MUTED — CLICK TO UNMUTE' : '🛑 EMERGENCY MASTER MUTE'}
              </button>
              <span style={styles.muteTip}>
                Instant zero-gain clamp to suppress acoustic room howling or feedback.
              </span>
            </div>
          </div>
        </div>

        {/* DSP Calibration: Highpass & Peak Limiter */}
        <div style={styles.panelCard}>
          <div style={styles.cardHeader}>
            <span style={styles.cardBadge}>SIGNAL DYNAMICS</span>
            <h3 style={styles.cardTitle}>Peak Limiter &amp; Rumble Filter</h3>
          </div>

          {/* 80Hz Rumble Filter */}
          <div style={styles.filterBlock}>
            <div style={styles.filterTitleRow}>
              <span style={styles.filterIcon}>🛡️</span>
              <div>
                <strong style={styles.filterName}>80Hz Butterworth High-Pass Filter</strong>
                <p style={styles.filterDesc}>
                  Removes desk vibrations, air conditioning rumble, and breath plosives below 80 Hz.
                </p>
              </div>
              <span style={styles.activePill}>ACTIVE</span>
            </div>
          </div>

          {/* Peak Limiter Slider */}
          <div style={styles.limiterBlock}>
            <div style={styles.sliderHeader}>
              <span style={styles.sliderLabel}>Limiter Threshold</span>
              <span style={styles.sliderValue}>{limiterThreshold} dBFS</span>
            </div>
            <input
              type="range"
              min="-36"
              max="0"
              step="1"
              value={limiterThreshold}
              onChange={onThresholdChange}
              style={styles.rangeSlider}
            />

            <div style={styles.limiterSpecsList}>
              <div style={styles.limiterSpec}>
                <span>Attack Time:</span>
                <strong>3 ms (Ultra-fast transient clamp)</strong>
              </div>
              <div style={styles.limiterSpec}>
                <span>Release Time:</span>
                <strong>100 ms (Natural vocal decay)</strong>
              </div>
              <div style={styles.limiterSpec}>
                <span>Compression Ratio:</span>
                <strong>10:1 (Hard ceiling peak limiter)</strong>
              </div>
              <div style={styles.limiterSpec}>
                <span>Knee Smoothing:</span>
                <strong>12 dB Soft Knee</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
  },
  headerCard: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '20px',
    padding: '28px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    boxShadow: redTheme.shadows.card,
  },
  headerLeft: {
    maxWidth: '750px',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  sectionBadge: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    color: redTheme.colors.accentBright,
    backgroundColor: 'rgba(225, 29, 72, 0.14)',
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    padding: '4px 12px',
    borderRadius: '12px',
  },
  internalBadge: {
    fontSize: '10.5px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: redTheme.colors.textMuted,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    padding: '4px 10px',
    borderRadius: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 900,
    color: redTheme.colors.textPrimary,
    letterSpacing: '-0.5px',
    marginBottom: '8px',
  },
  description: {
    fontSize: '13.5px',
    color: redTheme.colors.textMuted,
    lineHeight: '1.6',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  testToneBtn: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    color: redTheme.colors.accentBright,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '14px',
    padding: '14px 22px',
    fontSize: '13.5px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: '24px',
  },
  panelCard: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '20px',
    padding: '26px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: redTheme.shadows.card,
  },
  cardHeader: {
    marginBottom: '16px',
  },
  cardBadge: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: redTheme.colors.accentBright,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: 800,
    color: redTheme.colors.textPrimary,
    marginTop: '4px',
    marginBottom: '6px',
  },
  cardHelp: {
    fontSize: '13px',
    color: redTheme.colors.textMuted,
    lineHeight: '1.5',
    marginBottom: '16px',
  },
  meterSpecs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: `1px solid ${redTheme.colors.borderSubtle}`,
  },
  specItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  specLabel: {
    fontSize: '11px',
    color: redTheme.colors.textMuted,
  },
  specVal: {
    fontSize: '12px',
    fontWeight: 700,
    color: redTheme.colors.textSecondary,
  },
  volumeControlBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: '13px',
    fontWeight: 700,
    color: redTheme.colors.textSecondary,
  },
  sliderValue: {
    fontSize: '16px',
    fontWeight: 900,
    color: redTheme.colors.accentBright,
  },
  clampedNote: {
    fontSize: '12px',
    color: redTheme.colors.textMuted,
    fontWeight: 500,
  },
  rangeSlider: {
    width: '100%',
    accentColor: redTheme.colors.primary,
    height: '6px',
    cursor: 'pointer',
  },
  presetButtonsRow: {
    display: 'flex',
    gap: '8px',
  },
  presetChip: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  muteSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px',
    paddingTop: '16px',
    borderTop: `1px solid ${redTheme.colors.borderSubtle}`,
  },
  emergencyMuteButton: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid',
    fontSize: '13.5px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  muteTip: {
    fontSize: '11.5px',
    color: redTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: '1.4',
  },
  filterBlock: {
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '14px',
    padding: '16px',
    marginBottom: '20px',
  },
  filterTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  filterIcon: {
    fontSize: '24px',
  },
  filterName: {
    fontSize: '14px',
    color: redTheme.colors.textPrimary,
    display: 'block',
    marginBottom: '3px',
  },
  filterDesc: {
    fontSize: '12px',
    color: redTheme.colors.textMuted,
    margin: 0,
    lineHeight: '1.4',
  },
  activePill: {
    marginLeft: 'auto',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: redTheme.colors.statusOnAir,
    backgroundColor: redTheme.colors.statusOnAirBg,
    border: `1px solid ${redTheme.colors.statusOnAir}`,
    padding: '4px 8px',
    borderRadius: '8px',
  },
  limiterBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  limiterSpecsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '12px',
    padding: '14px',
  },
  limiterSpec: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: redTheme.colors.textSecondary,
  },
};

