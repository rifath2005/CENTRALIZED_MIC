import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { redTheme } from '../tokens/redTheme';

interface RoomQRCodeProps {
  roomCode: string;
  tokenServerUrl: string;
  publicOnlineUrl?: string;
  onOpenFullScreen?: () => void;
}

export const RoomQRCode: React.FC<RoomQRCodeProps> = ({
  roomCode,
  tokenServerUrl,
  publicOnlineUrl = 'https://centralized-mic-token-server.onrender.com',
  onOpenFullScreen,
}) => {
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [linkMode, setLinkMode] = useState<'online' | 'local'>('online');

  const resolvedBaseUrl = linkMode === 'online'
    ? (publicOnlineUrl || 'https://centralized-mic-token-server.onrender.com').replace(/\/$/, '')
    : tokenServerUrl.replace(/\/$/, '');

  const webTransmitterUrl = `${resolvedBaseUrl}/mic?room=${encodeURIComponent(roomCode)}`;

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
      {/* Mode Switcher Pill: Online (HTTPS Cloud) vs Local LAN */}
      <div style={styles.modeToggleRow}>
        <button
          type="button"
          onClick={() => setLinkMode('online')}
          style={{
            ...styles.modeToggleBtn,
            ...(linkMode === 'online' ? styles.modeToggleActiveOnline : styles.modeToggleInactive),
          }}
          title="Online HTTPS mode: Works globally over 4G/5G & Wi-Fi with instant mic permissions"
        >
          <span>🌐 Online Cloud (HTTPS)</span>
          {linkMode === 'online' && <span style={styles.activeDotOnline} />}
        </button>

        <button
          type="button"
          onClick={() => setLinkMode('local')}
          style={{
            ...styles.modeToggleBtn,
            ...(linkMode === 'local' ? styles.modeToggleActiveLocal : styles.modeToggleInactive),
          }}
          title="Local LAN mode: Connects over local subnet (Note: Mobile browsers may block mic on insecure HTTP)"
        >
          <span>🏠 Local Wi-Fi (LAN)</span>
        </button>
      </div>

      <div style={styles.mainRow}>
        <div style={styles.qrWrapper} title={`Scan with camera to connect via ${linkMode === 'online' ? 'Online Cloud HTTPS' : 'Local Wi-Fi'}`}>
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
            {linkMode === 'online' ? (
              <span style={styles.qrOnlinePill}>🟢 ONLINE (HTTPS)</span>
            ) : (
              <span style={styles.qrLocalPill}>⚠️ LOCAL (HTTP)</span>
            )}
          </div>

          <h2 style={styles.codeText} aria-label={`Room Code: ${roomCode}`}>{roomCode}</h2>

          <p style={styles.instructions}>
            {linkMode === 'online'
              ? 'Scan with iPhone or Android camera to open secure online mic from any network (4G/5G or Wi-Fi).'
              : 'Scan to connect over local Wi-Fi. (Note: iOS/Android browsers require HTTPS for microphone capture).'}
          </p>

          {/* Direct URL text display */}
          <div style={styles.urlBox} title={webTransmitterUrl}>
            <span style={styles.urlText}>{webTransmitterUrl}</span>
          </div>

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
              {copiedType === 'link' ? '✓ Copied Link!' : '🔗 Copy Online Link'}
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
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '14px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: redTheme.shadows.card,
  },
  modeToggleRow: {
    display: 'flex',
    gap: '6px',
    backgroundColor: '#0a0d14',
    padding: '4px',
    borderRadius: '10px',
    border: '1px solid #1f2735',
  },
  modeToggleBtn: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: '7px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.15s ease',
  },
  modeToggleActiveOnline: {
    backgroundColor: '#064e3b',
    color: '#34d399',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
  },
  modeToggleActiveLocal: {
    backgroundColor: '#78350f',
    color: '#fbbf24',
    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
  },
  modeToggleInactive: {
    backgroundColor: 'transparent',
    color: '#64748b',
  },
  activeDotOnline: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    display: 'inline-block',
  },
  mainRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
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
  qrOnlinePill: {
    fontSize: '9px',
    fontWeight: 800,
    color: '#34d399',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '0.8px',
  },
  qrLocalPill: {
    fontSize: '9px',
    fontWeight: 800,
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '0.8px',
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
    fontSize: '11px',
    color: redTheme.colors.textSecondary,
    lineHeight: '1.4',
    margin: 0,
  },
  urlBox: {
    backgroundColor: '#080a0e',
    border: '1px solid #1f2735',
    borderRadius: '6px',
    padding: '4px 8px',
    overflow: 'hidden',
    marginTop: '2px',
  },
  urlText: {
    fontSize: '10px',
    fontFamily: 'monospace',
    color: '#38bdf8',
    wordBreak: 'break-all',
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
