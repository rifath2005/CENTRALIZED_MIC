import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SpeakerInfo } from '../types';

interface ProjectorViewProps {
  roomCode: string;
  tokenServerUrl: string;
  memberCount: number;
  currentSpeaker: SpeakerInfo | null;
  onUpdateRoomCode: (newCode: string) => void;
  onBackToConsole: () => void;
}

export const ProjectorView: React.FC<ProjectorViewProps> = ({
  roomCode,
  tokenServerUrl,
  memberCount,
  currentSpeaker,
  onUpdateRoomCode,
  onBackToConsole,
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHighContrast, setIsHighContrast] = useState<boolean>(false);
  const [isEditingCode, setIsEditingCode] = useState<boolean>(false);
  const [tempCode, setTempCode] = useState<string>(roomCode);
  const [editError, setEditError] = useState<string | null>(null);
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
      console.warn('[ProjectorView] Fullscreen toggle error:', err);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('[ProjectorView] Copy error:', err);
    }
  };

  const handleSaveCode = () => {
    const sanitized = tempCode.trim().toUpperCase();
    if (!sanitized) {
      setEditError('Room code cannot be empty.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
      setEditError('Code must contain letters, numbers, hyphens, or underscores.');
      return;
    }

    setEditError(null);
    setIsEditingCode(false);
    onUpdateRoomCode(sanitized);
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
        ...styles.projectorContainer,
        backgroundColor: isHighContrast ? '#000000' : '#050811',
      }}
    >
      {/* Top Floating Controls */}
      <header style={styles.topBar}>
        <button style={styles.navButton} onClick={onBackToConsole}>
          ← PA AUDIO CONSOLE
        </button>

        <div style={styles.topRightActions}>
          {/* Day / High Contrast Toggle */}
          <button
            style={{
              ...styles.secondaryBtn,
              backgroundColor: isHighContrast ? '#38bdf8' : '#1e293b',
              color: isHighContrast ? '#000000' : '#cbd5e1',
            }}
            onClick={() => setIsHighContrast(!isHighContrast)}
            title="Toggle high contrast for bright projector lamps"
          >
            {isHighContrast ? '☀️ Bright Room Mode' : '🌙 Dark Room Mode'}
          </button>

          {/* Active attendee counter */}
          <div style={styles.attendancePill}>
            <span className="pulse-live" style={styles.livePulseDot} />
            <span>{memberCount} {memberCount === 1 ? 'Attendee' : 'Attendees'} Connected</span>
          </div>

          <button style={styles.fullscreenButton} onClick={toggleFullscreen}>
            {isFullscreen ? '⤢ EXIT FULLSCREEN' : '⤡ FULL SCREEN DISPLAY'}
          </button>
        </div>
      </header>

      {/* Main Showcase Card */}
      <div
        style={{
          ...styles.showcaseCard,
          backgroundColor: isHighContrast ? '#050a14' : '#0d1322',
          borderColor: isHighContrast ? '#334155' : '#1e293b',
        }}
      >
        {/* On-Air Banner if someone is holding floor */}
        {currentSpeaker && (
          <div style={styles.onAirBanner}>
            <div style={styles.onAirLeft}>
              <span className="pulse-live" style={styles.onAirDot} />
              <span style={styles.onAirText}>
                ON AIR: <strong>{currentSpeaker.name}</strong> is currently speaking
              </span>
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
        )}

        <div className="responsive-projector-grid" style={styles.contentGrid}>
          {/* Left: Giant High-Visibility QR Code */}
          <div style={styles.qrSection}>
            <div
              style={{
                ...styles.qrFrame,
                backgroundColor: isHighContrast ? '#ffffff' : '#090d16',
                borderColor: isHighContrast ? '#38bdf8' : '#1e293b',
              }}
            >
              <QRCodeSVG
                value={pairingPayload}
                size={260}
                bgColor={isHighContrast ? '#ffffff' : '#090d16'}
                fgColor={isHighContrast ? '#000000' : '#38bdf8'}
                level="Q"
                includeMargin={false}
              />
            </div>
            <span style={styles.qrScanLabel}>POINT CAMERA TO PAIR SMARTPHONE</span>
          </div>

          {/* Right: Code Details & Instructions */}
          <div className="responsive-projector-details" style={styles.detailsSection}>
            <span style={styles.subHeader}>BOARDROOM SOUND SYSTEM</span>
            <h1 style={styles.mainTitle}>Join Meeting Sound System</h1>

            {/* Room Code Display or Editor */}
            <div style={styles.codeContainer}>
              <div style={styles.codeHeader}>
                <span style={styles.codeLabel}>ROOM CODE TO ENTER ON PHONE:</span>
                {!isEditingCode && (
                  <button
                    style={styles.changeCodeBtn}
                    onClick={() => {
                      setTempCode(roomCode);
                      setIsEditingCode(true);
                    }}
                  >
                    ✏️ Edit Code
                  </button>
                )}
              </div>

              {isEditingCode ? (
                <div style={styles.editCodeBox}>
                  <input
                    type="text"
                    value={tempCode}
                    onChange={(e) => setTempCode(e.target.value.toUpperCase())}
                    style={styles.codeEditInput}
                    placeholder="e.g. BOARDROOM-A"
                    autoFocus
                  />
                  {editError && <span style={styles.editErrorText}>{editError}</span>}
                  <div style={styles.editButtonsRow}>
                    <button style={styles.saveCodeBtn} onClick={handleSaveCode}>
                      SAVE &amp; SWITCH ROOM
                    </button>
                    <button
                      style={styles.cancelCodeBtn}
                      onClick={() => {
                        setIsEditingCode(false);
                        setEditError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.codeBannerRow}>
                  <div style={styles.codeBanner}>
                    <span style={styles.bigCodeText}>{roomCode}</span>
                  </div>
                  <button style={styles.copyCodeBtn} onClick={handleCopyCode}>
                    {copied ? '✓ Copied!' : '📋 Copy'}
                  </button>
                  <button
                    style={styles.randomCodeBtn}
                    onClick={() => {
                      const prefixes = ['BOARD', 'CONF', 'AUDIT', 'ROOM', 'MEET', 'STUDIO'];
                      const p = prefixes[Math.floor(Math.random() * prefixes.length)];
                      const n = Math.floor(1000 + Math.random() * 9000);
                      onUpdateRoomCode(`${p}-${n}`);
                    }}
                    title="Generate unique room code to avoid collisions online"
                  >
                    🎲 Unique Room
                  </button>
                </div>
              )}
            </div>

            {/* Step-by-Step Instructions */}
            <div style={styles.instructionsList}>
              <div style={styles.stepItem}>
                <span style={styles.stepNumber}>1</span>
                <div>
                  <strong>Open App:</strong> Launch the Centralized Mic app on iPhone or Android.
                </div>
              </div>
              <div style={styles.stepItem}>
                <span style={styles.stepNumber}>2</span>
                <div>
                  <strong>Pair:</strong> Point phone camera at the QR code or enter code <code>{roomCode}</code>.
                </div>
              </div>
              <div style={styles.stepItem}>
                <span style={styles.stepNumber}>3</span>
                <div>
                  <strong>Speak:</strong> Press and hold the button to project speech through venue PA speakers.
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
  projectorContainer: {
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
    maxWidth: '1100px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    gap: '12px',
    flexWrap: 'wrap',
  },
  navButton: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#cbd5e1',
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  topRightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  secondaryBtn: {
    border: '1px solid #334155',
    padding: '8px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  attendancePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid #059669',
    color: '#34d399',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 800,
  },
  livePulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#34d399',
  },
  fullscreenButton: {
    backgroundColor: '#2563eb',
    border: 'none',
    color: '#ffffff',
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
  },
  showcaseCard: {
    width: '100%',
    maxWidth: '1100px',
    borderRadius: '24px',
    border: '1px solid #1e293b',
    padding: '36px 48px',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
  },
  onAirBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#064e3b',
    border: '1px solid #059669',
    borderRadius: '14px',
    padding: '16px 24px',
    marginBottom: '28px',
    gap: '16px',
    flexWrap: 'wrap',
  },
  onAirLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  onAirDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#34d399',
  },
  onAirText: {
    fontSize: '18px',
    color: '#ffffff',
  },
  onAirRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  onAirTimer: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#34d399',
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: '4px 10px',
    borderRadius: '6px',
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
    gap: '16px',
  },
  qrFrame: {
    border: '4px solid #1e293b',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
  },
  qrScanLabel: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#38bdf8',
    letterSpacing: '1.5px',
    textAlign: 'center',
  },
  detailsSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  subHeader: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#38bdf8',
    letterSpacing: '2px',
    marginBottom: '8px',
  },
  mainTitle: {
    fontSize: '32px',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.5px',
    margin: '0 0 20px 0',
  },
  codeContainer: {
    marginBottom: '24px',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  codeLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '1px',
  },
  changeCodeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  codeBannerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  codeBanner: {
    backgroundColor: '#090d16',
    border: '2px dashed #2563eb',
    borderRadius: '14px',
    padding: '14px 24px',
    display: 'inline-block',
  },
  bigCodeText: {
    fontSize: '40px',
    fontWeight: 900,
    letterSpacing: '4px',
    color: '#38bdf8',
    fontFamily: 'monospace',
  },
  copyCodeBtn: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#cbd5e1',
    borderRadius: '8px',
    padding: '12px 18px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  randomCodeBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid #0284c7',
    color: '#38bdf8',
    borderRadius: '8px',
    padding: '12px 18px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  editCodeBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '400px',
  },
  codeEditInput: {
    backgroundColor: '#1e293b',
    border: '2px solid #38bdf8',
    borderRadius: '10px',
    padding: '12px 18px',
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: 800,
    fontFamily: 'monospace',
    outline: 'none',
  },
  editErrorText: {
    fontSize: '12px',
    color: '#f87171',
  },
  editButtonsRow: {
    display: 'flex',
    gap: '10px',
  },
  saveCodeBtn: {
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 18px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  cancelCodeBtn: {
    backgroundColor: '#334155',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  instructionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '14px',
    padding: '18px 22px',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    fontSize: '13px',
    color: '#cbd5e1',
  },
  stepNumber: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
    flexShrink: 0,
  },
};
