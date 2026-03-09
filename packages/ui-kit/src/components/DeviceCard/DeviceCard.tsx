import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface DeviceCardProps {
  id: string;
  name: string;
  brand: string;
  category: string;
  isConnected?: boolean;
  onPress: (id: string) => void;
}

/**
 * Card component displaying a discovered/registered device.
 */
export function DeviceCard({
  id,
  name,
  brand,
  category,
  isConnected = false,
  onPress,
}: DeviceCardProps): React.ReactElement {
  const theme = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.shape.borderRadius.lg,
    padding: theme.shape.spacing.md,
    borderWidth: 1,
    borderColor: isConnected ? theme.colors.primary : theme.colors.border,
  };

  return (
    <Pressable style={[styles.card, cardStyle]} onPress={() => onPress(id)} accessibilityRole="button">
      <View style={styles.header}>
        <Text style={[styles.brand, { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }]}>
          {brand.toUpperCase()}
        </Text>
        {isConnected && (
          <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
        )}
      </View>
      <Text style={[styles.name, { color: theme.colors.text, fontSize: theme.typography.fontSize.lg }]}>
        {name}
      </Text>
      <Text style={[styles.category, { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.xs }]}>
        {category}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 140,
    marginHorizontal: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  brand: {
    letterSpacing: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    fontWeight: '600',
    marginBottom: 2,
  },
  category: {
    textTransform: 'capitalize',
  },
});
