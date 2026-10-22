import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface AudioLevelMeterProps {
  level: number; // 0.0 to 1.0
  active: boolean;
}

export const AudioLevelMeter: React.FC<AudioLevelMeterProps> = ({ level, active }) => {
  // 12 segments for the LED meter
  const segments = 12;
  const activeSegments = Math.round(level * segments);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>MIC INPUT LEVEL</Text>
      <View style={styles.meterBar}>
        {Array.from({ length: segments }).map((_, index) => {
          const isLit = active && index <= activeSegments;
          // Colors: green for normal levels (0-8), yellow for higher (9-10), red for peak (11)
          let color = '#22c55e';
          if (index >= 9) color = '#eab308';
          if (index >= 11) color = '#ef4444';

          return (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor: isLit ? color : '#334155',
                  opacity: isLit ? 1 : 0.35,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 24,
    marginVertical: 12,
    alignItems: 'center',
  },
  label: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  meterBar: {
    flexDirection: 'row',
    height: 12,
    width: '100%',
    maxWidth: 260,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  segment: {
    flex: 1,
    height: '100%',
    marginHorizontal: 1.5,
    borderRadius: 2,
  },
});
