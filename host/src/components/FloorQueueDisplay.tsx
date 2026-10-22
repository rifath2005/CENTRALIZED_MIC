import React from 'react';
import { SpeakerInfo, QueueEntry } from '../types';

interface FloorQueueDisplayProps {
  currentSpeaker: SpeakerInfo | null;
  queue: QueueEntry[];
  onForceRevoke: () => void;
  onClearQueue: () => void;
}

export const FloorQueueDisplay: React.FC<FloorQueueDisplayProps> = ({
  currentSpeaker,
  queue,
  onForceRevoke,
  onClearQueue,
}) => {
  return (
    <div style={styles.container}>
      {/* Current Speaker Section */}
      <div style={styles.activeSpeakerCard}>
        <div style={styles.cardHeader}>
          <span style={styles.sectionBadge}>AUTHORITATIVE FLOOR</span>
          {currentSpeaker && (
            <button style={styles.revokeButton} onClick={onForceRevoke} title="Emergency Operator Cut">
              FORCE REVOKE FLOOR
            </button>
          )}
        </div>

        {currentSpeaker ? (
          <div style={styles.speakerInfo}>
            <div style={styles.liveIndicator}>
              <span style={styles.pulsingRing}></span>
              <span style={styles.liveBadge}>ON AIR</span>
            </div>
            <div style={styles.speakerDetails}>
              <h3 style={styles.speakerName}>{currentSpeaker.name}</h3>
              <p style={styles.speakerId}>ID: {currentSpeaker.id}</p>
            </div>
          </div>
        ) : (
          <div style={styles.floorVacant}>
            <span style={styles.vacantDot}></span>
            <p style={styles.vacantText}>Floor is open. Waiting for participant push-to-talk...</p>
          </div>
        )}
      </div>

      {/* Queue Section */}
      <div style={styles.queueCard}>
        <div style={styles.queueHeader}>
          <div style={styles.queueCountBadge}>
            WAITING QUEUE ({queue.length})
          </div>
          {queue.length > 0 && (
            <button style={styles.clearQueueButton} onClick={onClearQueue}>
              Clear Queue
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <p style={styles.emptyQueueText}>No participants currently in line.</p>
        ) : (
          <div style={styles.queueList}>
            {queue.map((entry, index) => (
              <div key={entry.id} style={styles.queueItem}>
                <span style={styles.queuePosition}>#{index + 1}</span>
                <div style={styles.queueEntryDetails}>
                  <span style={styles.queueEntryName}>{entry.name}</span>
                  <span style={styles.queueEntryTime}>
                    Waiting since {new Date(entry.requestedAt).toLocaleTimeString()}
                  </span>
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
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionBadge: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '1px',
  },
  revokeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid #ef4444',
    color: '#f87171',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  speakerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#064e3b',
    border: '1px solid #059669',
    borderRadius: '10px',
    padding: '16px',
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
    padding: '4px 10px',
    borderRadius: '6px',
    letterSpacing: '1px',
  },
  speakerDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  speakerName: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#ffffff',
  },
  speakerId: {
    fontSize: '12px',
    color: '#a7f3d0',
    fontFamily: 'monospace',
  },
  floorVacant: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
  },
  vacantDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#64748b',
  },
  vacantText: {
    fontSize: '13px',
    color: '#94a3b8',
  },
  queueCard: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
  },
  queueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  queueCountBadge: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#f59e0b',
    letterSpacing: '1px',
  },
  clearQueueButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '11px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  emptyQueueText: {
    fontSize: '13px',
    color: '#64748b',
    fontStyle: 'italic',
    padding: '8px 0',
  },
  queueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  queueItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '10px 14px',
    border: '1px solid #334155',
  },
  queuePosition: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#38bdf8',
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
};
