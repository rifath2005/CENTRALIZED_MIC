import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { redTheme } from '../tokens/redTheme';

interface RoomQRCodeProps {
  roomCode: string;
  tokenServerUrl: string;
  onOpenFullScreen?: () => void;
}

export const RoomQRCode: React.FC<RoomQRCodeProps> = ({
  roomCode,
  tokenServerUrl,
  onOpenFullScreen,
}) => {
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);

  const webTransmitterUrl = `${tokenServerUrl.replace(/\/$/, '')}/mic?room=${encodeURIComponent(roomCode)}`;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedType('code');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.warn('[RoomQRCode] Clipboard error:', err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(webTransmitterUrl);
      setCopiedType('link');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.warn('[RoomQRCode] Clipboard error:', err);
    }
  };

  return (
    <div style={styles.container} role="region" aria-label="Smartphone Pairing">
      <div style={styles.qrWrapper} title="Scan with camera to connect instantly">
        <QRCodeSVG
          value={webTransmitterUrl}
          size={148}
          bgColor="#ffffff"
          fgColor="#000000"
          level="Q"
          includeMargin={true}
        />
      </div>

      <div style={styles.infoWrapper}>
        <div style={styles.badgeRow}>
          <span style={styles.label}>SMARTPHONE PAIRING</span>
          <span style={styles.qrScanPill}>SCAN OR ENTER</span>
        </div>

        <h2 style={styles.codeText} aria-label={`Room Code: ${roomCode}`}>{roomCode}</h2>

        <p style={styles.instructions}>
          Scan with iPhone or Android camera to speak in browser, or launch AirMic app.
        </p>

        <div style={styles.actionsRow}>
          <button
            style={styles.copyBtn}
            onClick={handleCopyCode}
            aria-label="Copy room code to clipboard"
          >
            {copiedType === 'code' ? '✓ Copied Code!' : '📋 Copy Code'}
          </button>
          <button
            style={styles.copyLinkBtn}
            onClick={handleCopyLink}
            title="Copy Web Transmitter URL"
            aria-label="Copy direct web transmitter link"
          >
            {copiedType === 'link' ? '✓ Copied Link!' : '🔗 Copy Web Link'}
          </button>
        </div>

        {onOpenFullScreen && (
          <button
            onClick={onOpenFullScreen}
            style={styles.fullScreenBtn}
            type="button"
            title="Present full size QR code and big room code on full laptop screen"
          >
            <span style={{ fontSize: '14px' }}>⤢</span>
            <span>PRESENT FULL SCREEN QR</span>
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    boxShadow: redTheme.shadows.card,
  },
  qrWrapper: {
    backgroundColor: redTheme.colors.bgSurfaceDark,
    padding: '12px',
    borderRadius: '12px',
    border: `1px solid ${redTheme.colors.borderMedium}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
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
    color: redTheme.colors.textSecondary,
    letterSpacing: '1px',
  },
  qrScanPill: {
    fontSize: '9px',
    fontWeight: 800,
    color: redTheme.colors.accentBright,
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
    border: `1px solid ${redTheme.colors.borderStrong}`,
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '0.8px',
  },
  codeText: {
    fontSize: '32px',
    fontWeight: 900,
    color: redTheme.colors.accentBright,
    letterSpacing: '3px',
    margin: 0,
    fontFamily: 'monospace',
    textShadow: '0 0 16px rgba(225, 29, 72, 0.35)',
  },
  instructions: {
    fontSize: '12px',
    color: redTheme.colors.textSecondary,
    lineHeight: '1.4',
    margin: 0,
  },
  actionsRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px',
  },
  copyBtn: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    color: redTheme.colors.textPrimary,
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  copyLinkBtn: {
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
    border: `1px solid ${redTheme.colors.borderStrong}`,
    color: redTheme.colors.accentBright,
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  fullScreenBtn: {
    backgroundColor: '#181d28',
    border: '1px solid #273244',
    color: '#f1f5f9',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '11px',
    fontFamily: 'monospace',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '6px',
    width: '100%',
    transition: 'all 0.15s ease',
  },
};
