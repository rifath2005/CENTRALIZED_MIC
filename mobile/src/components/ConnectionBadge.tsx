import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { ConnectionState } from '../types/floor';

interface ConnectionBadgeProps {
  state: ConnectionState;
  roomName?: string;
  quality?: 'excellent' | 'good' | 'poor' | 'unknown';
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({
  state,
  roomName,
  quality = 'excellent',
}) => {
  const getBadgeConfig = () => {
    switch (state) {
      case 'connected':
        return {
          bg: '#052e16',
          dot: '#22c55e',
          border: '#15803d',
          label: roomName ? `ROOM: ${roomName}` : 'LIVE CONNECTED',
          qualityText: quality === 'excellent' ? '48kHz HD' : 'CONNECTED',
        };
      case 'connecting':
        return {
          bg: '#451a03',
          dot: '#f59e0b',
          border: '#d97706',
          label: 'CONNECTING...',
          qualityText: 'BRIDGING SFU',
        };
      case 'reconnecting':
        return {
          bg: '#701a75',
          dot: '#e879f9',
          border: '#c026d3',
          label: 'RECONNECTING',
          qualityText: 'HANDOFF',
        };
      case 'offline':
      default:
        return {
          bg: '#0f172a',
          dot: '#64748b',
          border: '#1e293b',
          label: 'OFFLINE',
          qualityText: 'STANDBY',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={styles.text}>{config.label}</Text>
      <View style={styles.divider} />
      <Text style={styles.qualityLabel}>{config.qualityText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
    marginVertical: 4,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  divider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  qualityLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
