import React, { useState, useEffect } from 'react';
import { SpeakerInfo, QueueEntry } from '../types';

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
    <div style={styles.container}>
      {/* Active Speaker Card */}
      <div style={styles.activeSpeakerCard}>
        <div style={styles.cardHeader}>
          <div style={styles.badgeRow}>
            <span style={styles.sectionBadge}>AUTHORITATIVE FLOOR</span>
            {currentSpeaker && (
              <span style={styles.timerBadge}>
                ⏱️ {formatTimer(elapsedSeconds)}
              </span>
            )}
          </div>

          {currentSpeaker && (
            <button
              style={styles.revokeButton}
              onClick={onForceRevoke}
              title="Immediately cut microphone and mute speaker"
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
                  <div className="wave-container" title="Audio transmitting to PA">
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
            <span style={styles.vacantDot} />
            <div>
              <p style={styles.vacantTitle}>Floor is Open (Vacant)</p>
              <p style={styles.vacantSubtext}>
                No microphone is actively broadcasting. Waiting for an attendee to press hold-to-talk.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Queue Card */}
      <div style={styles.queueCard}>
        <div style={styles.queueHeader}>
          <div style={styles.queueCountBadge}>
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
          <div style={styles.queueList}>
            {queue.map((entry, index) => (
              <div key={entry.id} style={styles.queueItem}>
                <div style={styles.queueItemLeft}>
                  <span style={styles.queuePosition}>#{index + 1}</span>
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
                    >
                      🎙️ Give Floor
                    </button>
                  )}
                  {onRemoveFromQueue && (
                    <button
                      style={styles.removeQueueBtn}
                      onClick={() => onRemoveFromQueue(entry.id)}
                      title="Dismiss from line"
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
    backgroundColor: '#200f33',
    border: '1px solid #441e6a',
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 8px 30px rgba(13, 5, 21, 0.45)',
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
    color: '#cbd5e1',
    letterSpacing: '1px',
  },
  timerBadge: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#fbbf24',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    padding: '2px 8px',
    borderRadius: '6px',
    border: '1px solid #f59e0b',
    fontFamily: 'monospace',
  },
  revokeButton: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    border: '1px solid #f43f5e',
    color: '#fb7185',
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
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid #10b981',
    borderRadius: '12px',
    padding: '18px 20px',
    boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)',
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
    backgroundColor: '#10b981',
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
    color: '#f8fafc',
  },
  speakerId: {
    fontSize: '11px',
    color: '#6ee7b7',
    fontFamily: 'monospace',
  },
  floorVacant: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '18px 20px',
    backgroundColor: '#160a22',
    borderRadius: '10px',
    border: '1px dashed #441e6a',
  },
  vacantDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#5d2a90',
    flexShrink: 0,
  },
  vacantTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#cbd5e1',
    margin: 0,
  },
  vacantSubtext: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: '2px 0 0 0',
  },
  queueCard: {
    backgroundColor: '#200f33',
    border: '1px solid #441e6a',
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 8px 30px rgba(13, 5, 21, 0.45)',
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
    color: '#fbbf24',
    letterSpacing: '1px',
  },
  clearQueueButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94a3b8',
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
    color: '#94a3b8',
    margin: 0,
  },
  emptyQueueSub: {
    fontSize: '11px',
    color: '#64748b',
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
    backgroundColor: '#160a22',
    borderRadius: '8px',
    padding: '10px 14px',
    border: '1px solid #441e6a',
  },
  queueItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  queuePosition: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#fbbf24',
    width: '28px',
  },
  queueEntryDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  queueEntryName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f8fafc',
  },
  queueEntryTime: {
    fontSize: '11px',
    color: '#94a3b8',
  },
  queueActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  grantFloorBtn: {
    backgroundColor: '#f59e0b',
    color: '#0d0515',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)',
  },
  removeQueueBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    color: '#fb7185',
    border: '1px solid #f43f5e',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
