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
          bgColor="#090d16"
          fgColor="#38bdf8"
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
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
  },
  qrWrapper: {
    backgroundColor: '#090d16',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
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
    color: '#94a3b8',
    letterSpacing: '1px',
  },
  qrScanPill: {
    fontSize: '9px',
    fontWeight: 800,
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.8px',
  },
  codeText: {
    fontSize: '30px',
    fontWeight: 900,
    color: '#38bdf8',
    letterSpacing: '3px',
    margin: 0,
    fontFamily: 'monospace',
  },
  instructions: {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.4',
    margin: 0,
  },
  actionsRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px',
  },
  copyBtn: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#cbd5e1',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  copyLinkBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};
