import React, { useState, useEffect, useCallback } from 'react';
import { AudioOutputDeviceInfo } from '../types';
import { redTheme } from '../tokens/redTheme';

interface DeviceSelectorProps {
  onSelectDevice: (deviceId: string) => Promise<void>;
  onPlayTestTone?: () => void;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  onSelectDevice,
  onPlayTestTone,
}) => {
  const [devices, setDevices] = useState<AudioOutputDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('default');
  const [isTesting, setIsTesting] = useState(false);
  const [supportsSetSinkId, setSupportsSetSinkId] = useState(true);

  const loadAudioOutputs = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setSupportsSetSinkId(false);
        return;
      }
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const outputs = allDevices
        .filter((d) => d.kind === 'audiooutput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Audio Output ${index + 1}`,
        }));

      setDevices(outputs);
    } catch (err) {
      console.warn('[DeviceSelector] Could not enumerate audio output devices:', err);
    }
  }, []);

  useEffect(() => {
    loadAudioOutputs();
    navigator.mediaDevices?.addEventListener('devicechange', loadAudioOutputs);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', loadAudioOutputs);
    };
  }, [loadAudioOutputs]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const devId = e.target.value;
    setSelectedDevice(devId);
    await onSelectDevice(devId);
  };

  const handleTestSound = () => {
    if (onPlayTestTone) {
      setIsTesting(true);
      onPlayTestTone();
      setTimeout(() => setIsTesting(false), 500);
    }
  };

  return (
    <div style={styles.container} role="region" aria-label="Audio Output Device Routing">
      <div style={styles.labelRow}>
        <label htmlFor="audio-output-select" style={styles.label}>PA / SOUND SYSTEM ROUTING</label>
        <button
          type="button"
          style={styles.refreshBtn}
          onClick={loadAudioOutputs}
          title="Scan for plugged in USB/Dante interfaces"
          aria-label="Rescan audio devices"
        >
          🔄 Rescan
        </button>
      </div>

      <div style={styles.controlRow}>
        <select
          id="audio-output-select"
          style={styles.select}
          value={selectedDevice}
          onChange={handleChange}
          aria-label="Sound System Audio Output"
        >
          <option value="default">Default System Audio Output</option>
          {devices.map((dev) => (
            <option key={dev.deviceId} value={dev.deviceId}>
              {dev.label}
            </option>
          ))}
        </select>

        {onPlayTestTone && (
          <button
            type="button"
            style={{
              ...styles.testBtn,
              backgroundColor: isTesting ? redTheme.colors.primary : redTheme.colors.bgSurfaceElevated,
              borderColor: isTesting ? redTheme.colors.primaryHover : redTheme.colors.borderMedium,
              color: isTesting ? redTheme.colors.textOnPrimary : redTheme.colors.accentBright,
            }}
            onClick={handleTestSound}
            title="Play double chime tone through selected speakers"
            aria-label="Test speaker sound output"
          >
            {isTesting ? '🔊 Playing...' : '🔔 Test Speakers'}
          </button>
        )}
      </div>

      {!supportsSetSinkId && (
        <span style={styles.warningNote}>
          Hardware output routing requires Chrome/Edge with HTTPS. System default output used.
        </span>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: '11px',
    fontWeight: 800,
    color: redTheme.colors.textSecondary,
    letterSpacing: '1px',
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    color: redTheme.colors.accentBright,
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  controlRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  select: {
    flex: 1,
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '8px',
    padding: '10px 14px',
    color: redTheme.colors.textPrimary,
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  testBtn: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: `1px solid ${redTheme.colors.borderMedium}`,
    color: redTheme.colors.accentBright,
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  warningNote: {
    fontSize: '11px',
    color: redTheme.colors.accentBright,
    lineHeight: '1.4',
  },
};
