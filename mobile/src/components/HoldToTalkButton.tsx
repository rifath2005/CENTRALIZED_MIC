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

export type MicInteractionMode = 'hold' | 'toggle';

interface HoldToTalkButtonProps {
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

export const HoldToTalkButton: React.FC<HoldToTalkButtonProps> = ({
  holdState,
  disabled,
  queuePosition,
  currentSpeakerName,
  interactionMode,
  onModeChange,
  onPressIn,
  onPressOut,
  onTogglePress,
  onLeaveQueue,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const ringScaleAnim = useRef(new Animated.Value(1)).current;
  const ringOpacityAnim = useRef(new Animated.Value(0.6)).current;
  const [talkSeconds, setTalkSeconds] = useState(0);

  // Live talk timer while speaking
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

  // Soundwave ripple animation when speaking
  useEffect(() => {
    let loopAnim: Animated.CompositeAnimation | null = null;
    if (holdState === 'speaking') {
      loopAnim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(ringScaleAnim, {
              toValue: 1.25,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(ringScaleAnim, {
              toValue: 1,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(ringOpacityAnim, {
              toValue: 0.1,
              duration: 900,
              useNativeDriver: true,
            }),
            Animated.timing(ringOpacityAnim, {
              toValue: 0.7,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      loopAnim.start();
    } else {
      ringScaleAnim.setValue(1);
      ringOpacityAnim.setValue(0.6);
    }

    return () => {
      if (loopAnim) loopAnim.stop();
    };
  }, [holdState, ringScaleAnim, ringOpacityAnim]);

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
      if (holdState === 'speaking' || holdState === 'requesting') {
        triggerHaptic('selection');
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
        }).start();
        onPressOut();
      } else {
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 4,
        }).start();
      }
    }
  };

  const handlePress = () => {
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

  const getButtonConfig = () => {
    if (disabled) {
      return {
        bg: '#111827',
        border: '#1f2937',
        title: 'ROOM OFFLINE',
        subtitle: 'Connect to room to broadcast',
        textColor: '#64748b',
        ringColor: 'transparent',
      };
    }

    switch (holdState) {
      case 'speaking':
        return {
          bg: '#065f46',
          border: '#34d399',
          title: `ON AIR (${formatTimer(talkSeconds)})`,
          subtitle: interactionMode === 'hold' ? 'Release button to mute' : 'Tap to end speech & mute',
          textColor: '#ffffff',
          ringColor: 'rgba(52, 211, 153, 0.45)',
        };
      case 'requesting':
        return {
          bg: '#92400e',
          border: '#f59e0b',
          title: 'REQUESTING...',
          subtitle: 'Acquiring microphone token',
          textColor: '#ffffff',
          ringColor: 'rgba(245, 158, 11, 0.35)',
        };
      case 'queued':
        return {
          bg: '#7c2d12',
          border: '#ea580c',
          title: `WAITING IN LINE (#${queuePosition})`,
          subtitle: currentSpeakerName
            ? `${currentSpeakerName} is speaking. You are next.`
            : 'Holding your spot in line',
          textColor: '#fef08a',
          ringColor: 'rgba(234, 88, 12, 0.35)',
        };
      case 'idle':
      default:
        return {
          bg: '#1d4ed8',
          border: '#60a5fa',
          title: interactionMode === 'hold' ? 'HOLD TO TALK' : 'TAP TO SPEAK',
          subtitle: interactionMode === 'hold' ? 'Press & hold to project voice' : 'Tap to lock microphone on',
          textColor: '#ffffff',
          ringColor: 'transparent',
        };
    }
  };

  const config = getButtonConfig();

  return (
    <View style={styles.container}>
      {/* Mode Switcher Toggle Pill */}
      <View style={styles.modeSwitcher}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            interactionMode === 'hold' && styles.modeButtonActive,
          ]}
          onPress={() => onModeChange('hold')}
          disabled={holdState === 'speaking'}
        >
          <Text
            style={[
              styles.modeButtonText,
              interactionMode === 'hold' && styles.modeButtonTextActive,
            ]}
          >
            Hold to Speak (PTT)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeButton,
            interactionMode === 'toggle' && styles.modeButtonActive,
          ]}
          onPress={() => onModeChange('toggle')}
          disabled={holdState === 'speaking'}
        >
          <Text
            style={[
              styles.modeButtonText,
              interactionMode === 'toggle' && styles.modeButtonTextActive,
            ]}
          >
            Tap to Lock (Hands-Free)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Outer Soundwave Ripple Ring */}
      <View style={styles.ringAnchor}>
        {holdState === 'speaking' && (
          <Animated.View
            style={[
              styles.soundwaveRing,
              {
                borderColor: config.ringColor,
                transform: [{ scale: ringScaleAnim }],
                opacity: ringOpacityAnim,
              },
            ]}
          />
        )}

        <Animated.View
          style={[
            styles.buttonWrapper,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Pressable
            disabled={disabled}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={({ pressed }) => [
              styles.pressableButton,
              {
                backgroundColor: config.bg,
                borderColor: config.border,
                opacity: pressed && !disabled ? 0.95 : 1.0,
              },
            ]}
          >
            <View style={styles.contentContainer}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      holdState === 'speaking'
                        ? '#6ee7b7'
                        : holdState === 'queued'
                        ? '#facc15'
                        : '#93c5fd',
                  },
                ]}
              />
              <Text style={[styles.titleText, { color: config.textColor }]}>
                {config.title}
              </Text>
              <Text style={styles.subtitleText}>{config.subtitle}</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Persistent Queue Exit Button if in line */}
      {holdState === 'queued' && (
        <TouchableOpacity style={styles.leaveQueueButton} onPress={onLeaveQueue}>
          <Text style={styles.leaveQueueText}>✕ Cancel / Leave Waiting Line</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 22,
    padding: 3,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
  },
  modeButtonActive: {
    backgroundColor: '#2563eb',
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  modeButtonText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  ringAnchor: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  soundwaveRing: {
    position: 'absolute',
    width: 256,
    height: 256,
    borderRadius: 128,
    borderWidth: 4,
  },
  buttonWrapper: {
    width: 228,
    height: 228,
    borderRadius: 114,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  pressableButton: {
    width: '100%',
    height: '100%',
    borderRadius: 114,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitleText: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  leaveQueueButton: {
    marginTop: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
  },
  leaveQueueText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
});
