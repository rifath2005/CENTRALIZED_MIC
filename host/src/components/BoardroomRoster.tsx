import React, { useState, useMemo } from 'react';
import { BoardroomMember, SpeakerInfo, QueueEntry } from '../types';
import { redTheme } from '../tokens/redTheme';

interface BoardroomRosterProps {
  members: BoardroomMember[];
  currentSpeaker: SpeakerInfo | null;
  queue: QueueEntry[];
  onGrantFloor?: (id: string, name: string) => void;
}

// Generate consistent soft avatar background colors
function getAvatarColor(name: string): string {
  const colors = ['#2563eb', '#059669', '#7c3aed', '#d97706', '#db2777', '#0891b2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/[\s-_]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export const BoardroomRoster: React.FC<BoardroomRosterProps> = ({
  members,
  currentSpeaker,
  queue,
  onGrantFloor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) => m.name.toLowerCase().includes(query) || m.identity.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <div style={styles.headerRow}>
        <div style={styles.titleGroup}>
          <span style={styles.badge}>ROOM ATTENDANCE</span>
          <h3 style={styles.title}>CONNECTED PHONES ({members.length})</h3>
        </div>

        <div style={styles.liveCountPill}>
          <span className="pulse-live" style={styles.greenDot} />
          <span>{members.length} {members.length === 1 ? 'Device' : 'Devices'} Online</span>
        </div>
      </div>

      {/* Search Bar if multiple members */}
      {members.length > 3 && (
        <div style={styles.searchContainer}>
          <input
            type="text"
            style={styles.searchInput}
            placeholder="Search attendees by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button style={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>
      )}

      {/* Member List */}
      {members.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>📱</span>
          <p style={styles.emptyText}>No attendees connected yet.</p>
          <p style={styles.emptySubtext}>
            Attendees who scan the QR code or enter the room code will appear here automatically.
          </p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No matching attendees found.</p>
        </div>
      ) : (
        <div style={styles.memberList}>
          {filteredMembers.map((member) => {
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
                  <span style={styles.queuedDot} /> LINE #{queueIndex + 1}
                </span>
              );
            }

            return (
              <div
                key={member.identity}
                style={{
                  ...styles.memberCard,
                  borderColor: isSpeaker
                    ? redTheme.colors.statusOnAir
                    : isQueued
                    ? redTheme.colors.statusInQueue
                    : redTheme.colors.borderSubtle,
                  backgroundColor: isSpeaker
                    ? redTheme.colors.statusOnAirBg
                    : isQueued
                    ? redTheme.colors.statusInQueueBg
                    : redTheme.colors.bgSurfaceDark,
                }}
              >
                <div style={styles.memberLeft}>
                  {/* Initials Avatar */}
                  <div
                    style={{
                      ...styles.avatar,
                      backgroundColor: getAvatarColor(member.name),
                    }}
                  >
                    {isSpeaker ? '🎙️' : getInitials(member.name)}
                  </div>
                  <div style={styles.nameDetails}>
                    <h4 style={styles.memberName}>{member.name}</h4>
                    <span style={styles.memberId}>ID: {member.identity}</span>
                  </div>
                </div>

                <div style={styles.memberRight}>
                  {statusBadge}
                  {onGrantFloor && !isSpeaker && (
                    <button
                      style={styles.grantFloorBtn}
                      onClick={() => onGrantFloor(member.identity, member.name)}
                      title="Pass microphone to this attendee"
                    >
                      Give Floor
                    </button>
                  )}
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
    backgroundColor: redTheme.colors.bgSurfaceCard,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '14px',
    padding: '20px',
    boxShadow: redTheme.shadows.card,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${redTheme.colors.borderSubtle}`,
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 800,
    color: redTheme.colors.accentBright,
    letterSpacing: '1px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 800,
    color: redTheme.colors.textPrimary,
    margin: 0,
  },
  liveCountPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    color: redTheme.colors.textSecondary,
    fontSize: '12px',
    fontWeight: 700,
    padding: '6px 14px',
    borderRadius: '20px',
  },
  greenDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: redTheme.colors.statusOnAir,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: '14px',
  },
  searchInput: {
    width: '100%',
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    color: redTheme.colors.textPrimary,
    outline: 'none',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: redTheme.colors.textMuted,
    cursor: 'pointer',
    fontSize: '12px',
  },
  emptyState: {
    padding: '36px 16px',
    textAlign: 'center',
    backgroundColor: redTheme.colors.bgSurfaceDark,
    borderRadius: '10px',
    border: `1px dashed ${redTheme.colors.borderSubtle}`,
  },
  emptyIcon: {
    fontSize: '32px',
    display: 'block',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    fontWeight: 700,
    color: redTheme.colors.textSecondary,
    margin: '0 0 4px 0',
  },
  emptySubtext: {
    fontSize: '12px',
    color: redTheme.colors.textMuted,
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
    padding: '12px 14px',
    borderRadius: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    transition: 'all 0.2s ease',
  },
  memberLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 800,
    color: '#ffffff',
    flexShrink: 0,
  },
  nameDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  memberName: {
    fontSize: '14px',
    fontWeight: 750,
    color: redTheme.colors.textPrimary,
    margin: 0,
  },
  memberId: {
    fontSize: '10px',
    color: redTheme.colors.textMuted,
    fontFamily: 'monospace',
  },
  memberRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  grantFloorBtn: {
    backgroundColor: redTheme.colors.bgSurfaceElevated,
    border: `1px solid ${redTheme.colors.borderMedium}`,
    color: redTheme.colors.accentBright,
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  statusSpeaking: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: redTheme.colors.statusOnAir,
    color: '#022c22',
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
    backgroundColor: '#022c22',
  },
  statusQueued: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: redTheme.colors.statusInQueueBg,
    border: `1px solid ${redTheme.colors.statusInQueue}`,
    color: redTheme.colors.statusInQueueText,
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
    backgroundColor: redTheme.colors.statusInQueue,
  },
  statusIdle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: redTheme.colors.bgSurfaceDark,
    border: `1px solid ${redTheme.colors.borderSubtle}`,
    color: redTheme.colors.textMuted,
    fontSize: '10px',
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: '4px',
  },
  idleDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: redTheme.colors.borderMedium,
  },
};

