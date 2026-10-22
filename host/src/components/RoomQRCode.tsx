import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface RoomQRCodeProps {
  roomCode: string;
  tokenServerUrl: string;
}

export const RoomQRCode: React.FC<RoomQRCodeProps> = ({ roomCode, tokenServerUrl }) => {
  // Deep link or pairing payload for phone QR scanner
  const pairingPayload = JSON.stringify({
    action: 'JOIN_MIC_ROOM',
    room: roomCode,
    server: tokenServerUrl,
  });

  return (
    <div style={styles.container}>
      <div style={styles.qrWrapper}>
        <QRCodeSVG
          value={pairingPayload}
          size={160}
          bgColor="#0f172a"
          fgColor="#38bdf8"
          level="M"
          includeMargin={false}
        />
      </div>

      <div style={styles.infoWrapper}>
        <span style={styles.label}>PAIRING ROOM CODE</span>
        <h2 style={styles.codeText}>{roomCode}</h2>
        <p style={styles.instructions}>
          Scan with smartphone camera or enter room code in the Wireless Mic app.
        </p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  qrWrapper: {
    backgroundColor: '#0f172a',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '1px',
  },
  codeText: {
    fontSize: '32px',
    fontWeight: 900,
    color: '#38bdf8',
    letterSpacing: '3px',
    margin: 0,
    fontFamily: 'monospace',
  },
  instructions: {
    fontSize: '12px',
    color: '#94a3b8',
    lineHeight: '1.5',
    maxWidth: '240px',
    margin: '4px 0 0 0',
  },
};
