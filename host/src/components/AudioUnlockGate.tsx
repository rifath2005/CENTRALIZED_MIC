import React, { useState } from 'react';
import { redTheme } from '../tokens/redTheme';

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
    <div
      style={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-gate-title"
      aria-describedby="audio-gate-desc"
    >
      <div style={styles.modalContent}>
        <div style={styles.iconWrapper} aria-hidden="true">🔊</div>
        <div style={styles.badge}>AUTOPLAY PROTECTION REQUIRED</div>
        <h2 id="audio-gate-title" style={styles.modalTitle}>Activate PA Audio Pipeline</h2>
        <p id="audio-gate-desc" style={styles.modalDescription}>
          Web browsers require an explicit user gesture before routing incoming WebRTC microphone streams
          to your meeting room PA system or external soundcard.
        </p>

        <div style={styles.checklist}>
          <div style={styles.checkItem}>
            <span style={styles.checkIcon} aria-hidden="true">✓</span>
            <span>Initializes 48kHz interactive low-latency audio buffer</span>
          </div>
          <div style={styles.checkItem}>
            <span style={styles.checkIcon} aria-hidden="true">✓</span>
            <span>Arms 80Hz rumble highpass filter &amp; 3ms peak limiter</span>
          </div>
          <div style={styles.checkItem}>
            <span style={styles.checkIcon} aria-hidden="true">✓</span>
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
          autoFocus
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
    backgroundColor: redTheme.colors.bgSurfaceOverlay,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '24px',
    padding: '44px 36px',
    maxWidth: '520px',
    width: '100%',
    textAlign: 'center',
    boxShadow: `0 25px 60px rgba(0, 0, 0, 0.9), ${redTheme.shadows.glowPrimary}`,
  },
  iconWrapper: {
    fontSize: '52px',
    marginBottom: '16px',
    filter: 'drop-shadow(0 0 18px rgba(225, 29, 72, 0.5))',
  },
  badge: {
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    color: redTheme.colors.accentBright,
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
    border: `1px solid ${redTheme.colors.borderStrong}`,
    padding: '5px 14px',
    borderRadius: '14px',
    marginBottom: '16px',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: 900,
    color: redTheme.colors.textPrimary,
    letterSpacing: '-0.5px',
    marginBottom: '12px',
  },
  modalDescription: {
    fontSize: '14px',
    color: redTheme.colors.textSecondary,
    lineHeight: '1.6',
    marginBottom: '26px',
  },
  checklist: {
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
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
    color: redTheme.colors.textSecondary,
    fontWeight: 500,
  },
  checkIcon: {
    color: redTheme.colors.primaryHover,
    fontWeight: 900,
    fontSize: '14px',
  },
  unlockButton: {
    width: '100%',
    backgroundColor: redTheme.colors.primary,
    color: redTheme.colors.textOnPrimary,
    border: 'none',
    borderRadius: '14px',
    padding: '16px 24px',
    fontSize: '14px',
    fontWeight: 900,
    letterSpacing: '0.9px',
    boxShadow: redTheme.shadows.glowPrimary,
    transition: 'all 0.18s ease',
  },
};
