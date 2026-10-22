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
    backgroundColor: 'rgba(13, 5, 21, 0.95)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: '#1b0c2b',
    border: '1px solid #441e6a',
    borderRadius: '24px',
    padding: '44px 36px',
    maxWidth: '520px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(68, 30, 106, 0.3)',
  },
  iconWrapper: {
    fontSize: '52px',
    marginBottom: '16px',
    filter: 'drop-shadow(0 0 16px rgba(245, 158, 11, 0.4))',
  },
  badge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    padding: '5px 14px',
    borderRadius: '14px',
    marginBottom: '16px',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: 900,
    color: '#f8fafc',
    letterSpacing: '-0.5px',
    marginBottom: '12px',
  },
  modalDescription: {
    fontSize: '14px',
    color: '#cbd5e1',
    lineHeight: '1.6',
    marginBottom: '26px',
  },
  checklist: {
    backgroundColor: '#130820',
    border: '1px solid #3b195c',
    borderRadius: '16px',
    padding: '18px',
    marginBottom: '30px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '12.5px',
    color: '#e2e8f0',
    fontWeight: 500,
  },
  checkIcon: {
    color: '#f59e0b',
    fontWeight: 900,
    fontSize: '14px',
  },
  unlockButton: {
    width: '100%',
    backgroundColor: '#f59e0b',
    color: '#0d0515',
    border: 'none',
    borderRadius: '14px',
    padding: '16px 24px',
    fontSize: '14px',
    fontWeight: 900,
    letterSpacing: '0.9px',
    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.45)',
    transition: 'all 0.2s ease',
  },
};
