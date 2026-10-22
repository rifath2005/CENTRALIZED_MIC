import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface RoomQRCodeProps {
  roomCode: string;
  tokenServerUrl: string;
}

export const RoomQRCode: React.FC<RoomQRCodeProps> = ({ roomCode, tokenServerUrl }) => {
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

  const pairingPayload = JSON.stringify({
    action: 'JOIN_MIC_ROOM',
    room: roomCode,
    server: tokenServerUrl,
  });

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedType('code');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.warn('[RoomQRCode] Clipboard error:', err);
    }
  };

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(pairingPayload);
      setCopiedType('link');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.warn('[RoomQRCode] Clipboard error:', err);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.qrWrapper} title="Scan with camera to connect instantly">
        <QRCodeSVG
          value={pairingPayload}
          size={148}
          bgColor="#160a22"
          fgColor="#fbbf24"
          level="M"
          includeMargin={false}
        />
      </div>

      <div style={styles.infoWrapper}>
        <div style={styles.badgeRow}>
          <span style={styles.label}>SMARTPHONE PAIRING</span>
          <span style={styles.qrScanPill}>SCAN OR ENTER</span>
        </div>

        <h2 style={styles.codeText}>{roomCode}</h2>

        <p style={styles.instructions}>
          Scan with smartphone camera or launch Wireless Mic app.
        </p>

        <div style={styles.actionsRow}>
          <button style={styles.copyBtn} onClick={handleCopyCode}>
            {copiedType === 'code' ? '✓ Copied Code!' : '📋 Copy Code'}
          </button>
          <button style={styles.copyLinkBtn} onClick={handleCopyPayload} title="Copy JSON pairing data">
            {copiedType === 'link' ? '✓ Copied Config!' : '🔗 Copy Config'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#200f33',
    border: '1px solid #441e6a',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    boxShadow: '0 8px 30px rgba(13, 5, 21, 0.45)',
  },
  qrWrapper: {
    backgroundColor: '#160a22',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #441e6a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
  infoWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
    minWidth: '200px',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#cbd5e1',
    letterSpacing: '1px',
  },
  qrScanPill: {
    fontSize: '9px',
    fontWeight: 800,
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '0.8px',
  },
  codeText: {
    fontSize: '32px',
    fontWeight: 900,
    color: '#fbbf24',
    letterSpacing: '3px',
    margin: 0,
    fontFamily: 'monospace',
    textShadow: '0 0 16px rgba(251, 191, 36, 0.3)',
  },
  instructions: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: '1.4',
    margin: 0,
  },
  actionsRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px',
  },
  copyBtn: {
    backgroundColor: '#2c1445',
    border: '1px solid #5d2a90',
    color: '#f8fafc',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  copyLinkBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#fbbf24',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
