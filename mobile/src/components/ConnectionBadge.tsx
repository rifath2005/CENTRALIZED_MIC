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
          qualityText: quality === 'excellent' ? 'HD AUDIO' : 'CONNECTED',
        };
      case 'connecting':
        return {
          bg: '#3b0764',
          dot: '#c084fc',
          border: '#7e22ce',
          label: 'CONNECTING...',
          qualityText: 'CONNECTING...',
        };
      case 'reconnecting':
        return {
          bg: '#581c87',
          dot: '#d8b4fe',
          border: '#a855f7',
          label: 'RECONNECTING',
          qualityText: 'RECONNECTING...',
        };
      case 'offline':
      default:
        return {
          bg: '#160a24',
          dot: '#7e6b99',
          border: '#4d2179',
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
