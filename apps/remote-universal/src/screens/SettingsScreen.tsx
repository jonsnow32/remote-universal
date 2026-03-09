import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useTheme } from '@remote/ui-kit';
import { appConfig } from '../config';

export function SettingsScreen(): React.ReactElement {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>

      {Object.entries(appConfig.features).map(([key, value]) => (
        <View key={key} style={[styles.row, { borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text }}>{key}</Text>
          <Switch value={value} disabled trackColor={{ true: theme.colors.primary }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
});
