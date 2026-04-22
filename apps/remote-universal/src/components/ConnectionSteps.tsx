import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ConnectionStep } from '../hooks/useConnection';
import { useTheme } from '@remote/ui-kit';

interface Props {
  steps: ConnectionStep[];
}

export function ConnectionSteps({ steps }: Props): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {steps.map((step) => (
        <View key={step.id} style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.iconWrap, stepIconStyle(step.status, theme)]}>
            {step.status === 'done' && (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            )}
            {step.status === 'running' && (
              <View style={styles.dots}>
                <View style={[styles.dot, styles.dotActive]} />
                <View style={[styles.dot, styles.dotActive]} />
                <View style={[styles.dot, styles.dotActive]} />
              </View>
            )}
            {step.status === 'error' && (
              <Ionicons name="close" size={14} color="#FFFFFF" />
            )}
          </View>
          <Text style={[styles.label, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }, step.status === 'pending' && [styles.labelPending, { color: theme.colors.textSecondary }]]}>
            {step.label}
          </Text>
          {step.status === 'error' && step.error && (
            <Text style={[styles.errorText, { color: theme.colors.error, fontFamily: theme.typography.fontFamily }]} numberOfLines={2}>{step.error}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function stepIconStyle(status: ConnectionStep['status'], theme: ReturnType<typeof useTheme>) {
  switch (status) {
    case 'done': return { backgroundColor: theme.colors.success };
    case 'running': return { backgroundColor: theme.colors.primary };
    case 'error': return { backgroundColor: theme.colors.error };
    default: return { backgroundColor: theme.colors.border };
  }
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: '#141928',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2535',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  labelPending: {
    color: '#4A5568',
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A4257',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 12,
    color: '#FF4F4F',
    width: '100%',
    paddingLeft: 42,
    marginTop: 4,
  },
});
