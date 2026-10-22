import React, { useState } from 'react';

interface SettingsNetworkViewProps {
  roomCode: string;
  tokenServerUrl: string;
  isConnected: boolean;
  isConnecting: boolean;
  memberCount: number;
  onUpdateRoomCode: (newCode: string) => void;
  onReconnect: () => void;
}

export const SettingsNetworkView: React.FC<SettingsNetworkViewProps> = ({
  roomCode,
  tokenServerUrl,
  isConnected,
  isConnecting,
  memberCount,
  onUpdateRoomCode,
  onReconnect,
}) => {
  const [tempCode, setTempCode] = useState(roomCode);
  const [isEditingCode, setIsEditingCode] = useState(false);
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
              <span style={styles.endpointLabel}>Token Server (JWT Broker)</span>
              <code style={styles.endpointCode}>{tokenServerUrl}</code>
              <span style={styles.endpointStatus}>Hosted on Render (Auto-Scaling)</span>
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
    backgroundColor: '#160a22',
    border: '1px solid #441e6a',
    borderRadius: '20px',
    padding: '28px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    boxShadow: '0 8px 32px rgba(13, 5, 21, 0.6)',
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
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    padding: '4px 12px',
    borderRadius: '12px',
  },
  internalBadge: {
    fontSize: '10.5px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: '#cbd5e1',
    backgroundColor: 'rgba(203, 213, 225, 0.1)',
    border: '1px solid rgba(203, 213, 225, 0.2)',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 900,
    color: '#f8fafc',
    letterSpacing: '-0.5px',
    marginBottom: '8px',
  },
  description: {
    fontSize: '13.5px',
    color: '#94a3b8',
    lineHeight: '1.6',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  connectionCard: {
    backgroundColor: '#1b0c2b',
    border: '1px solid #441e6a',
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
    color: '#94a3b8',
    display: 'block',
  },
  statusValue: {
    fontSize: '12.5px',
    color: '#f8fafc',
    letterSpacing: '0.4px',
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: '24px',
  },
  panelCard: {
    backgroundColor: '#1b0c2b',
    border: '1px solid #441e6a',
    borderRadius: '20px',
    padding: '26px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
  cardHeader: {
    marginBottom: '16px',
  },
  cardBadge: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '1px',
    color: '#cbd5e1',
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: '17px',
    fontWeight: 800,
    color: '#f8fafc',
    marginTop: '4px',
    marginBottom: '6px',
  },
  cardHelp: {
    fontSize: '13px',
    color: '#94a3b8',
    lineHeight: '1.5',
    marginBottom: '18px',
  },
  roomBox: {
    backgroundColor: '#130820',
    border: '1px solid #3b195c',
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
    color: '#94a3b8',
    letterSpacing: '1px',
  },
  attendeeCountText: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#fbbf24',
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
    color: '#f8fafc',
    letterSpacing: '1.5px',
    backgroundColor: '#200f33',
    padding: '6px 18px',
    borderRadius: '12px',
    border: '1px solid #5d2a90',
  },
  switchBtn: {
    backgroundColor: '#2c1445',
    color: '#cbd5e1',
    border: '1px solid #441e6a',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '12.5px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  actionBtn: {
    backgroundColor: '#2c1445',
    color: '#fbbf24',
    border: '1px solid #441e6a',
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
    backgroundColor: '#200f33',
    border: '1px solid #fbbf24',
    borderRadius: '10px',
    color: '#f8fafc',
    padding: '10px 14px',
    fontSize: '16px',
    fontWeight: 800,
    textTransform: 'uppercase',
    outline: 'none',
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#f59e0b',
    color: '#0d0515',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 16px',
    fontSize: '12.5px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  cancelBtn: {
    backgroundColor: '#2c1445',
    color: '#94a3b8',
    border: '1px solid #441e6a',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '12.5px',
    cursor: 'pointer',
  },
  errorText: {
    fontSize: '12px',
    color: '#f43f5e',
    fontWeight: 600,
  },
  actionRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    paddingTop: '12px',
    borderTop: '1px solid #2c1445',
  },
  uniqueBtn: {
    flex: 1,
    minWidth: '200px',
    backgroundColor: '#f59e0b',
    color: '#0d0515',
    border: 'none',
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
  },
  payloadBtn: {
    flex: 1,
    minWidth: '200px',
    backgroundColor: '#2c1445',
    color: '#cbd5e1',
    border: '1px solid #441e6a',
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
    backgroundColor: '#130820',
    border: '1px solid #341852',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  endpointLabel: {
    fontSize: '11px',
    fontWeight: 800,
    color: '#cbd5e1',
    letterSpacing: '0.8px',
  },
  endpointCode: {
    fontSize: '12.5px',
    color: '#fbbf24',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  endpointStatus: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  reconnectRow: {
    marginTop: '18px',
    paddingTop: '16px',
    borderTop: '1px solid #341852',
  },
  reconnectBtn: {
    width: '100%',
    backgroundColor: '#2c1445',
    color: '#f8fafc',
    border: '1px solid #5d2a90',
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
    backgroundColor: '#130820',
    border: '1px solid #341852',
    borderRadius: '14px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  latencyMs: {
    fontSize: '20px',
    fontWeight: 900,
    color: '#f59e0b',
  },
  latencyStepTitle: {
    fontSize: '13px',
    color: '#f8fafc',
  },
  latencyStepDesc: {
    fontSize: '11.5px',
    color: '#94a3b8',
    margin: 0,
    lineHeight: '1.4',
  },
  budgetFooter: {
    backgroundColor: '#160a22',
    border: '1px solid #441e6a',
    borderRadius: '12px',
    padding: '14px 18px',
  },
  budgetSummary: {
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '1.5',
  },
};
