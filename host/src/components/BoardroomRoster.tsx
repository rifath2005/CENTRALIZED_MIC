import React from 'react';
import { BoardroomMember, SpeakerInfo, QueueEntry } from '../types';

interface BoardroomRosterProps {
  members: BoardroomMember[];
  currentSpeaker: SpeakerInfo | null;
  queue: QueueEntry[];
}

export const BoardroomRoster: React.FC<BoardroomRosterProps> = ({
  members,
  currentSpeaker,
  queue,
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div style={styles.titleGroup}>
          <span style={styles.badge}>ROOM ATTENDANCE</span>
          <h3 style={styles.title}>CONNECTED PHONES ({members.length})</h3>
        </div>
        <div style={styles.liveCountPill}>
          <span style={styles.greenDot}></span>
          <span>{members.length} {members.length === 1 ? 'Device' : 'Devices'} Online</span>
        </div>
      </div>

      {members.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>📱</span>
          <p style={styles.emptyText}>No attendees connected yet.</p>
          <p style={styles.emptySubtext}>
            Attendees who scan the QR code or enter the room code will appear here in real-time.
          </p>
        </div>
      ) : (
        <div style={styles.memberList}>
          {members.map((member) => {
            const isSpeaker = currentSpeaker?.id === member.identity;
            const queueIndex = queue.findIndex((q) => q.id === member.identity);
            const isQueued = queueIndex !== -1;

            let statusBadge = (
              <span style={styles.statusIdle}>
                <span style={styles.idleDot} /> READY
              </span>
            );

            if (isSpeaker) {
              statusBadge = (
                <span style={styles.statusSpeaking}>
                  <span style={styles.speakingDot} /> ON AIR
                </span>
              );
            } else if (isQueued) {
              statusBadge = (
                <span style={styles.statusQueued}>
                  <span style={styles.queuedDot} /> QUEUED #{queueIndex + 1}
                </span>
              );
            }

            return (
              <div
                key={member.identity}
                style={{
                  ...styles.memberCard,
                  borderColor: isSpeaker ? '#059669' : isQueued ? '#d97706' : '#1f2937',
                  backgroundColor: isSpeaker
                    ? 'rgba(6, 78, 59, 0.4)'
                    : isQueued
                    ? 'rgba(120, 53, 15, 0.2)'
                    : '#1e293b',
                }}
              >
                <div style={styles.memberLeft}>
                  <div style={styles.avatarIcon}>
                    {isSpeaker ? '🎙️' : '📱'}
                  </div>
                  <div>
                    <h4 style={styles.memberName}>{member.name}</h4>
                    <span style={styles.memberId}>{member.identity}</span>
                  </div>
                </div>

                <div style={styles.memberRight}>
                  {statusBadge}
                  <span style={styles.joinTime}>
                    Joined {new Date(member.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '12px',
    padding: '20px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #1f2937',
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '1px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#f8fafc',
    margin: 0,
  },
  liveCountPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid #059669',
    color: '#34d399',
    fontSize: '12px',
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: '20px',
  },
  greenDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#34d399',
    boxShadow: '0 0 8px #34d399',
  },
  emptyState: {
    padding: '32px 16px',
    textAlign: 'center',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    border: '1px dashed #334155',
  },
  emptyIcon: {
    fontSize: '32px',
    display: 'block',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#cbd5e1',
    margin: '0 0 4px 0',
  },
  emptySubtext: {
    fontSize: '12px',
    color: '#64748b',
    margin: 0,
    maxWidth: '360px',
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: 1.5,
  },
  memberList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '320px',
    overflowY: 'auto',
  },
  memberCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    transition: 'all 0.2s ease',
  },
  memberLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatarIcon: {
    fontSize: '20px',
  },
  memberName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#f8fafc',
    margin: 0,
  },
  memberId: {
    fontSize: '11px',
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  memberRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  statusSpeaking: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#059669',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: '4px',
    letterSpacing: '0.5px',
  },
  speakingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
  },
  statusQueued: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#d97706',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: '4px',
    letterSpacing: '0.5px',
  },
  queuedDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
  },
  statusIdle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#334155',
    color: '#94a3b8',
    fontSize: '10px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '4px',
  },
  idleDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#64748b',
  },
  joinTime: {
    fontSize: '10px',
    color: '#64748b',
  },
};
