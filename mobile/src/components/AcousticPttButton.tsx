import React, { useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  Vibration,
  TouchableOpacity,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { FloorHoldState } from '../types/floor';
import { acousticTheme } from '../theme/acousticTheme';

export type MicInteractionMode = 'hold' | 'toggle';

interface AcousticPttButtonProps {
  holdState: FloorHoldState;
  disabled: boolean;
  queuePosition: number | null;
  currentSpeakerName: string | null;
  interactionMode: MicInteractionMode;
  onModeChange: (mode: MicInteractionMode) => void;
  onPressIn: () => void;
  onPressOut: () => void;
  onTogglePress: () => void;
  onLeaveQueue: () => void;
}

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const AcousticPttButton: React.FC<AcousticPttButtonProps> = ({
  holdState,
  disabled,
  queuePosition,
  currentSpeakerName: _currentSpeakerName,
  interactionMode,
  onModeChange,
  onPressIn,
  onPressOut,
  onTogglePress,
  onLeaveQueue: _onLeaveQueue,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowOpacityAnim = useRef(new Animated.Value(0.1)).current;
  const glowScaleAnim = useRef(new Animated.Value(1)).current;
  const [talkSeconds, setTalkSeconds] = useState(0);

  // Live talk duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (holdState === 'speaking') {
      setTalkSeconds(0);
      timer = setInterval(() => {
        setTalkSeconds((s) => s + 1);
      }, 1000);
    } else {
      setTalkSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [holdState]);

  // Radiating broadcast glow animation when speaking
  useEffect(() => {
    let loopAnim: Animated.CompositeAnimation | null = null;
    if (holdState === 'speaking') {
      loopAnim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(glowScaleAnim, {
              toValue: 1.18,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(glowScaleAnim, {
              toValue: 1,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glowOpacityAnim, {
              toValue: 0.65,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacityAnim, {
              toValue: 0.2,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      loopAnim.start();
    } else {
      glowScaleAnim.setValue(1);
      glowOpacityAnim.setValue(0.1);
    }
    return () => {
      if (loopAnim) loopAnim.stop();
    };
  }, [holdState, glowScaleAnim, glowOpacityAnim]);

  const triggerHaptic = (type: 'impactHeavy' | 'selection') => {
    try {
      ReactNativeHapticFeedback.trigger(type, hapticOptions);
    } catch {
      Vibration.vibrate(type === 'impactHeavy' ? 30 : 15);
    }
  };

  const handlePressIn = () => {
    if (disabled) return;
    if (interactionMode === 'hold') {
      triggerHaptic('impactHeavy');
      Animated.spring(scaleAnim, {
        toValue: 0.94,
        useNativeDriver: true,
        speed: 25,
      }).start();
      onPressIn();
    }
  };

  const handlePressOut = () => {
    if (disabled) return;
    if (interactionMode === 'hold') {
      triggerHaptic('selection');
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
      }).start();
      onPressOut();
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    if (interactionMode === 'toggle') {
      triggerHaptic(holdState === 'speaking' ? 'selection' : 'impactHeavy');
      onTogglePress();
    }
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Determine button state visuals
  const isSpeaking = holdState === 'speaking';
  const isQueued = holdState === 'queued';
  const isRequesting = holdState === 'requesting';

  let mainLabel = 'PUSH TO TALK';
  let subLabel = interactionMode === 'hold' ? 'HOLD KEY' : 'TAP TO BROADCAST';
  let iconGlyph = '🎙️';
  let wellBg: string = acousticTheme.colors.surfaceContainerHigh;
  let wellBorder: string = acousticTheme.colors.surfaceHighest;
  let iconBg: string = acousticTheme.colors.surfaceHighest;
  let labelColor: string = acousticTheme.colors.onSurfaceVariant;
  let glowColor: string = acousticTheme.colors.primaryContainer;

  if (isSpeaking) {
    mainLabel = `ON AIR ${formatTimer(talkSeconds)}`;
    subLabel = interactionMode === 'hold' ? 'RELEASE TO MUTE' : 'TAP TO END SPEECH';
    iconGlyph = '🔴';
    wellBg = '#003824'; // Rich emerald well
    wellBorder = acousticTheme.colors.secondary;
    iconBg = acousticTheme.colors.secondaryContainer;
    labelColor = acousticTheme.colors.secondary;
    glowColor = acousticTheme.colors.secondary;
  } else if (isQueued) {
    mainLabel = `IN QUEUE #${queuePosition ?? 1}`;
    subLabel = 'HOLDING YOUR SPOT IN LINE';
    iconGlyph = '⏳';
    wellBg = '#472a00'; // Amber well
    wellBorder = acousticTheme.colors.primaryContainer;
    iconBg = acousticTheme.colors.primaryContainer;
    labelColor = acousticTheme.colors.primary;
    glowColor = acousticTheme.colors.primaryContainer;
  } else if (isRequesting) {
    mainLabel = 'CONNECTING...';
    subLabel = 'CONNECTING TO STAGE';
    iconGlyph = '⚡';
    wellBg = '#303541';
    wellBorder = acousticTheme.colors.primary;
    labelColor = acousticTheme.colors.primary;
  }

  return (
    <View style={styles.container}>
      {/* MOB-ST-06: Mute / Transmission State Indicator Pill */}
      <View style={styles.indicatorContainer}>
        <View
          style={[
            styles.indicatorPill,
            isSpeaking && styles.indicatorPillSpeaking,
            isQueued && styles.indicatorPillQueued,
          ]}
        >
          <View
            style={[
              styles.indicatorDot,
              isSpeaking && styles.indicatorDotSpeaking,
              isQueued && styles.indicatorDotQueued,
            ]}
          />
          <Text
            style={[
              styles.indicatorText,
              isSpeaking && styles.indicatorTextSpeaking,
              isQueued && styles.indicatorTextQueued,
            ]}
          >
            {isSpeaking ? 'ON AIR' : isQueued ? 'QUEUED' : 'MUTED'}
          </Text>
        </View>
      </View>

      {/* MOB-ST-04: Giant Push-to-Talk (PTT) Central Illuminated Button (220px) */}
      <View style={styles.buttonWrapper}>
        {/* Radiating Ambient Glow */}
        <Animated.View
          style={[
            styles.radiatingGlow,
            {
              backgroundColor: glowColor,
              opacity: isSpeaking ? glowOpacityAnim : 0.05,
              transform: [{ scale: glowScaleAnim }],
            },
          ]}
        />

        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable
            disabled={disabled}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleToggle}
            style={[
              styles.pttButtonSurface,
              {
                borderColor: wellBorder,
              },
            ]}
          >
            {/* Recessed Inner Well Ring */}
            <View
              style={[
                styles.innerWell,
                {
                  backgroundColor: wellBg,
                  borderColor: wellBorder + '80',
                },
              ]}
            >
              {/* Central Mic Icon Box */}
              <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
                <Text style={styles.iconText}>{iconGlyph}</Text>
              </View>

              {/* Main Label */}
              <Text style={[styles.mainLabel, { color: labelColor }]}>
                {mainLabel}
              </Text>

              {/* Sub Label */}
              <Text style={styles.subLabel}>{subLabel}</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* MOB-ST-05: PTT Mode Switch Toggle (Hold to Talk vs Tap to Toggle) */}
      <View style={styles.modeSwitcher}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            interactionMode === 'hold' && styles.modeButtonActive,
          ]}
          onPress={() => onModeChange('hold')}
          disabled={isSpeaking}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.modeButtonText,
              interactionMode === 'hold' && styles.modeButtonTextActive,
            ]}
          >
            👉 Hold to Talk
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            interactionMode === 'toggle' && styles.modeButtonActive,
          ]}
          onPress={() => onModeChange('toggle')}
          disabled={isSpeaking}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.modeButtonText,
              interactionMode === 'toggle' && styles.modeButtonTextActive,
            ]}
          >
            🔒 Tap to Toggle
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: acousticTheme.spacing.md,
  },
  indicatorContainer: {
    marginBottom: acousticTheme.spacing.md,
  },
  indicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: acousticTheme.borderRadius.full,
    backgroundColor: acousticTheme.colors.surfaceHighest,
    gap: 8,
  },
  indicatorPillSpeaking: {
    backgroundColor: '#003824',
    borderWidth: 1,
    borderColor: acousticTheme.colors.secondary,
  },
  indicatorPillQueued: {
    backgroundColor: '#472a00',
    borderWidth: 1,
    borderColor: acousticTheme.colors.primaryContainer,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: acousticTheme.colors.outlineVariant,
  },
  indicatorDotSpeaking: {
    backgroundColor: acousticTheme.colors.secondary,
  },
  indicatorDotQueued: {
    backgroundColor: acousticTheme.colors.primary,
  },
  indicatorText: {
    fontSize: 12,
    fontFamily: 'Courier',
    fontWeight: '800',
    color: acousticTheme.colors.onSurfaceVariant,
    letterSpacing: 1.2,
  },
  indicatorTextSpeaking: {
    color: acousticTheme.colors.secondary,
  },
  indicatorTextQueued: {
    color: acousticTheme.colors.primary,
  },
  buttonWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 240,
    height: 240,
  },
  radiatingGlow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  pttButtonSurface: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: acousticTheme.colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  innerWell: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 12,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  iconText: {
    fontSize: 28,
  },
  mainLabel: {
    fontSize: 14,
    fontFamily: 'Courier',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  subLabel: {
    fontSize: 10,
    fontFamily: 'Courier',
    fontWeight: '600',
    color: acousticTheme.colors.outlineVariant,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  modeSwitcher: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 320,
    backgroundColor: acousticTheme.colors.surfaceContainerLow,
    borderRadius: acousticTheme.borderRadius.lg,
    padding: 4,
    marginTop: acousticTheme.spacing.lg,
    borderWidth: 1,
    borderColor: acousticTheme.colors.surfaceHighest + '50',
  },
  modeButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: acousticTheme.borderRadius.md,
    paddingHorizontal: 8,
  },
  modeButtonActive: {
    backgroundColor: acousticTheme.colors.surfaceHighest,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 12,
    fontFamily: 'Courier',
    fontWeight: '600',
    color: acousticTheme.colors.onSurfaceVariant,
  },
  modeButtonTextActive: {
    color: acousticTheme.colors.primary,
    fontWeight: '800',
  },
});
