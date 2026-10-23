import React, { useState, useEffect } from 'react';
import { SpeakerInfo, QueueEntry } from '../types';
import { redTheme } from '../tokens/redTheme';

interface FloorQueueDisplayProps {
  currentSpeaker: SpeakerInfo | null;
  queue: QueueEntry[];
  onForceRevoke: () => void;
  onClearQueue: () => void;
  onGrantFloor?: (id: string, name: string) => void;
  onRemoveFromQueue?: (id: string) => void;
}

export const FloorQueueDisplay: React.FC<FloorQueueDisplayProps> = ({
  currentSpeaker,
  queue,
  onForceRevoke,
  onClearQueue,
  onGrantFloor,
  onRemoveFromQueue,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live Talk Timer for current active speaker
  useEffect(() => {
    if (!currentSpeaker) {
      setElapsedSeconds(0);
      return;
    }

    const calcElapsed = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - currentSpeaker.grantedAt) / 1000));
      setElapsedSeconds(diff);
    };

    calcElapsed();
    const timer = setInterval(calcElapsed, 1000);
    return () => clearInterval(timer);
  }, [currentSpeaker]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container} role="region" aria-label="Floor and Attendee Queue">
      {/* Active Speaker Card (WEB-OP-09) */}
      <div style={styles.activeSpeakerCard} aria-live="polite">
        <div style={styles.cardHeader}>
          <div style={styles.badgeRow}>
            <span style={styles.sectionBadge}>AUTHORITATIVE FLOOR</span>
            {currentSpeaker && (
              <span style={styles.timerBadge} aria-label={`Speaking duration: ${formatTimer(elapsedSeconds)}`}>
                ⏱️ {formatTimer(elapsedSeconds)}
              </span>
            )}
          </div>

          {currentSpeaker && (
            <button
              style={styles.revokeButton}
              onClick={onForceRevoke}
              title="Immediately cut microphone and mute speaker"
              aria-label={`Cut microphone for ${currentSpeaker.name}`}
            >
              🛑 CUT FLOOR
            </button>
          )}
        </div>

        {currentSpeaker ? (
          <div style={styles.speakerInfo}>
            <div style={styles.speakerLeft}>
              <div style={styles.liveIndicator}>
                <span style={styles.liveBadge}>ON AIR</span>
              </div>
              <div style={styles.speakerDetails}>
                <div style={styles.nameRow}>
                  <h3 style={styles.speakerName}>{currentSpeaker.name}</h3>
                  {/* Animated Waveform Bars */}
                  <div className="wave-container" title="Audio transmitting to PA" aria-hidden="true">
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                  </div>
                </div>
                <p style={styles.speakerId}>Device: {currentSpeaker.id}</p>
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.floorVacant}>
            <span style={styles.vacantDot} aria-hidden="true" />
            <div>
              <p style={styles.vacantTitle}>Floor is Open (Vacant)</p>
              <p style={styles.vacantSubtext}>
                No microphone is actively broadcasting. Waiting for an attendee to press hold-to-talk.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Queue Card (WEB-OP-08) */}
      <div style={styles.queueCard} role="region" aria-label="Attendee Waiting Line">
        <div style={styles.queueHeader}>
          <div style={styles.queueCountBadge} aria-live="polite">
            WAITING LINE ({queue.length})
          </div>
          {queue.length > 0 && (
            <button style={styles.clearQueueButton} onClick={onClearQueue} title="Clear all queued attendees">
              Clear All Line
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <div style={styles.emptyQueueBox}>
            <p style={styles.emptyQueueText}>Line is currently empty.</p>
            <p style={styles.emptyQueueSub}>
              When someone requests to speak while another is on air, they will appear here in order.
            </p>
          </div>
        ) : (
          <div style={styles.queueList} role="list" aria-label="Queued Attendees">
            {queue.map((entry, index) => (
              <div key={entry.id} style={styles.queueItem} role="listitem">
                <div style={styles.queueItemLeft}>
                  <span style={styles.queuePosition} aria-label={`Position ${index + 1}`}>#{index + 1}</span>
                  <div style={styles.queueEntryDetails}>
                    <span style={styles.queueEntryName}>{entry.name}</span>
                    <span style={styles.queueEntryTime}>
                      Queued {new Date(entry.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div style={styles.queueActions}>
                  {onGrantFloor && (
                    <button
                      style={styles.grantFloorBtn}
                      onClick={() => onGrantFloor(entry.id, entry.name)}
                      title="Promote directly to active speaker now"
                      aria-label={`Grant floor to ${entry.name}`}
                    >
                      🎙️ Give Floor
                    </button>
                  )}
                  {onRemoveFromQueue && (
                    <button
                      style={styles.removeQueueBtn}
                      onClick={() => onRemoveFromQueue(entry.id)}
                      title="Dismiss from line"
                      aria-label={`Remove ${entry.name} from line`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  activeSpeakerCard: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '14px',
    padding: '20px',
    boxShadow: redTheme.shadows.card,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  sectionBadge: {
    fontSize: '11px',
    fontWeight: 800,
    color: redTheme.colors.textSecondary,
    letterSpacing: '1px',
  },
  timerBadge: {
    fontSize: '12px',
    fontWeight: 800,
    color: redTheme.colors.accentLight,
    backgroundColor: 'rgba(225, 29, 72, 0.16)',
    padding: '2px 8px',
    borderRadius: '6px',
    border: `1px solid ${redTheme.colors.borderStrong}`,
    fontFamily: 'monospace',
  },
  revokeButton: {
    backgroundColor: redTheme.colors.emergencyBg,
    border: `1px solid ${redTheme.colors.emergencyBorder}`,
    color: redTheme.colors.emergencyText,
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  speakerInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: redTheme.colors.statusOnAirBg,
    border: `1px solid ${redTheme.colors.statusOnAir}`,
    borderRadius: '12px',
    padding: '18px 20px',
    boxShadow: redTheme.colors.statusOnAirGlow,
  },
  speakerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
  },
  liveBadge: {
    backgroundColor: redTheme.colors.statusOnAir,
    color: '#022c22',
    fontWeight: 900,
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: '6px',
    letterSpacing: '1.2px',
    boxShadow: '0 0 14px rgba(16, 185, 129, 0.5)',
  },
  speakerDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  speakerName: {
    fontSize: '22px',
    fontWeight: 900,
    color: redTheme.colors.textPrimary,
  },
  speakerId: {
    fontSize: '11px',
    color: redTheme.colors.statusOnAirText,
    fontFamily: 'monospace',
  },
  floorVacant: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '18px 20px',
    backgroundColor: redTheme.colors.bgSurfaceDark,
    borderRadius: '10px',
    border: `1px dashed ${redTheme.colors.borderMedium}`,
  },
  vacantDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: redTheme.colors.borderStrong,
    flexShrink: 0,
  },
  vacantTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: redTheme.colors.textSecondary,
    margin: 0,
  },
  vacantSubtext: {
    fontSize: '12px',
    color: redTheme.colors.textMuted,
    margin: '2px 0 0 0',
  },
  queueCard: {
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    borderRadius: '14px',
    padding: '20px',
    boxShadow: redTheme.shadows.card,
  },
  queueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  queueCountBadge: {
    fontSize: '11px',
    fontWeight: 800,
    color: redTheme.colors.accentBright,
    letterSpacing: '1px',
  },
  clearQueueButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: redTheme.colors.textMuted,
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  emptyQueueBox: {
    padding: '16px',
    textAlign: 'center',
  },
  emptyQueueText: {
    fontSize: '13px',
    fontWeight: 700,
    color: redTheme.colors.textMuted,
    margin: 0,
  },
  emptyQueueSub: {
    fontSize: '11px',
    color: redTheme.colors.textSubtle,
    marginTop: '4px',
  },
  queueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  queueItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: redTheme.colors.bgSurfaceDark,
    borderRadius: '8px',
    padding: '10px 14px',
    border: `1px solid ${redTheme.colors.borderMedium}`,
  },
  queueItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  queuePosition: {
    fontSize: '14px',
    fontWeight: 800,
    color: redTheme.colors.accentBright,
    width: '28px',
  },
  queueEntryDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  queueEntryName: {
    fontSize: '14px',
    fontWeight: 700,
    color: redTheme.colors.textPrimary,
  },
  queueEntryTime: {
    fontSize: '11px',
    color: redTheme.colors.textMuted,
  },
  queueActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  grantFloorBtn: {
    backgroundColor: redTheme.colors.primary,
    color: redTheme.colors.textOnPrimary,
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: redTheme.shadows.glowPrimary,
  },
  removeQueueBtn: {
    backgroundColor: redTheme.colors.emergencyBg,
    color: redTheme.colors.emergencyText,
    border: `1px solid ${redTheme.colors.emergencyBorder}`,
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
