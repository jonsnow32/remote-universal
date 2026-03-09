import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useTheme } from '@remote/ui-kit';
import { DeviceDiscovery } from '@remote/core';
import type { DiscoveredDevice } from '@remote/core';

const discovery = new DeviceDiscovery();

export function DiscoveryScreen(): React.ReactElement {
  const theme = useTheme();
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [loading, setLoading] = useState(false);

  const handleScan = useCallback(async () => {
    setLoading(true);
    try {
      const found = await discovery.discoverAll();
      setDevices(found);
    } catch (err) {
      console.error('[DiscoveryScreen] Scan error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Device Discovery</Text>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={() => { void handleScan(); }}
        disabled={loading}
      >
        <Text style={{ color: theme.colors.text }}>
          {loading ? 'Scanning…' : 'Scan for Devices'}
        </Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator color={theme.colors.primary} style={styles.loader} />}

      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.deviceRow, { borderColor: theme.colors.border }]}>
            <Text style={{ color: theme.colors.text }}>{item.name ?? item.id}</Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{item.source}</Text>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 32 }}>
              No devices found. Tap Scan to start.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  button: { padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  loader: { marginVertical: 12 },
  deviceRow: { padding: 12, borderBottomWidth: 1, marginVertical: 2 },
});
