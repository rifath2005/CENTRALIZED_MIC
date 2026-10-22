import React from 'react';
import { AudioProcessingGraph, HARD_VOLUME_CEILING } from '../audio/AudioProcessingGraph';
import { DeviceSelector } from './DeviceSelector';
import { LevelMeter } from './LevelMeter';

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
                    backgroundColor: volume === preset ? '#f59e0b' : '#2c1445',
                    color: volume === preset ? '#0d0515' : '#cbd5e1',
                    borderColor: volume === preset ? '#fbbf24' : '#441e6a',
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
                  backgroundColor: isEmergencyMuted ? '#f43f5e' : 'rgba(244, 63, 94, 0.15)',
                  borderColor: isEmergencyMuted ? '#f43f5e' : '#f43f5e',
                  color: isEmergencyMuted ? '#ffffff' : '#f43f5e',
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
    backgroundColor: '#160a22',
    border: '1px solid #441e6a',
    borderRadius: '20px',
    padding: '28px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    boxShadow: '0 8px 32px rgba(13, 5, 21, 0.6)',
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
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    padding: '4px 12px',
    borderRadius: '12px',
  },
  internalBadge: {
    fontSize: '10.5px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: '#cbd5e1',
    backgroundColor: 'rgba(203, 213, 225, 0.1)',
    border: '1px solid rgba(203, 213, 225, 0.2)',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 900,
    color: '#f8fafc',
    letterSpacing: '-0.5px',
    marginBottom: '8px',
  },
  description: {
    fontSize: '13.5px',
    color: '#94a3b8',
    lineHeight: '1.6',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  testToneBtn: {
    backgroundColor: '#2c1445',
    color: '#fbbf24',
    border: '1px solid #5d2a90',
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
    backgroundColor: '#1b0c2b',
    border: '1px solid #441e6a',
    borderRadius: '20px',
    padding: '26px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  cardHeader: {
    marginBottom: '16px',
  },
  cardBadge: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: '#cbd5e1',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: 800,
    color: '#f8fafc',
    marginTop: '4px',
    marginBottom: '6px',
  },
  cardHelp: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: '1.5',
    marginBottom: '16px',
  },
  meterSpecs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #341852',
  },
  specItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  specLabel: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  specVal: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#e2e8f0',
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
    color: '#cbd5e1',
  },
  sliderValue: {
    fontSize: '16px',
    fontWeight: 900,
    color: '#f59e0b',
  },
  clampedNote: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 500,
  },
  rangeSlider: {
    width: '100%',
    accentColor: '#f59e0b',
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
    borderTop: '1px solid #341852',
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
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: '1.4',
  },
  filterBlock: {
    backgroundColor: '#130820',
    border: '1px solid #341852',
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
    color: '#f8fafc',
    display: 'block',
    marginBottom: '3px',
  },
  filterDesc: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.4',
  },
  activePill: {
    marginLeft: 'auto',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
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
    backgroundColor: '#130820',
    border: '1px solid #341852',
    borderRadius: '12px',
    padding: '14px',
  },
  limiterSpec: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#cbd5e1',
  },
};
