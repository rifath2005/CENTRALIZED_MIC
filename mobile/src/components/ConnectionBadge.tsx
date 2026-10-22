import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { ConnectionState } from '../types/floor';

interface ConnectionBadgeProps {
  state: ConnectionState;
  roomName?: string;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ state, roomName }) => {
  const getBadgeConfig = () => {
    switch (state) {
      case 'connected':
        return {
          bg: '#064e3b',
          dot: '#34d399',
          border: '#059669',
          label: roomName ? `CONNECTED: ${roomName}` : 'CONNECTED',
        };
      case 'connecting':
        return {
          bg: '#451a03',
          dot: '#f59e0b',
          border: '#d97706',
          label: 'CONNECTING...',
        };
      case 'reconnecting':
        return {
          bg: '#701a75',
          dot: '#e879f9',
          border: '#c026d3',
          label: 'HANDOFF / RECONNECTING...',
        };
      case 'offline':
      default:
        return {
          bg: '#1e293b',
          dot: '#64748b',
          border: '#334155',
          label: 'OFFLINE',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={styles.text}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'center',
    marginVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
