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
  const [isEditingCode, setIsEditingCode] = useState<boolean>(false);
  const [tempCode, setTempCode] = useState<string>(roomCode);
  const [editError, setEditError] = useState<string | null>(null);

  // Sync fullscreen state with document events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

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

  return (
    <div style={styles.projectorContainer}>
      {/* Top Floating Controls */}
      <div style={styles.topBar}>
        <button style={styles.navButton} onClick={onBackToConsole}>
          ← BACK TO AUDIO CONSOLE
        </button>

        <div style={styles.topRightActions}>
          <div style={styles.attendancePill}>
            <span style={styles.livePulseDot} />
            <span>{memberCount} {memberCount === 1 ? 'Device' : 'Devices'} Connected</span>
          </div>

          <button style={styles.fullscreenButton} onClick={toggleFullscreen}>
            {isFullscreen ? '⤢ EXIT FULLSCREEN' : '⤡ FULL SCREEN DISPLAY'}
          </button>
        </div>
      </div>

      {/* Main Showcase Grid */}
      <div style={styles.showcaseCard}>
        {/* On-Air Banner if someone is holding floor */}
        {currentSpeaker && (
          <div style={styles.onAirBanner}>
            <span style={styles.onAirDot} />
            <span style={styles.onAirText}>
              ON AIR: <strong>{currentSpeaker.name}</strong> is currently speaking
            </span>
          </div>
        )}

        <div style={styles.contentGrid}>
          {/* Left: Giant High-Visibility QR Code */}
          <div style={styles.qrSection}>
            <div style={styles.qrFrame}>
              <QRCodeSVG
                value={pairingPayload}
                size={280}
                bgColor="#090d16"
                fgColor="#38bdf8"
                level="Q"
                includeMargin={false}
              />
            </div>
            <span style={styles.qrScanLabel}>POINT CAMERA TO PAIR INSTANTLY</span>
          </div>

          {/* Right: Code Details & Instructions */}
          <div style={styles.detailsSection}>
            <span style={styles.subHeader}>BOARDROOM WIRELESS MICROPHONE</span>
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
                    ✏️ Change Code
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
                      SAVE & SWITCH ROOM
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
                <div style={styles.codeBanner}>
                  <span style={styles.bigCodeText}>{roomCode}</span>
                </div>
              )}
            </div>

            {/* Step-by-Step Instructions */}
            <div style={styles.instructionsList}>
              <div style={styles.stepItem}>
                <span style={styles.stepNumber}>1</span>
                <div>
                  <strong>Open App:</strong> Launch the Wireless Mic app on iOS or Android.
                </div>
              </div>
              <div style={styles.stepItem}>
                <span style={styles.stepNumber}>2</span>
                <div>
                  <strong>Pair:</strong> Scan the QR code or type code <code>{roomCode}</code>.
                </div>
              </div>
              <div style={styles.stepItem}>
                <span style={styles.stepNumber}>3</span>
                <div>
                  <strong>Speak:</strong> Press and hold the button to project through venue PA speakers.
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
    backgroundColor: '#050811',
    color: '#f8fafc',
    padding: '32px 48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    boxSizing: 'border-box',
    position: 'relative',
  },
  topBar: {
    width: '100%',
    maxWidth: '1100px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '28px',
  },
  navButton: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  topRightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
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
    fontSize: '13px',
    fontWeight: 800,
  },
  livePulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#34d399',
    boxShadow: '0 0 10px #34d399',
  },
  fullscreenButton: {
    backgroundColor: '#2563eb',
    border: 'none',
    color: '#ffffff',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.8px',
    cursor: 'pointer',
  },
  showcaseCard: {
    width: '100%',
    maxWidth: '1100px',
    backgroundColor: '#0d1322',
    border: '1px solid #1e293b',
    borderRadius: '24px',
    padding: '44px 52px',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
  },
  onAirBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#064e3b',
    border: '1px solid #059669',
    borderRadius: '12px',
    padding: '14px 20px',
    marginBottom: '32px',
  },
  onAirDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#34d399',
    boxShadow: '0 0 12px #34d399',
  },
  onAirText: {
    fontSize: '16px',
    color: '#ffffff',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '56px',
    alignItems: 'center',
  },
  qrSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  qrFrame: {
    backgroundColor: '#090d16',
    border: '4px solid #1e293b',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
  },
  qrScanLabel: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#38bdf8',
    letterSpacing: '1.5px',
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
    fontSize: '34px',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '-0.5px',
    margin: '0 0 24px 0',
  },
  codeContainer: {
    marginBottom: '28px',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px',
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
  codeBanner: {
    backgroundColor: '#090d16',
    border: '2px dashed #2563eb',
    borderRadius: '16px',
    padding: '16px 28px',
    display: 'inline-block',
  },
  bigCodeText: {
    fontSize: '44px',
    fontWeight: 900,
    letterSpacing: '4px',
    color: '#38bdf8',
    fontFamily: 'monospace',
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
    gap: '14px',
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '14px',
    padding: '20px 24px',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    fontSize: '14px',
    color: '#cbd5e1',
  },
  stepNumber: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
    flexShrink: 0,
  },
};
