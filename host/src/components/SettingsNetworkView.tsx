import React, { useState } from 'react';
import { redTheme } from '../tokens/redTheme';

interface SettingsNetworkViewProps {
  roomCode: string;
  tokenServerUrl: string;
  isConnected: boolean;
  isConnecting: boolean;
  memberCount: number;
  onUpdateRoomCode: (newCode: string) => void;
  onUpdateTokenServerUrl?: (newUrl: string) => void;
  onReconnect: () => void;
}

export const SettingsNetworkView: React.FC<SettingsNetworkViewProps> = ({
  roomCode,
  tokenServerUrl,
  isConnected,
  isConnecting,
  memberCount,
  onUpdateRoomCode,
  onUpdateTokenServerUrl,
  onReconnect,
}) => {
  const [tempCode, setTempCode] = useState(roomCode);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [tempServer, setTempServer] = useState(tokenServerUrl);
  const [serverSaved, setServerSaved] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const pairingPayload = JSON.stringify({
    action: 'JOIN_MIC_ROOM',
    room: roomCode,
    server: tokenServerUrl,
  });

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.warn('[Settings] Copy error:', err);
    }
  };

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(pairingPayload);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch (err) {
      console.warn('[Settings] Copy payload error:', err);
    }
  };

  const handleSaveCode = () => {
    const sanitized = tempCode.trim().toUpperCase();
    if (!sanitized) {
      setCodeError('Room code cannot be empty.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
      setCodeError('Code must contain letters, numbers, hyphens, or underscores.');
      return;
    }
    setCodeError(null);
    setIsEditingCode(false);
    onUpdateRoomCode(sanitized);
  };

  const generateUniqueRoom = () => {
    const prefixes = ['BOARD', 'CONF', 'AUDIT', 'STAGE', 'MEET', 'STUDIO'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const n = Math.floor(1000 + Math.random() * 9000);
    const code = `${p}-${n}`;
    setTempCode(code);
    onUpdateRoomCode(code);
  };

  return (
    <div style={styles.container}>
      {/* Header Banner */}
      <div style={styles.headerCard}>
        <div style={styles.headerLeft}>
          <div style={styles.badgeRow}>
            <span style={styles.sectionBadge}>SETTINGS &amp; NETWORK INFRASTRUCTURE</span>
            <span style={styles.internalBadge}>🔒 ADMIN ONLY</span>
          </div>
          <h2 style={styles.title}>System Configuration &amp; Cloud Diagnostics</h2>
          <p style={styles.description}>
            Manage room codes, cloud endpoints, and LiveKit WebRTC signaling channels.
            All backend details are quarantined in this section to keep event screen-shares secure.
          </p>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.connectionCard}>
            <span
              style={{
                ...styles.statusDot,
                backgroundColor: isConnected ? '#10b981' : isConnecting ? '#f59e0b' : '#64748b',
              }}
            />
            <div>
              <span style={styles.statusLabel}>LiveKit SFU</span>
              <strong style={styles.statusValue}>
                {isConnected ? 'ONLINE (ACTIVE)' : isConnecting ? 'CONNECTING...' : 'OFFLINE'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Room Code Management & Cloud Endpoints */}
      <div style={styles.twoColumnGrid}>
        {/* Room Code Management Card */}
        <div style={styles.panelCard}>
          <div style={styles.cardHeader}>
            <span style={styles.cardBadge}>ROOM MANAGEMENT</span>
            <h3 style={styles.cardTitle}>Meeting Room Code &amp; Isolation</h3>
          </div>
          <p style={styles.cardHelp}>
            Room codes segregate attendees into private conference rooms. Generating a unique code avoids collisions on public LiveKit servers.
          </p>

          <div style={styles.roomBox}>
            <div style={styles.roomBoxHeader}>
              <span style={styles.roomBoxLabel}>CURRENT ROOM IDENTIFIER:</span>
              <span style={styles.attendeeCountText}>
                {memberCount} {memberCount === 1 ? 'Attendee' : 'Attendees'} in Room
              </span>
            </div>

            {isEditingCode ? (
              <div style={styles.editRow}>
                <input
                  type="text"
                  value={tempCode}
                  onChange={(e) => setTempCode(e.target.value.toUpperCase())}
                  style={styles.codeEditInput}
                  autoFocus
                />
                <button style={styles.saveBtn} onClick={handleSaveCode}>
                  Save
                </button>
                <button
                  style={styles.cancelBtn}
                  onClick={() => {
                    setIsEditingCode(false);
                    setCodeError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={styles.codeRow}>
                <span style={styles.bigCode}>{roomCode}</span>
                <button
                  style={styles.switchBtn}
                  onClick={() => {
                    setTempCode(roomCode);
                    setIsEditingCode(true);
                  }}
                >
                  ✏️ Edit Code
                </button>
                <button style={styles.actionBtn} onClick={handleCopyCode}>
                  {copiedCode ? '✓ Copied' : '📋 Copy Code'}
                </button>
              </div>
            )}

            {codeError && <span style={styles.errorText}>{codeError}</span>}

            <div style={styles.actionRow}>
              <button style={styles.uniqueBtn} onClick={generateUniqueRoom}>
                🎲 Generate Unique Room Code
              </button>
              <button style={styles.payloadBtn} onClick={handleCopyPayload}>
                {copiedPayload ? '✓ Payload Copied!' : '📦 Copy Full JSON Payload'}
              </button>
            </div>
          </div>
        </div>

        {/* Cloud Infrastructure Card */}
        <div style={styles.panelCard}>
          <div style={styles.cardHeader}>
            <span style={styles.cardBadge}>CLOUD INFRASTRUCTURE</span>
            <h3 style={styles.cardTitle}>LiveKit SFU &amp; Token Server</h3>
          </div>
          <p style={styles.cardHelp}>
            Production cloud endpoints handling WebRTC signaling and JWT token issuance.
          </p>

          <div style={styles.endpointList}>
            <div style={styles.endpointItem}>
              <span style={styles.endpointLabel}>LiveKit SFU WebSocket</span>
              <code style={styles.endpointCode}>wss://centralized-mic-v3q5zrd6.livekit.cloud</code>
              <span style={styles.endpointStatus}>LiveKit Cloud Global Anycast</span>
            </div>

            <div style={styles.endpointItem}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={styles.endpointLabel}>Token Server (JWT Broker)</span>
                {!isEditingServer && (
                  <button
                    style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                    onClick={() => { setTempServer(tokenServerUrl); setIsEditingServer(true); }}
                    type="button"
                  >
                    ✏️ Edit URL
                  </button>
                )}
              </div>
              {isEditingServer ? (
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={tempServer}
                    onChange={(e) => setTempServer(e.target.value)}
                    style={{ flex: 1, minWidth: '220px', backgroundColor: '#080a0e', border: '1px solid #e11d48', borderRadius: '8px', padding: '6px 10px', color: '#ffffff', fontFamily: 'monospace', fontSize: '12px' }}
                  />
                  <button
                    style={{ backgroundColor: '#e11d48', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    onClick={() => {
                      const sanitized = tempServer.trim();
                      if (sanitized && onUpdateTokenServerUrl) {
                        onUpdateTokenServerUrl(sanitized);
                        setIsEditingServer(false);
                        setServerSaved(true);
                        setTimeout(() => setServerSaved(false), 2500);
                        onReconnect();
                      }
                    }}
                    type="button"
                  >
                    Save &amp; Reconnect
                  </button>
                  <button
                    style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                    onClick={() => { setTempServer(tokenServerUrl); setIsEditingServer(false); }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <code style={styles.endpointCode}>{tokenServerUrl}</code>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => {
                    const loc = `http://${window.location.hostname || 'localhost'}:4000`;
                    setTempServer(loc);
                    if (onUpdateTokenServerUrl) { onUpdateTokenServerUrl(loc); onReconnect(); }
                  }}
                  type="button"
                >
                  ⚡ Set Localhost (:4000)
                </button>
                <button
                  style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => {
                    const cloud = 'https://centralized-mic-token-server.onrender.com';
                    setTempServer(cloud);
                    if (onUpdateTokenServerUrl) { onUpdateTokenServerUrl(cloud); onReconnect(); }
                  }}
                  type="button"
                >
                  ☁️ Set Cloud (Render)
                </button>
                {serverSaved && <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold' }}>✓ Saved &amp; Reconnecting...</span>}
              </div>
            </div>

            <div style={styles.endpointItem}>
              <span style={styles.endpointLabel}>Audio Codec &amp; Bitrate</span>
              <code style={styles.endpointCode}>Opus 48,000 Hz Mono • 32 kbps (ptime: 20ms)</code>
              <span style={styles.endpointStatus}>Glass-to-Glass &lt; 300ms Budget</span>
            </div>
          </div>

          <div style={styles.reconnectRow}>
            <button style={styles.reconnectBtn} onClick={onReconnect}>
              🔄 Reconnect LiveKit Session
            </button>
          </div>
        </div>
      </div>

      {/* Latency Budget & Architectural Verification */}
      <div style={styles.panelCard}>
        <div style={styles.cardHeader}>
          <span style={styles.cardBadge}>ACOUSTIC BUDGET</span>
          <h3 style={styles.cardTitle}>End-to-End Glass-to-Glass Latency Breakdown (&lt; 300ms)</h3>
        </div>

        <div style={styles.latencyGrid}>
          <div style={styles.latencyStep}>
            <span style={styles.latencyMs}>~25 ms</span>
            <strong style={styles.latencyStepTitle}>1. Mobile Capture</strong>
            <p style={styles.latencyStepDesc}>Android VoiceCommunication &amp; iOS VoiceChat hardware AEC buffer.</p>
          </div>
          <div style={styles.latencyStep}>
            <span style={styles.latencyMs}>~25 ms</span>
            <strong style={styles.latencyStepTitle}>2. Opus Encode</strong>
            <p style={styles.latencyStepDesc}>Mono 48 kHz Opus frame packetization with ptime = 20ms.</p>
          </div>
          <div style={styles.latencyStep}>
            <span style={styles.latencyMs}>~30–60 ms</span>
            <strong style={styles.latencyStepTitle}>3. Phone ➔ LiveKit SFU</strong>
            <p style={styles.latencyStepDesc}>UDP WebRTC transport over Wi-Fi 5/6 or 4G/5G cellular radio.</p>
          </div>
          <div style={styles.latencyStep}>
            <span style={styles.latencyMs}>~30–60 ms</span>
            <strong style={styles.latencyStepTitle}>4. LiveKit ➔ Host PA</strong>
            <p style={styles.latencyStepDesc}>SFU routing to room host receiver over high-speed broadband.</p>
          </div>
          <div style={styles.latencyStep}>
            <span style={styles.latencyMs}>~20–30 ms</span>
            <strong style={styles.latencyStepTitle}>5. Web Audio DSP</strong>
            <p style={styles.latencyStepDesc}>80Hz high-pass filter, 3ms limiter, and soundcard DAC buffer.</p>
          </div>
        </div>

        <div style={styles.budgetFooter}>
          <span style={styles.budgetSummary}>
            <strong>Total Measured Latency:</strong> ~130 ms – 200 ms (Safely below human acoustic echo perception ceiling of 300 ms).
          </span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
  },
  headerCard: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '20px',
    padding: '28px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    boxShadow: redTheme.shadows.card,
  },
  headerLeft: {
    maxWidth: '750px',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  sectionBadge: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '1.2px',
    color: redTheme.colors.accentBright,
    backgroundColor: 'rgba(225, 29, 72, 0.14)',
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    padding: '4px 12px',
    borderRadius: '12px',
  },
  internalBadge: {
    fontSize: '10.5px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: redTheme.colors.textMuted,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    padding: '4px 10px',
    borderRadius: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 900,
    color: redTheme.colors.textPrimary,
    letterSpacing: '-0.5px',
    marginBottom: '8px',
  },
  description: {
    fontSize: '13.5px',
    color: redTheme.colors.textMuted,
    lineHeight: '1.6',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  connectionCard: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '14px',
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    boxShadow: '0 0 10px currentColor',
  },
  statusLabel: {
    fontSize: '11px',
    color: redTheme.colors.textMuted,
    display: 'block',
  },
  statusValue: {
    fontSize: '12.5px',
    color: redTheme.colors.textPrimary,
    letterSpacing: '0.4px',
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: '24px',
  },
  panelCard: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '20px',
    padding: '26px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: redTheme.shadows.card,
  },
  cardHeader: {
    marginBottom: '16px',
  },
  cardBadge: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: redTheme.colors.accentBright,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: 800,
    color: redTheme.colors.textPrimary,
    marginTop: '4px',
    marginBottom: '6px',
  },
  cardHelp: {
    fontSize: '13px',
    color: redTheme.colors.textMuted,
    lineHeight: '1.5',
    marginBottom: '18px',
  },
  roomBox: {
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  roomBoxHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomBoxLabel: {
    fontSize: '11px',
    fontWeight: 800,
    color: redTheme.colors.textMuted,
    letterSpacing: '1px',
  },
  attendeeCountText: {
    fontSize: '12px',
    fontWeight: 700,
    color: redTheme.colors.accentBright,
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  bigCode: {
    fontSize: '28px',
    fontWeight: 900,
    color: redTheme.colors.textPrimary,
    letterSpacing: '1.5px',
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    padding: '6px 18px',
    borderRadius: '12px',
    border: `1px solid ${redTheme.colors.borderMedium}`,
  },
  switchBtn: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    color: redTheme.colors.textSecondary,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '12.5px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  actionBtn: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    color: redTheme.colors.accentBright,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '12.5px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  editRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  codeEditInput: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    border: `1px solid ${redTheme.colors.borderStrong}`,
    borderRadius: '10px',
    color: redTheme.colors.textPrimary,
    padding: '10px 14px',
    fontSize: '16px',
    fontWeight: 800,
    textTransform: 'uppercase',
    outline: 'none',
    flex: 1,
  },
  saveBtn: {
    backgroundColor: redTheme.colors.primary,
    color: redTheme.colors.textOnPrimary,
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    fontSize: '12.5px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  cancelBtn: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    color: redTheme.colors.textMuted,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '12.5px',
    cursor: 'pointer',
  },
  errorText: {
    fontSize: '12px',
    color: redTheme.colors.emergency,
    fontWeight: 600,
  },
  actionRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    paddingTop: '12px',
    borderTop: `1px solid ${redTheme.colors.borderSubtle}`,
  },
  uniqueBtn: {
    flex: 1,
    minWidth: '200px',
    backgroundColor: redTheme.colors.primary,
    color: redTheme.colors.textOnPrimary,
    border: 'none',
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: redTheme.shadows.glowPrimary,
  },
  payloadBtn: {
    flex: 1,
    minWidth: '200px',
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    color: redTheme.colors.textSecondary,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  endpointList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  endpointItem: {
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  endpointLabel: {
    fontSize: '11px',
    fontWeight: 800,
    color: redTheme.colors.textSecondary,
    letterSpacing: '0.8px',
  },
  endpointCode: {
    fontSize: '12.5px',
    color: redTheme.colors.accentBright,
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  endpointStatus: {
    fontSize: '11px',
    color: redTheme.colors.textMuted,
  },
  reconnectRow: {
    marginTop: '18px',
    paddingTop: '16px',
    borderTop: `1px solid ${redTheme.colors.borderSubtle}`,
  },
  reconnectBtn: {
    width: '100%',
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    color: redTheme.colors.textPrimary,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '12px',
    padding: '12px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  latencyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  },
  latencyStep: {
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '14px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  latencyMs: {
    fontSize: '20px',
    fontWeight: 900,
    color: redTheme.colors.accentBright,
  },
  latencyStepTitle: {
    fontSize: '13px',
    color: redTheme.colors.textPrimary,
  },
  latencyStepDesc: {
    fontSize: '11.5px',
    color: redTheme.colors.textMuted,
    margin: 0,
    lineHeight: '1.4',
  },
  budgetFooter: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '12px',
    padding: '14px 18px',
  },
  budgetSummary: {
    fontSize: '13px',
    color: redTheme.colors.textSecondary,
    lineHeight: '1.5',
  },
};

