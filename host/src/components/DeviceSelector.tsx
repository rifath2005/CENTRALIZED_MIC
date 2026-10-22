import React, { useState, useEffect, useCallback } from 'react';
import { AudioOutputDeviceInfo } from '../types';

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
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <label style={styles.label}>PA / SOUND SYSTEM ROUTING</label>
        <button
          type="button"
          style={styles.refreshBtn}
          onClick={loadAudioOutputs}
          title="Scan for plugged in USB/Dante interfaces"
        >
          🔄 Rescan
        </button>
      </div>

      <div style={styles.controlRow}>
        <select
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
              backgroundColor: isTesting ? '#f59e0b' : '#2c1445',
              borderColor: isTesting ? '#fbbf24' : '#5d2a90',
              color: isTesting ? '#0d0515' : '#fbbf24',
            }}
            onClick={handleTestSound}
            title="Play double chime tone through selected speakers"
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
    color: '#cbd5e1',
    letterSpacing: '1px',
  },
  refreshBtn: {
    background: 'none',
    border: 'none',
    color: '#fbbf24',
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
    backgroundColor: '#160a22',
    border: '1px solid #441e6a',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  testBtn: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #5d2a90',
    color: '#fbbf24',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  warningNote: {
    fontSize: '11px',
    color: '#fbbf24',
    lineHeight: '1.4',
  },
};
