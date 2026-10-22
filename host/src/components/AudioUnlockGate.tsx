import React from 'react';

interface AudioUnlockGateProps {
  isUnlocked: boolean;
  onUnlock: () => Promise<void>;
}

export const AudioUnlockGate: React.FC<AudioUnlockGateProps> = ({ isUnlocked, onUnlock }) => {
  if (isUnlocked) {
    return (
      <div style={styles.bannerUnlocked}>
        <span style={styles.dotUnlocked}></span>
        <span style={styles.textUnlocked}>
          PA Audio Pipeline Running (Web Audio Context Active, 48kHz interactive buffer)
        </span>
      </div>
    );
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.iconWrapper}>🔊</div>
        <h2 style={styles.modalTitle}>Browser Autoplay Protection</h2>
        <p style={styles.modalDescription}>
          Modern browsers block automatic audio output until an explicit user gesture is provided.
          Click below to initialize the Web Audio rendering pipeline and route incoming speech directly to the meeting room PA sound system.
        </p>
        <button style={styles.unlockButton} onClick={onUnlock}>
          START SESSION / UNMUTE SPEAKERS
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bannerUnlocked: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
    border: '1px solid #059669',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    color: '#34d399',
    fontWeight: 600,
  },
  dotUnlocked: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#34d399',
    boxShadow: '0 0 8px #34d399',
  },
  textUnlocked: {
    letterSpacing: '0.3px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(5, 9, 20, 0.92)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '16px',
    padding: '36px',
    maxWidth: '520px',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
  },
  iconWrapper: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  modalTitle: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#f8fafc',
    marginBottom: '12px',
  },
  modalDescription: {
    fontSize: '14px',
    color: '#94a3b8',
    lineHeight: '1.6',
    marginBottom: '28px',
  },
  unlockButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 24px',
    fontSize: '15px',
    fontWeight: 800,
    letterSpacing: '1px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
