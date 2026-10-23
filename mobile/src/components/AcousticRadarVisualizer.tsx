import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { acousticTheme } from '../theme/acousticTheme';

interface AcousticRadarVisualizerProps {
  roomCode: string;
  onCancel: () => void;
  audioLevel?: number;
}

export const AcousticRadarVisualizer: React.FC<AcousticRadarVisualizerProps> = ({
  roomCode,
  onCancel,
  audioLevel = 0.25,
}) => {
  const radarPulse = useRef(new Animated.Value(1)).current;
  const radarOpacity = useRef(new Animated.Value(0.7)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

  // Concentric radar ring expansion animation
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(radarPulse, {
            toValue: 1.35,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(radarPulse, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(radarOpacity, {
            toValue: 0.15,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(radarOpacity, {
            toValue: 0.7,
            duration: 1800,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 2400,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    sweepLoop.start();

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
    };
  }, [radarPulse, radarOpacity, sweepAnim]);

  // Pre-broadcast VU level segments
  const activeSegments = Math.max(2, Math.round(audioLevel * 14));

  return (
    <View style={styles.container}>
      {/* Top Breadcrumb Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.cellTowerBadge}>
            <Text style={styles.cellTowerIcon}>📡</Text>
          </View>
          <Text style={styles.brandTitle}>AirMic Live</Text>
        </View>

        {/* Encrypted Room Badge */}
        <View style={styles.roomBadge}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.roomCodeText}>{roomCode}</Text>
          <View style={styles.livePulseDot} />
        </View>
      </View>

      {/* Hero Acoustic Radar Visualizer Card */}
      <View style={styles.radarCard}>
        {/* Pulsating Concentric Radar Rings */}
        <View style={styles.radarWell}>
          <Animated.View
            style={[
              styles.outerRing,
              {
                transform: [{ scale: radarPulse }],
                opacity: radarOpacity,
              },
            ]}
          />
          <View style={styles.midRing} />
          <View style={styles.innerRing} />

          {/* Central Target Mic Glyph */}
          <View style={styles.centerTarget}>
            <Text style={styles.centerMicIcon}>🎙️</Text>
            <Text style={styles.centerSyncLabel}>SYNC</Text>
          </View>
        </View>

        {/* Handshake Status Subheading */}
        <View style={styles.statusGroup}>
          <View style={styles.connectingPill}>
            <View style={styles.connectingPulse} />
            <Text style={styles.connectingText}>CONNECTING STAGE</Text>
          </View>
          <Text style={styles.connectingDesc}>
            Negotiating low-latency audio stream with host console
          </Text>
        </View>
      </View>

      {/* Pre-Broadcast Input Level Preview */}
      <View style={styles.preLevelCard}>
        <View style={styles.preLevelHeader}>
          <Text style={styles.preLevelTitle}>INPUT LEVEL PREVIEW</Text>
          <Text style={styles.preLevelDb}>-14.2 dB</Text>
        </View>
        <View style={styles.vuTrack}>
          {Array.from({ length: 14 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.vuSegment,
                {
                  backgroundColor:
                    i < 9
                      ? acousticTheme.colors.secondary
                      : i < 12
                      ? acousticTheme.colors.primaryContainer
                      : acousticTheme.colors.error,
                  opacity: i < activeSegments ? 1 : 0.2,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.preLevelFooter}>
          <Text style={styles.preLevelFooterText}>-48 dB</Text>
          <Text style={styles.preLevelFooterText}>MIC PRE-GAIN OK (48kHz FLAC/OPUS)</Text>
          <Text style={[styles.preLevelFooterText, { color: acousticTheme.colors.error }]}>0 dB CLIP</Text>
        </View>
      </View>

      {/* Audio Pipeline Handshake Steps */}
      <View style={styles.pipelineCard}>
        <View style={styles.pipelineHeader}>
          <Text style={styles.pipelineTitle}>AUDIO PIPELINE HANDSHAKE</Text>
          <Text style={styles.pipelineSub}>ICE GATHERING</Text>
        </View>

        {/* Step 1 */}
        <View style={styles.pipelineStep}>
          <View style={styles.stepCheck}>
            <Text style={styles.stepCheckIcon}>✓</Text>
          </View>
          <View style={styles.stepContent}>
            <View style={styles.stepRow}>
              <Text style={styles.stepName}>Verifying Room Token...</Text>
              <Text style={styles.stepOk}>OK</Text>
            </View>
            <Text style={styles.stepSub}>Auth: RSA-4096 Signer verified</Text>
          </View>
        </View>

        {/* Step 2 */}
        <View style={styles.pipelineStepActive}>
          <View style={styles.stepSpin}>
            <Text style={styles.stepSpinIcon}>⚡</Text>
          </View>
          <View style={styles.stepContent}>
            <View style={styles.stepRow}>
              <Text style={styles.stepNameActive}>Establishing Opus Pipeline...</Text>
              <Text style={styles.stepBitrate}>48 kbps/ch</Text>
            </View>
            <Text style={styles.stepSub}>SDP Answer generated · STUN host matched</Text>
          </View>
        </View>

        {/* Step 3 */}
        <View style={[styles.pipelineStep, { opacity: 0.6 }]}>
          <View style={styles.stepQueued}>
            <Text style={styles.stepQueuedIcon}>⏱️</Text>
          </View>
          <View style={styles.stepContent}>
            <View style={styles.stepRow}>
              <Text style={styles.stepName}>Calibrating Buffer & Latency (&lt;12ms)...</Text>
              <Text style={styles.stepQueuedLabel}>QUEUED</Text>
            </View>
            <Text style={styles.stepSub}>Target Jitter: 2.4ms · Ring buffer 64f</Text>
          </View>
        </View>
      </View>

      {/* Raw WebRTC Telemetry Log Box */}
      <View style={styles.telemetryBox}>
        <View style={styles.telemetryHeader}>
          <Text style={styles.telemetryTitle}>&gt; ICE NEGOTIATION LOG</Text>
          <Text style={styles.telemetryRtt}>RTT: ~9.8ms</Text>
        </View>
        <Text style={styles.telemetryLine}>&gt; ICE candidate srflx accepted</Text>
        <Text style={styles.telemetryLine}>&gt; DTLS cipher suite: TLS_ECDHE_ECDSA</Text>
        <Text style={[styles.telemetryLine, { color: acousticTheme.colors.primary }]}>&gt; WebRTC DataChannel [audio-control-v1] open</Text>
      </View>

      {/* Cancel Action Button */}
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={onCancel}
        activeOpacity={0.8}
      >
        <Text style={styles.cancelBtnText}>✕ Cancel Stage Handshake</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: acousticTheme.spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: acousticTheme.spacing.sm,
    marginBottom: acousticTheme.spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cellTowerBadge: {
    width: 32,
    height: 32,
    borderRadius: acousticTheme.borderRadius.sm,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellTowerIcon: {
    fontSize: 16,
  },
  brandTitle: {
    fontSize: 18,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.onSurface,
    letterSpacing: 0.5,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: acousticTheme.borderRadius.sm,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    gap: 6,
  },
  lockIcon: {
    fontSize: 12,
  },
  roomCodeText: {
    fontSize: 12,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.primary,
    letterSpacing: 1,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: acousticTheme.colors.primary,
  },
  radarCard: {
    backgroundColor: acousticTheme.colors.surfaceContainer,
    borderRadius: acousticTheme.borderRadius.lg,
    padding: acousticTheme.spacing.lg,
    alignItems: 'center',
    marginBottom: acousticTheme.spacing.md,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '60',
  },
  radarWell: {
    position: 'relative',
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  outerRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: acousticTheme.colors.primaryContainer,
  },
  midRing: {
    position: 'absolute',
    width: 125,
    height: 125,
    borderRadius: 62.5,
    borderWidth: 1.5,
    borderColor: acousticTheme.colors.surfaceContainerHigh,
  },
  innerRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: acousticTheme.colors.surfaceLowest,
  },
  centerTarget: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: acousticTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  centerMicIcon: {
    fontSize: 26,
  },
  centerSyncLabel: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.primary,
    letterSpacing: 1,
  },
  statusGroup: {
    alignItems: 'center',
    marginTop: 8,
  },
  connectingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: acousticTheme.borderRadius.full,
    backgroundColor: acousticTheme.colors.surfaceLowest,
    gap: 6,
    marginBottom: 6,
  },
  connectingPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: acousticTheme.colors.primaryContainer,
  },
  connectingText: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.primary,
    letterSpacing: 1,
  },
  connectingDesc: {
    fontSize: 12,
    fontFamily: 'Courier',
    color: acousticTheme.colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 260,
  },
  preLevelCard: {
    backgroundColor: acousticTheme.colors.surfaceContainer,
    borderRadius: acousticTheme.borderRadius.lg,
    padding: acousticTheme.spacing.md,
    marginBottom: acousticTheme.spacing.md,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '50',
  },
  preLevelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  preLevelTitle: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.onSurface,
    letterSpacing: 0.8,
  },
  preLevelDb: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.secondary,
  },
  vuTrack: {
    flexDirection: 'row',
    height: 12,
    backgroundColor: acousticTheme.colors.surfaceLowest,
    borderRadius: 6,
    padding: 2,
    gap: 3,
  },
  vuSegment: {
    flex: 1,
    borderRadius: 2,
  },
  preLevelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  preLevelFooterText: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
  },
  pipelineCard: {
    backgroundColor: acousticTheme.colors.surfaceContainer,
    borderRadius: acousticTheme.borderRadius.lg,
    padding: acousticTheme.spacing.md,
    marginBottom: acousticTheme.spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '50',
  },
  pipelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  pipelineTitle: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.onSurface,
    letterSpacing: 0.8,
  },
  pipelineSub: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
  },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    borderRadius: acousticTheme.borderRadius.sm,
    gap: 8,
  },
  pipelineStepActive: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    borderRadius: acousticTheme.borderRadius.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: acousticTheme.colors.primaryContainer + '80',
  },
  stepCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: acousticTheme.colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCheckIcon: {
    fontSize: 11,
    fontWeight: '800',
    color: acousticTheme.colors.onSecondary,
  },
  stepSpin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: acousticTheme.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSpinIcon: {
    fontSize: 10,
  },
  stepQueued: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: acousticTheme.colors.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepQueuedIcon: {
    fontSize: 10,
  },
  stepContent: {
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepName: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '600',
    color: acousticTheme.colors.onSurface,
  },
  stepNameActive: {
    fontSize: 11,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.primary,
  },
  stepOk: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.secondary,
  },
  stepBitrate: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.primary,
  },
  stepQueuedLabel: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.outlineVariant,
  },
  stepSub: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
    marginTop: 1,
  },
  telemetryBox: {
    backgroundColor: acousticTheme.colors.surfaceLowest,
    borderRadius: acousticTheme.borderRadius.md,
    padding: acousticTheme.spacing.md,
    marginBottom: acousticTheme.spacing.lg,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '40',
  },
  telemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  telemetryTitle: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.primary,
  },
  telemetryRtt: {
    fontSize: 9,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.secondary,
  },
  telemetryLine: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: acousticTheme.colors.outlineVariant,
    lineHeight: 14,
  },
  cancelBtn: {
    width: '100%',
    minHeight: 46,
    borderRadius: acousticTheme.borderRadius.md,
    backgroundColor: acousticTheme.colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest,
    marginBottom: 24,
  },
  cancelBtnText: {
    fontSize: 12,
    fontFamily: 'Courier',
    fontWeight: '700',
    color: acousticTheme.colors.onSurfaceVariant,
  },
});
