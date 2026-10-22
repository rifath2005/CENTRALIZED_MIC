import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface AudioLevelMeterProps {
  level: number; // 0.0 to 1.0
  active: boolean;
  gainBoost?: number; // 1.0, 1.25, 1.5
}

export const AudioLevelMeter: React.FC<AudioLevelMeterProps> = ({
  level,
  active,
  gainBoost = 1.0,
}) => {
  const segments = 16;
  const activeSegments = active ? Math.min(Math.round(level * segments * 1.3), segments) : 0;
  const isSpeaking = active && activeSegments > 1;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithBoost}>
          <Text style={styles.label}>MIC INPUT LEVEL</Text>
          {gainBoost > 1.0 && (
            <View style={styles.boostPill}>
              <Text style={styles.boostPillText}>{Math.round(gainBoost * 100)}% BOOST</Text>
            </View>
          )}
        </View>

        <Text
          style={[
            styles.statusText,
            { color: isSpeaking ? '#34d399' : active ? '#38bdf8' : '#64748b' },
          ]}
        >
          {isSpeaking ? '● BROADCASTING' : active ? 'STANDBY' : 'MUTED'}
        </Text>
      </View>

      <View style={styles.meterBar}>
        {Array.from({ length: segments }).map((_, index) => {
          const isLit = index < activeSegments;
          let color = '#10b981'; // Nominal green (0-10)
          if (index >= 11) color = '#f59e0b'; // Amber headroom (11-13)
          if (index >= 14) color = '#ef4444'; // Peak limit (14-15)

          return (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor: isLit ? color : '#1e293b',
                  opacity: isLit ? 1 : 0.25,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Scale labels */}
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleText}>-40dB</Text>
        <Text style={styles.scaleText}>-24dB</Text>
        <Text style={styles.scaleText}>-12dB</Text>
        <Text style={styles.scaleText}>-3dB</Text>
        <Text style={[styles.scaleText, { color: '#ef4444' }]}>0dB</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    marginBottom: 6,
  },
  titleWithBoost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  boostPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#0284c7',
  },
  boostPillText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '800',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  meterBar: {
    flexDirection: 'row',
    height: 14,
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#090d16',
    borderRadius: 7,
    padding: 3,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  segment: {
    flex: 1,
    height: '100%',
    marginHorizontal: 1,
    borderRadius: 2,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 320,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  scaleText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
  },
});
