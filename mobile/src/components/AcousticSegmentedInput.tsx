import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { acousticTheme } from '../theme/acousticTheme';

interface AcousticSegmentedInputProps {
  value: string;
  onChange: (val: string) => void;
  hasError?: boolean;
}

export const AcousticSegmentedInput: React.FC<AcousticSegmentedInputProps> = ({
  value,
  onChange,
  hasError = false,
}) => {
  const hiddenInputRef = useRef<TextInput>(null);

  // Pad or display up to 7 characters (e.g., "STG-709" or "STG709")
  const DISPLAY_CELL_COUNT = 7;
  const chars = value.toUpperCase().slice(0, DISPLAY_CELL_COUNT).split('');

  const handleCellPress = () => {
    hiddenInputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      {/* Hidden native input for seamless mobile keyboard input */}
      <TextInput
        ref={hiddenInputRef}
        value={value}
        onChangeText={onChange}
        maxLength={12}
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.hiddenInput}
        caretHidden
      />

      {/* 7-Cell Segmented Monospace Hardware Display */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleCellPress}
        style={styles.cellsRow}
      >
        {Array.from({ length: DISPLAY_CELL_COUNT }).map((_, index) => {
          const char = chars[index] || '';
          const isFocused = chars.length === index;
          const isHyphen = char === '-';

          return (
            <View
              key={index}
              style={[
                styles.cell,
                isHyphen && styles.hyphenCell,
                hasError && styles.cellError,
                isFocused && styles.cellFocused,
              ]}
            >
              <Text
                style={[
                  styles.cellText,
                  hasError && styles.cellTextError,
                  char ? styles.cellTextFilled : styles.cellTextEmpty,
                ]}
              >
                {char || '•'}
              </Text>
            </View>
          );
        })}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 4,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  cellsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 6,
  },
  cell: {
    flex: 1,
    height: 52,
    borderRadius: acousticTheme.borderRadius.md,
    backgroundColor: acousticTheme.colors.surfaceLowest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: acousticTheme.colors.surfaceHighest + '60',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 2,
  },
  hyphenCell: {
    flex: 0.6,
    backgroundColor: 'transparent',
    borderWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  cellFocused: {
    borderColor: acousticTheme.colors.primary,
    backgroundColor: acousticTheme.colors.surfaceHigh,
  },
  cellError: {
    borderColor: acousticTheme.colors.error,
    backgroundColor: acousticTheme.colors.errorContainer + '30',
  },
  cellText: {
    fontSize: 20,
    fontFamily: 'Courier',
    fontWeight: '800',
    textAlign: 'center',
  },
  cellTextFilled: {
    color: acousticTheme.colors.primary,
  },
  cellTextEmpty: {
    color: acousticTheme.colors.surfaceHighest,
    fontSize: 14,
  },
  cellTextError: {
    color: acousticTheme.colors.error,
  },
});
