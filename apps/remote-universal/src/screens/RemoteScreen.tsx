import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme, RemoteLayout } from '@remote/ui-kit';
import { CommandDispatcher, DeviceRegistry } from '@remote/core';
import { SamsungQLED } from '@remote/device-sdk';
import { create } from 'zustand';

interface DeviceStore {
  selectedDeviceId: string | null;
  setSelectedDevice: (id: string | null) => void;
}

const useDeviceStore = create<DeviceStore>(set => ({
  selectedDeviceId: 'samsung-qled-qn85b',
  setSelectedDevice: (id: string | null) => set({ selectedDeviceId: id }),
}));

const registry = new DeviceRegistry();
registry.register(SamsungQLED);
const dispatcher = new CommandDispatcher(registry);

export function RemoteScreen(): React.ReactElement {
  const theme = useTheme();
  const { selectedDeviceId } = useDeviceStore();

  const selectedDevice = selectedDeviceId ? registry.getDevice(selectedDeviceId) : undefined;

  const handleButtonPress = useCallback(
    (action: string) => {
      if (!selectedDeviceId) return;
      dispatcher.dispatch(selectedDeviceId, action).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        Alert.alert('Command Error', message);
      });
    },
    [selectedDeviceId]
  );

  if (!selectedDevice) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textSecondary }}>No device selected.</Text>
      </View>
    );
  }

  const sections = selectedDevice.layout
    ? [
        {
          id: 'controls',
          title: 'Controls',
          buttons: Object.keys(selectedDevice.commands).map(action => ({
            id: action,
            label: action.replace(/_/g, ' '),
            action,
          })),
        },
      ]
    : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {selectedDevice.brand.toUpperCase()} {selectedDevice.model}
      </Text>
      <RemoteLayout sections={sections} onButtonPress={handleButtonPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
});
