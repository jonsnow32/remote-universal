import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RemoteButton } from '../RemoteButton/RemoteButton';

export interface NumPadProps {
  onDigit: (digit: string) => void;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

/**
 * Numeric keypad for channel entry.
 */
export function NumPad({ onDigit }: NumPadProps): React.ReactElement {
  return (
    <View style={styles.container}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map(digit => (
            <RemoteButton
              key={digit}
              label={digit}
              onPress={() => onDigit(digit)}
              size="md"
              variant="ghost"
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
