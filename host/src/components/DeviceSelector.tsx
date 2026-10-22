import React, { useState, useEffect } from 'react';
import { AudioOutputDeviceInfo } from '../types';

interface DeviceSelectorProps {
  onSelectDevice: (deviceId: string) => Promise<void>;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({ onSelectDevice }) => {
  const [devices, setDevices] = useState<AudioOutputDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('default');

  useEffect(() => {
    async function loadAudioOutputs() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
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
    }

    loadAudioOutputs();
    navigator.mediaDevices?.addEventListener('devicechange', loadAudioOutputs);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', loadAudioOutputs);
    };
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const devId = e.target.value;
    setSelectedDevice(devId);
    await onSelectDevice(devId);
  };

  return (
    <div style={styles.container}>
      <label style={styles.label}>PA / SOUND SYSTEM OUTPUT</label>
      <select style={styles.select} value={selectedDevice} onChange={handleChange}>
        <option value="default">Default System Audio Output</option>
        {devices.map((dev) => (
          <option key={dev.deviceId} value={dev.deviceId}>
            {dev.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '1px',
  },
  select: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
};
