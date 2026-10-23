import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { acousticTheme } from '../theme/acousticTheme';

interface AcousticVuMeterProps {
  level: number; // 0.0 to 1.0 (linear RMS amplitude)
  active: boolean;
}

export const AcousticVuMeter: React.FC<AcousticVuMeterProps> = ({
  level,
  active,
}) => {
  // Convert 0..1 to dBFS (-48dB to 0dB)
  const clampedLevel = Math.max(0.0001, Math.min(1.0, level));
  const dbValue = active
    ? Math.max(-48, Math.round(20 * Math.log10(clampedLevel)))
    : -48;

  // 18 total LED segments per channel
  const TOTAL_SEGMENTS = 18;
  const GREEN_COUNT = 12; // -48dB to -6dB
  const AMBER_COUNT = 4;  // -6dB to -1dB
  const RED_COUNT = 2;    // -1dB to 0dB

  const activeSegments = active
    ? Math.min(TOTAL_SEGMENTS, Math.max(1, Math.round(level * TOTAL_SEGMENTS * 1.25)))
    : 0;

  const isClipping = active && activeSegments >= TOTAL_SEGMENTS;

  const renderMeterRail = (channelLabel: string) => (
    <View style={styles.railRow}>
      <Text style={styles.channelLabel}>{channelLabel}</Text>
      <View style={styles.railTrack}>
        {Array.from({ length: TOTAL_SEGMENTS }).map((_, index) => {
          const isLit = index < activeSegments;
          let color: string = acousticTheme.colors.secondary; // Emerald
          if (index >= GREEN_COUNT) color = acousticTheme.colors.primaryContainer; // Amber
          if (index >= GREEN_COUNT + AMBER_COUNT) color = acousticTheme.colors.error; // Red

          return (
            <View
              key={index}
              style={[
                styles.segment,
                {
                  backgroundColor: color,
                  opacity: isLit ? 1 : 0.18,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with Title, Clip Indicator, and Peak dB Readout */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>VU METER (dBFS)</Text>
          <View
            style={[
              styles.clipBadge,
              isClipping && styles.clipBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.clipText,
                isClipping && styles.clipTextActive,
              ]}
            >
              CLIP
            </Text>
          </View>
        </View>

        <View style={styles.peakGroup}>
          <Text style={styles.peakLabel}>PEAK:</Text>
          <Text style={styles.peakValue}>
            {active ? `${dbValue.toFixed(1)} dB` : '-∞ dB'}
          </Text>
        </View>
      </View>

      {/* Dual Rail Segmented Display */}
      <View style={styles.meterWell}>
        {renderMeterRail('L')}
        {renderMeterRail('R')}
      </View>

      {/* dB Scale Legend */}
      <View style={styles.scaleRow}>
        <Text style={styles.scaleText}>-48</Text>
        <Text style={styles.scaleText}>-24</Text>
        <Text style={styles.scaleText}>-12</Text>
        <Text style={styles.scaleText}>-6</Text>
        <Text style={styles.scaleText}>-3</Text>
        <Text style={[styles.scaleText, styles.scaleTextRed]}>0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: acousticTheme.colors.surfaceContainer,
    borderRadius: acousticTheme.borderRadius.lg,
    padding: acousticTheme.spacing.md,
    marginVertical: acousticTheme.spacing.sm,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '60',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.onSurface,
    letterSpacing: 0.8,
  },
  clipBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: acousticTheme.colors.surfaceHighest,
  },
  clipBadgeActive: {
    backgroundColor: acousticTheme.colors.errorContainer,
  },
  clipText: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.outlineVariant,
  },
  clipTextActive: {
    color: acousticTheme.colors.onErrorContainer,
  },
  peakGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peakLabel: {
    fontSize: 10,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onSurfaceVariant,
  },
  peakValue: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.primary,
  },
  meterWell: {
    backgroundColor: acousticTheme.colors.surfaceLowest,
    borderRadius: acousticTheme.borderRadius.md,
    padding: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceContainerLow,
  },
  railRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channelLabel: {
    width: 12,
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.outlineVariant,
  },
  railTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 10,
    gap: 2,
  },
  segment: {
    flex: 1,
    height: '100%',
    borderRadius: 1.5,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 6,
  },
  scaleText: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '600',
    color: acousticTheme.colors.outlineVariant,
  },
  scaleTextRed: {
    color: acousticTheme.colors.error,
    fontWeight: '800',
  },
});
