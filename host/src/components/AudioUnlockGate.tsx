import React, { useState } from 'react';

interface AudioUnlockGateProps {
  isUnlocked: boolean;
  onUnlock: () => Promise<void>;
}

export const AudioUnlockGate: React.FC<AudioUnlockGateProps> = ({ isUnlocked, onUnlock }) => {
  const [isActivating, setIsActivating] = useState(false);

  // When unlocked, return null so it doesn't pollute the layout or projector view
  if (isUnlocked) {
    return null;
  }

  const handleStart = async () => {
    try {
      setIsActivating(true);
      await onUnlock();
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.iconWrapper}>🔊</div>
        <div style={styles.badge}>AUTOPLAY PROTECTION REQUIRED</div>
        <h2 style={styles.modalTitle}>Activate PA Audio Pipeline</h2>
        <p style={styles.modalDescription}>
          Web browsers require an explicit user gesture before routing incoming WebRTC microphone streams
          to your meeting room PA system or external soundcard.
        </p>

        <div style={styles.checklist}>
          <div style={styles.checkItem}>
            <span style={styles.checkIcon}>✓</span>
            <span>Initializes 48kHz interactive low-latency audio buffer</span>
          </div>
          <div style={styles.checkItem}>
            <span style={styles.checkIcon}>✓</span>
            <span>Arms 80Hz rumble highpass filter &amp; 3ms peak limiter</span>
          </div>
          <div style={styles.checkItem}>
            <span style={styles.checkIcon}>✓</span>
            <span>Connects directly to LiveKit SFU receiver</span>
          </div>
        </div>

        <button
          style={{
            ...styles.unlockButton,
            opacity: isActivating ? 0.7 : 1,
            cursor: isActivating ? 'wait' : 'pointer',
          }}
          onClick={handleStart}
          disabled={isActivating}
        >
          {isActivating ? 'STARTING AUDIO PIPELINE...' : 'START SESSION & UNMUTE SPEAKERS'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(5, 9, 20, 0.94)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '20px',
    padding: '40px 36px',
    maxWidth: '520px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
  },
  iconWrapper: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  badge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    padding: '4px 12px',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.5px',
    marginBottom: '12px',
  },
  modalDescription: {
    fontSize: '14px',
    color: '#94a3b8',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  checklist: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '28px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '12px',
    color: '#cbd5e1',
    fontWeight: 500,
  },
  checkIcon: {
    color: '#34d399',
    fontWeight: 800,
  },
  unlockButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 24px',
    fontSize: '14px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
    transition: 'all 0.2s ease',
  },
};
