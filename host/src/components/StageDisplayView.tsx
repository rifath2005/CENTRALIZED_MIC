import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SpeakerInfo, QueueEntry } from '../types';
import { redTheme } from '../tokens/redTheme';

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

  const webTransmitterUrl = `${tokenServerUrl.replace(/\/$/, '')}/mic?room=${encodeURIComponent(roomCode)}`;

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // High Contrast vs Dark Room color mapping
  const currentBg = isHighContrast ? redTheme.colors.brightMode.bg : redTheme.colors.bgDeepest;
  const cardBg = isHighContrast ? redTheme.colors.brightMode.surface : redTheme.colors.bgSurfaceCard;
  const cardBorder = isHighContrast ? redTheme.colors.brightMode.surfaceBorder : redTheme.colors.borderMedium;
  const primaryText = isHighContrast ? redTheme.colors.brightMode.textPrimary : redTheme.colors.textPrimary;
  const secondaryText = isHighContrast ? redTheme.colors.brightMode.textSecondary : redTheme.colors.textSecondary;
  const accentColor = isHighContrast ? redTheme.colors.brightMode.accent : redTheme.colors.accentBright;

  return (
    <div
      style={{
        ...styles.container,
        backgroundColor: currentBg,
        color: primaryText,
      }}
      role="region"
      aria-label="Audience Stage Display"
    >
      {/* WEB-ST-01: StageProjectorTopBar */}
      <header style={styles.topBar}>
        <div style={styles.topLeft}>
          <button
            style={{
              ...styles.backButton,
              color: isHighContrast ? '#881337' : redTheme.colors.textSecondary,
              borderColor: isHighContrast ? '#f43f5e' : redTheme.colors.borderMedium,
              backgroundColor: isHighContrast ? '#fff' : redTheme.colors.bgSurfaceDark,
            }}
            onClick={onBackToConsole}
            aria-label="Return to Operator Console"
          >
            ← OPERATOR CONSOLE
          </button>
          <div
            style={{
              ...styles.screenShareBadge,
              backgroundColor: isHighContrast ? '#ffe4e6' : 'rgba(225, 29, 72, 0.12)',
              borderColor: isHighContrast ? '#f43f5e' : redTheme.colors.borderStrong,
              color: isHighContrast ? '#881337' : redTheme.colors.accentLight,
            }}
          >
            <span style={styles.lockIcon} aria-hidden="true">🔒</span>
            <span>AUDIENCE STAGE DISPLAY — SCREEN-SHARE SAFE</span>
          </div>
        </div>

        <div style={styles.topRight}>
          {/* WEB-ST-02: StageContrastToggle */}
          <button
            style={{
              ...styles.secondaryBtn,
              backgroundColor: isHighContrast ? redTheme.colors.primary : redTheme.colors.bgSurfaceElevated,
              color: isHighContrast ? '#ffffff' : redTheme.colors.textSecondary,
              borderColor: isHighContrast ? redTheme.colors.primaryHover : redTheme.colors.borderMedium,
            }}
            onClick={() => setIsHighContrast(!isHighContrast)}
            title="Toggle contrast mode for bright auditorium projectors"
            aria-label={isHighContrast ? 'Switch to Dark Room Mode' : 'Switch to Bright Room Mode'}
          >
            {isHighContrast ? '☀️ Bright Room Mode' : '🌙 Dark Room Mode'}
          </button>

          <div
            style={{
              ...styles.attendancePill,
              backgroundColor: isHighContrast ? '#ffe4e6' : redTheme.colors.bgSurfaceDark,
              borderColor: isHighContrast ? '#f43f5e' : redTheme.colors.borderMedium,
              color: isHighContrast ? '#881337' : redTheme.colors.textSecondary,
            }}
          >
            <span className="pulse-red" style={styles.redDot} aria-hidden="true" />
            <span>{memberCount} {memberCount === 1 ? 'Attendee' : 'Attendees'} Connected</span>
          </div>

          <button
            style={{
              ...styles.fullscreenButton,
              backgroundColor: isHighContrast ? '#881337' : redTheme.colors.primary,
            }}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? '⤢ EXIT FULLSCREEN' : '⤡ FULL SCREEN DISPLAY'}
          </button>
        </div>
      </header>

      {/* Main Showcase Card */}
      <div
        style={{
          ...styles.showcaseCard,
          backgroundColor: cardBg,
          borderColor: cardBorder,
        }}
      >
        {/* WEB-ST-05: StageSpeakerHero */}
        {currentSpeaker ? (
          <div
            style={{
              ...styles.onAirBanner,
              backgroundColor: isHighContrast ? '#ecfdf5' : 'rgba(16, 185, 129, 0.16)',
              borderColor: '#10b981',
            }}
            aria-live="assertive"
          >
            <div style={styles.onAirLeft}>
              <span className="pulse-red" style={{ ...styles.onAirDot, backgroundColor: '#10b981', boxShadow: '0 0 14px #10b981' }} aria-hidden="true" />
              <div>
                <span style={{ ...styles.onAirLabel, color: isHighContrast ? '#065f46' : '#6ee7b7' }}>LIVE ON AIR</span>
                <h3 style={{ ...styles.onAirSpeakerName, color: isHighContrast ? '#064e3b' : '#ffffff' }}>{currentSpeaker.name}</h3>
              </div>
            </div>

            <div style={styles.onAirRight}>
              <div className="wave-container" aria-hidden="true">
                <div className="wave-bar" style={{ backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                <div className="wave-bar" style={{ backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                <div className="wave-bar" style={{ backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                <div className="wave-bar" style={{ backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                <div className="wave-bar" style={{ backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              </div>
              <span style={{ ...styles.onAirTimer, color: isHighContrast ? '#065f46' : '#a7f3d0' }}>{formatTimer(elapsedSpeakerSeconds)}</span>
            </div>
          </div>
        ) : (
          <div
            style={{
              ...styles.floorOpenBanner,
              backgroundColor: isHighContrast ? '#fff1f2' : redTheme.colors.bgSurfaceDark,
              borderColor: isHighContrast ? '#fecdd3' : redTheme.colors.borderMedium,
            }}
            aria-live="polite"
          >
            <div style={styles.floorOpenLeft}>
              <span style={styles.floorOpenIcon} aria-hidden="true">🎙️</span>
              <div>
                <span style={{ ...styles.floorOpenTitle, color: accentColor }}>FLOOR IS OPEN</span>
                <p style={{ ...styles.floorOpenSubtitle, color: secondaryText }}>
                  Scan the QR code below or enter the room code to request to speak.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="responsive-projector-grid" style={styles.contentGrid}>
          {/* WEB-ST-03: StageGiantQRCode */}
          <div style={styles.qrSection}>
            <div
              style={{
                ...styles.qrFrame,
                backgroundColor: isHighContrast ? '#ffffff' : redTheme.colors.bgDeepest,
                borderColor: isHighContrast ? '#be123c' : redTheme.colors.primary,
                boxShadow: isHighContrast ? '0 12px 30px rgba(190, 18, 60, 0.2)' : redTheme.shadows.glowPrimary,
              }}
            >
              <QRCodeSVG
                value={webTransmitterUrl}
                size={260}
                bgColor={isHighContrast ? '#ffffff' : redTheme.colors.bgDeepest}
                fgColor={isHighContrast ? '#881337' : redTheme.colors.accentBright}
                level="Q"
                includeMargin={false}
              />
            </div>
            <span
              style={{
                ...styles.qrScanLabel,
                color: accentColor,
              }}
            >
              POINT SMARTPHONE CAMERA TO SCAN &amp; JOIN
            </span>
          </div>

          {/* Right: Room Code & Instructions */}
          <div className="responsive-projector-details" style={styles.detailsSection}>
            <span style={{ ...styles.subHeader, color: isHighContrast ? '#9f1239' : redTheme.colors.accentBright }}>
              CONFERENCE SOUND SYSTEM
            </span>
            <h1 style={{ ...styles.mainTitle, color: primaryText }}>
              Join Meeting Microphone
            </h1>

            {/* WEB-ST-04: StageRoomCodeBanner */}
            <div style={styles.codeContainer}>
              <span style={{ ...styles.codeLabel, color: secondaryText }}>MEETING ROOM CODE:</span>
              <div style={styles.codeBannerRow}>
                <div
                  style={{
                    ...styles.codeBanner,
                    backgroundColor: isHighContrast ? '#ffe4e6' : redTheme.colors.bgSurfaceDark,
                    borderColor: isHighContrast ? '#f43f5e' : redTheme.colors.borderStrong,
                  }}
                >
                  <span
                    style={{
                      ...styles.bigCodeText,
                      color: accentColor,
                      textShadow: isHighContrast ? 'none' : '0 0 20px rgba(225, 29, 72, 0.4)',
                    }}
                    aria-label={`Meeting Room Code: ${roomCode}`}
                  >
                    {roomCode}
                  </span>
                </div>
                <button
                  style={{
                    ...styles.copyCodeBtn,
                    backgroundColor: isHighContrast ? '#be123c' : redTheme.colors.bgSurfaceElevated,
                    color: isHighContrast ? '#ffffff' : redTheme.colors.textPrimary,
                    borderColor: isHighContrast ? '#881337' : redTheme.colors.borderMedium,
                  }}
                  onClick={handleCopyCode}
                  aria-label="Copy Room Code"
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>

            {/* WEB-ST-06: StageQueuePreview */}
            {queue.length > 0 && (
              <div
                style={{
                  ...styles.queuePreviewBox,
                  backgroundColor: isHighContrast ? '#fff1f2' : redTheme.colors.bgSurfaceDark,
                  borderColor: isHighContrast ? '#fecdd3' : redTheme.colors.borderMedium,
                }}
                aria-live="polite"
              >
                <div style={styles.queueHeader}>
                  <span style={{ ...styles.queueBadge, color: accentColor }}>UP NEXT TO SPEAK</span>
                  <span style={{ ...styles.queueCount, color: secondaryText }}>{queue.length} in line</span>
                </div>
                <div style={styles.queueChipsList}>
                  {queue.slice(0, 4).map((entry, idx) => (
                    <span
                      key={entry.id}
                      style={{
                        ...styles.queueChip,
                        backgroundColor: isHighContrast ? '#ffffff' : redTheme.colors.bgSurfaceElevated,
                        borderColor: isHighContrast ? '#fda4af' : redTheme.colors.borderMedium,
                        color: primaryText,
                      }}
                    >
                      <span style={{ ...styles.queueNum, color: accentColor }}>#{idx + 1}</span> {entry.name}
                    </span>
                  ))}
                  {queue.length > 4 && (
                    <span style={{ ...styles.queueMoreChip, color: secondaryText }}>
                      +{queue.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Step-by-Step Instructions */}
            <div style={styles.instructionsList}>
              <div style={styles.stepItem}>
                <span
                  style={{
                    ...styles.stepNumber,
                    backgroundColor: isHighContrast ? '#be123c' : redTheme.colors.primary,
                    color: '#ffffff',
                  }}
                >
                  1
                </span>
                <div>
                  <strong style={{ ...styles.stepTitle, color: primaryText }}>Scan QR Code:</strong>{' '}
                  <span style={{ color: secondaryText }}>Open iPhone or Android camera to speak instantly in browser, or open AirMic app.</span>
                </div>
              </div>
              <div style={styles.stepItem}>
                <span
                  style={{
                    ...styles.stepNumber,
                    backgroundColor: isHighContrast ? '#be123c' : redTheme.colors.primary,
                    color: '#ffffff',
                  }}
                >
                  2
                </span>
                <div>
                  <strong style={{ ...styles.stepTitle, color: primaryText }}>Hold to Talk:</strong>{' '}
                  <span style={{ color: secondaryText }}>Press and hold the on-screen mic button when it is your turn to address the audience.</span>
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
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    boxSizing: 'border-box',
    transition: 'background-color 0.25s ease',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  backButton: {
    border: '1px solid',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  screenShareBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.8px',
  },
  lockIcon: {
    fontSize: '12px',
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  secondaryBtn: {
    border: '1px solid',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  attendancePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 700,
  },
  redDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: redTheme.colors.primaryHover,
  },
  fullscreenButton: {
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  showcaseCard: {
    border: '1px solid',
    borderRadius: '24px',
    padding: '36px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45)',
  },
  onAirBanner: {
    border: '2px solid',
    borderRadius: '16px',
    padding: '18px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  onAirLabel: {
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '1.5px',
    display: 'block',
  },
  onAirSpeakerName: {
    fontSize: '28px',
    fontWeight: 900,
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
    fontSize: '22px',
    fontWeight: 900,
  },
  floorOpenBanner: {
    border: '1px dashed',
    borderRadius: '16px',
    padding: '18px 24px',
  },
  floorOpenLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  floorOpenIcon: {
    fontSize: '32px',
  },
  floorOpenTitle: {
    fontSize: '14px',
    fontWeight: 900,
    letterSpacing: '1.5px',
    display: 'block',
  },
  floorOpenSubtitle: {
    fontSize: '14px',
    margin: '4px 0 0 0',
    fontWeight: 500,
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '48px',
    alignItems: 'center',
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  qrFrame: {
    padding: '18px',
    borderRadius: '20px',
    border: '3px solid',
  },
  qrScanLabel: {
    fontSize: '11px',
    fontWeight: 900,
    letterSpacing: '1px',
    textAlign: 'center',
  },
  detailsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  subHeader: {
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '2px',
  },
  mainTitle: {
    fontSize: '44px',
    fontWeight: 900,
    letterSpacing: '-1px',
    lineHeight: '1.1',
    margin: 0,
  },
  codeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '6px',
  },
  codeLabel: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '1px',
  },
  codeBannerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  codeBanner: {
    border: '2px solid',
    borderRadius: '14px',
    padding: '12px 28px',
    display: 'inline-block',
  },
  bigCodeText: {
    fontSize: '42px',
    fontWeight: 900,
    letterSpacing: '6px',
    fontFamily: 'monospace',
  },
  copyCodeBtn: {
    border: '1px solid',
    borderRadius: '10px',
    padding: '14px 20px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  queuePreviewBox: {
    border: '1px solid',
    borderRadius: '12px',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  queueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueBadge: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1px',
  },
  queueCount: {
    fontSize: '12px',
    fontWeight: 700,
  },
  queueChipsList: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  queueChip: {
    border: '1px solid',
    borderRadius: '20px',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  queueNum: {
    fontWeight: 900,
  },
  queueMoreChip: {
    fontSize: '12px',
    alignSelf: 'center',
    fontWeight: 700,
  },
  instructionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '12px',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    fontSize: '15px',
  },
  stepNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 900,
    flexShrink: 0,
  },
  stepTitle: {
    fontWeight: 800,
  },
};
