import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RemoteButton } from '../RemoteButton/RemoteButton';
import { useTheme } from '../../theme/ThemeProvider';

export interface DPadProps {
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  onOk: () => void;
}

/**
 * Directional pad (D-Pad) component with center OK button.
 */
export function DPad({ onUp, onDown, onLeft, onRight, onOk }: DPadProps): React.ReactElement {
  const theme = useTheme();

  return (
    <View style={[styles.container, { gap: theme.shape.spacing.xs }]}>
      <View style={styles.row}>
        <RemoteButton label="▲" onPress={onUp} size="md" variant="ghost" />
      </View>
      <View style={styles.row}>
        <RemoteButton label="◀" onPress={onLeft} size="md" variant="ghost" />
        <RemoteButton label="OK" onPress={onOk} size="lg" variant="primary" />
        <RemoteButton label="▶" onPress={onRight} size="md" variant="ghost" />
      </View>
      <View style={styles.row}>
        <RemoteButton label="▼" onPress={onDown} size="md" variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
