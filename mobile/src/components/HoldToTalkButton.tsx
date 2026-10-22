import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { FloorHoldState } from '../types/floor';

interface HoldToTalkButtonProps {
  holdState: FloorHoldState;
  disabled: boolean;
  queuePosition: number | null;
  currentSpeakerName: string | null;
  onPressIn: () => void;
  onPressOut: () => void;
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
  onPressIn,
  onPressOut,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Trigger haptic on press down
  const handlePressIn = () => {
    if (disabled) return;

    try {
      ReactNativeHapticFeedback.trigger('impactHeavy', hapticOptions);
    } catch {
      Vibration.vibrate(Platform.OS === 'android' ? 30 : 15);
    }

    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 20,
    }).start();

    onPressIn();
  };

  // Trigger haptic on release
  const handlePressOut = () => {
    if (disabled) return;

    try {
      ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    } catch {
      Vibration.vibrate(Platform.OS === 'android' ? 15 : 10);
    }

    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
    }).start();

    onPressOut();
  };

  // Compute visual appearance based on holdState
  const getButtonStyles = () => {
    if (disabled) {
      return {
        bg: '#1e293b',
        border: '#334155',
        title: 'ROOM OFFLINE',
        subtitle: 'Connect to room to speak',
        textColor: '#64748b',
      };
    }

    switch (holdState) {
      case 'speaking':
        return {
          bg: '#059669', // Emerald green
          border: '#34d399',
          title: 'ON AIR',
          subtitle: 'Release button to mute',
          textColor: '#ffffff',
        };
      case 'requesting':
        return {
          bg: '#b45309', // Amber
          border: '#f59e0b',
          title: 'REQUESTING FLOOR...',
          subtitle: 'Acquiring microphone token',
          textColor: '#ffffff',
        };
      case 'queued':
        return {
          bg: '#9a3412', // Orange/Brown
          border: '#ea580c',
          title: `QUEUED (#${queuePosition})`,
          subtitle: currentSpeakerName
            ? `${currentSpeakerName} is speaking. Hold to keep spot.`
            : 'Hold to maintain position in line',
          textColor: '#fef08a',
        };
      case 'idle':
      default:
        return {
          bg: '#2563eb', // Royal Blue
          border: '#60a5fa',
          title: 'HOLD TO TALK',
          subtitle: 'Press and hold to broadcast speech',
          textColor: '#ffffff',
        };
    }
  };

  const styleConfig = getButtonStyles();

  return (
    <View style={styles.container}>
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
          style={({ pressed }) => [
            styles.pressableButton,
            {
              backgroundColor: styleConfig.bg,
              borderColor: styleConfig.border,
              opacity: pressed && !disabled ? 0.95 : 1.0,
            },
          ]}
        >
          <View style={styles.contentContainer}>
            {/* Pulsing indicator dot */}
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
            <Text style={[styles.titleText, { color: styleConfig.textColor }]}>
              {styleConfig.title}
            </Text>
            <Text style={styles.subtitleText}>{styleConfig.subtitle}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  buttonWrapper: {
    width: 240,
    height: 240,
    borderRadius: 120,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  pressableButton: {
    width: '100%',
    height: '100%',
    borderRadius: 120,
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
    marginBottom: 10,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  subtitleText: {
    marginTop: 8,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 8,
  },
});
