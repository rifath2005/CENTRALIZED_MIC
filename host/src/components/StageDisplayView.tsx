import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SpeakerInfo, QueueEntry } from '../types';

interface StageDisplayViewProps {
  roomCode: string;
  tokenServerUrl: string;
  memberCount: number;
  currentSpeaker: SpeakerInfo | null;
  queue?: QueueEntry[];
  onBackToConsole: () => void;
}

export const StageDisplayView: React.FC<StageDisplayViewProps> = ({
  roomCode,
  tokenServerUrl,
  memberCount,
  currentSpeaker,
  queue = [],
  onBackToConsole,
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [elapsedSpeakerSeconds, setElapsedSpeakerSeconds] = useState(0);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Speaker timer
  useEffect(() => {
    if (!currentSpeaker) {
      setElapsedSpeakerSeconds(0);
      return;
    }
    const updateTime = () => {
      setElapsedSpeakerSeconds(Math.max(0, Math.floor((Date.now() - currentSpeaker.grantedAt) / 1000)));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [currentSpeaker]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('[StageDisplay] Fullscreen toggle error:', err);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('[StageDisplay] Copy error:', err);
    }
  };

  const pairingPayload = JSON.stringify({
    action: 'JOIN_MIC_ROOM',
    room: roomCode,
    server: tokenServerUrl,
  });

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        ...styles.container,
        backgroundColor: isHighContrast ? '#050208' : '#0d0515',
      }}
    >
      {/* Top Navigation & Projector Control Bar */}
      <header style={styles.topBar}>
        <div style={styles.topLeft}>
          <button style={styles.backButton} onClick={onBackToConsole}>
            ← OPERATOR CONSOLE
          </button>
          <div style={styles.screenShareBadge}>
            <span style={styles.lockIcon}>🔒</span>
            <span>AUDIENCE STAGE DISPLAY — SCREEN-SHARE SAFE</span>
          </div>
        </div>

        <div style={styles.topRight}>
          <button
            style={{
              ...styles.secondaryBtn,
              backgroundColor: isHighContrast ? '#f59e0b' : '#200f33',
              color: isHighContrast ? '#0d0515' : '#cbd5e1',
            }}
            onClick={() => setIsHighContrast(!isHighContrast)}
            title="Toggle high contrast for bright projector lamps"
          >
            {isHighContrast ? '☀️ Bright Room Mode' : '🌙 Dark Room Mode'}
          </button>

          <div style={styles.attendancePill}>
            <span className="pulse-marigold" style={styles.marigoldDot} />
            <span>{memberCount} {memberCount === 1 ? 'Attendee' : 'Attendees'} Connected</span>
          </div>

          <button style={styles.fullscreenButton} onClick={toggleFullscreen}>
            {isFullscreen ? '⤢ EXIT FULLSCREEN' : '⤡ FULL SCREEN DISPLAY'}
          </button>
        </div>
      </header>

      {/* Main Showcase Showcase */}
      <div
        style={{
          ...styles.showcaseCard,
          backgroundColor: isHighContrast ? '#11061c' : '#160a22',
          borderColor: isHighContrast ? '#5d2a90' : '#441e6a',
        }}
      >
        {/* On-Air Live Speaker Banner */}
        {currentSpeaker ? (
          <div style={styles.onAirBanner}>
            <div style={styles.onAirLeft}>
              <span className="pulse-marigold" style={styles.onAirDot} />
              <div>
                <span style={styles.onAirLabel}>LIVE ON AIR</span>
                <h3 style={styles.onAirSpeakerName}>{currentSpeaker.name}</h3>
              </div>
            </div>

            <div style={styles.onAirRight}>
              <div className="wave-container">
                <div className="wave-bar" />
                <div className="wave-bar" />
                <div className="wave-bar" />
                <div className="wave-bar" />
                <div className="wave-bar" />
              </div>
              <span style={styles.onAirTimer}>{formatTimer(elapsedSpeakerSeconds)}</span>
            </div>
          </div>
        ) : (
          <div style={styles.floorOpenBanner}>
            <div style={styles.floorOpenLeft}>
              <span style={styles.floorOpenIcon}>🎙️</span>
              <div>
                <span style={styles.floorOpenTitle}>FLOOR IS OPEN</span>
                <p style={styles.floorOpenSubtitle}>Scan the QR code below or enter the room code to request to speak.</p>
              </div>
            </div>
          </div>
        )}

        <div className="responsive-projector-grid" style={styles.contentGrid}>
          {/* Left: Giant High-Visibility Marigold QR Code */}
          <div style={styles.qrSection}>
            <div
              style={{
                ...styles.qrFrame,
                backgroundColor: isHighContrast ? '#ffffff' : '#0d0515',
                borderColor: '#f59e0b',
              }}
            >
              <QRCodeSVG
                value={pairingPayload}
                size={260}
                bgColor={isHighContrast ? '#ffffff' : '#0d0515'}
                fgColor={isHighContrast ? '#0d0515' : '#fbbf24'}
                level="Q"
                includeMargin={false}
              />
            </div>
            <span style={styles.qrScanLabel}>POINT SMARTPHONE CAMERA TO SCAN &amp; JOIN</span>
          </div>

          {/* Right: Room Code & Instructions */}
          <div className="responsive-projector-details" style={styles.detailsSection}>
            <span style={styles.subHeader}>CONFERENCE SOUND SYSTEM</span>
            <h1 style={styles.mainTitle}>Join Meeting Microphone</h1>

            {/* Room Code Banner */}
            <div style={styles.codeContainer}>
              <span style={styles.codeLabel}>MEETING ROOM CODE:</span>
              <div style={styles.codeBannerRow}>
                <div style={styles.codeBanner}>
                  <span style={styles.bigCodeText}>{roomCode}</span>
                </div>
                <button style={styles.copyCodeBtn} onClick={handleCopyCode}>
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>

            {/* Live Queue Preview (if any attendees are waiting) */}
            {queue.length > 0 && (
              <div style={styles.queuePreviewBox}>
                <div style={styles.queueHeader}>
                  <span style={styles.queueBadge}>UP NEXT TO SPEAK</span>
                  <span style={styles.queueCount}>{queue.length} in line</span>
                </div>
                <div style={styles.queueChipsList}>
                  {queue.slice(0, 4).map((entry, idx) => (
                    <span key={entry.id} style={styles.queueChip}>
                      <span style={styles.queueNum}>#{idx + 1}</span> {entry.name}
                    </span>
                  ))}
                  {queue.length > 4 && (
                    <span style={styles.queueMoreChip}>+{queue.length - 4} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Step-by-Step Instructions */}
            <div style={styles.instructionsList}>
              <div style={styles.stepItem}>
                <span style={styles.stepNumber}>1</span>
                <div>
                  <strong style={styles.stepTitle}>Scan QR Code:</strong> Open phone camera or Centralized Mic app.
                </div>
              </div>
              <div style={styles.stepItem}>
                <span style={styles.stepNumber}>2</span>
                <div>
                  <strong style={styles.stepTitle}>Auto-Connect:</strong> Joins room <code>{roomCode}</code> via ultra-low latency SFU.
                </div>
              </div>
              <div style={styles.stepItem}>
                <span style={styles.stepNumber}>3</span>
                <div>
                  <strong style={styles.stepTitle}>Speak into Phone:</strong> Hold the button to broadcast clearly through room speakers.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    color: '#f8fafc',
    padding: '24px 36px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    boxSizing: 'border-box',
    position: 'relative',
    transition: 'background-color 0.3s ease',
  },
  topBar: {
    width: '100%',
    maxWidth: '1180px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    gap: '12px',
    flexWrap: 'wrap',
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  backButton: {
    backgroundColor: '#200f33',
    color: '#cbd5e1',
    border: '1px solid #441e6a',
    borderRadius: '12px',
    padding: '10px 18px',
    fontSize: '12.5px',
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: '0.8px',
    transition: 'all 0.15s ease',
  },
  screenShareBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '12px',
    padding: '8px 14px',
    fontSize: '11px',
    fontWeight: 800,
    color: '#fbbf24',
    letterSpacing: '0.8px',
  },
  lockIcon: {
    fontSize: '13px',
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  secondaryBtn: {
    border: '1px solid #441e6a',
    borderRadius: '12px',
    padding: '10px 16px',
    fontSize: '12.5px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  attendancePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#200f33',
    border: '1px solid #441e6a',
    borderRadius: '12px',
    padding: '10px 16px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#cbd5e1',
  },
  marigoldDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#f59e0b',
  },
  fullscreenButton: {
    backgroundColor: '#f59e0b',
    color: '#0d0515',
    border: 'none',
    borderRadius: '12px',
    padding: '10px 18px',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
    letterSpacing: '0.8px',
    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
  },
  showcaseCard: {
    width: '100%',
    maxWidth: '1180px',
    border: '1px solid',
    borderRadius: '28px',
    padding: '44px 48px',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(68, 30, 106, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: '36px',
    transition: 'all 0.3s ease',
  },
  onAirBanner: {
    backgroundColor: '#200f33',
    border: '2px solid #f59e0b',
    borderRadius: '20px',
    padding: '20px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 0 25px rgba(245, 158, 11, 0.35)',
    gap: '16px',
    flexWrap: 'wrap',
  },
  onAirLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  onAirDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    backgroundColor: '#f59e0b',
  },
  onAirLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1.4px',
    color: '#fbbf24',
    display: 'block',
  },
  onAirSpeakerName: {
    fontSize: '26px',
    fontWeight: 900,
    color: '#f8fafc',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  onAirRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  onAirTimer: {
    fontFamily: 'monospace',
    fontSize: '28px',
    fontWeight: 900,
    color: '#fbbf24',
    letterSpacing: '1px',
  },
  floorOpenBanner: {
    backgroundColor: '#1b0c2b',
    border: '1px solid #441e6a',
    borderRadius: '18px',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
  },
  floorOpenLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  floorOpenIcon: {
    fontSize: '28px',
  },
  floorOpenTitle: {
    fontSize: '13px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    color: '#fbbf24',
    display: 'block',
  },
  floorOpenSubtitle: {
    fontSize: '13px',
    color: '#cbd5e1',
    margin: '2px 0 0 0',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '52px',
    alignItems: 'center',
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  qrFrame: {
    padding: '24px',
    borderRadius: '24px',
    border: '3px solid',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 25px rgba(245, 158, 11, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrScanLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    color: '#fbbf24',
    textAlign: 'center',
  },
  detailsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  subHeader: {
    fontSize: '11.5px',
    fontWeight: 800,
    letterSpacing: '1.6px',
    color: '#fbbf24',
    textTransform: 'uppercase',
  },
  mainTitle: {
    fontSize: '34px',
    fontWeight: 900,
    color: '#f8fafc',
    margin: 0,
    letterSpacing: '-0.8px',
  },
  codeContainer: {
    backgroundColor: '#200f33',
    border: '1px solid #441e6a',
    borderRadius: '20px',
    padding: '22px 26px',
  },
  codeLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    color: '#cbd5e1',
    display: 'block',
    marginBottom: '10px',
  },
  codeBannerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  codeBanner: {
    backgroundColor: '#0d0515',
    border: '2px solid #5d2a90',
    borderRadius: '16px',
    padding: '10px 24px',
  },
  bigCodeText: {
    fontSize: '32px',
    fontWeight: 900,
    color: '#f8fafc',
    letterSpacing: '2px',
  },
  copyCodeBtn: {
    backgroundColor: '#2c1445',
    color: '#fbbf24',
    border: '1px solid #5d2a90',
    borderRadius: '14px',
    padding: '14px 22px',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  queuePreviewBox: {
    backgroundColor: '#1b0c2b',
    border: '1px solid #3b195c',
    borderRadius: '16px',
    padding: '16px 20px',
  },
  queueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  queueBadge: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#fbbf24',
    letterSpacing: '1px',
  },
  queueCount: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 600,
  },
  queueChipsList: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  queueChip: {
    backgroundColor: '#200f33',
    border: '1px solid #441e6a',
    borderRadius: '10px',
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#f8fafc',
  },
  queueNum: {
    color: '#fbbf24',
    marginRight: '4px',
  },
  queueMoreChip: {
    backgroundColor: '#200f33',
    borderRadius: '10px',
    padding: '6px 12px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  instructionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    fontSize: '14px',
    color: '#cbd5e1',
  },
  stepNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#2c1445',
    border: '1px solid #5d2a90',
    color: '#fbbf24',
    fontSize: '12.5px',
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepTitle: {
    color: '#f8fafc',
  },
};
