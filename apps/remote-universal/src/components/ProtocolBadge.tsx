import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ConnectionProtocol } from '../types/navigation';

const PROTOCOL_COLORS: Record<ConnectionProtocol, string> = {
  wifi: '#4FC3F7',
  ble: '#6C63FF',
  ir: '#FFB347',
  homekit: '#FF6B9D',
  matter: '#00C9A7',
};

const PROTOCOL_LABELS: Record<ConnectionProtocol, string> = {
  wifi: 'Wi-Fi',
  ble: 'BLE',
  ir: 'IR',
  homekit: 'HomeKit',
  matter: 'Matter',
};

interface Props {
  protocol: ConnectionProtocol;
}

export function ProtocolBadge({ protocol }: Props): React.ReactElement {
  const color = PROTOCOL_COLORS[protocol];
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[styles.label, { color }]}>{PROTOCOL_LABELS[protocol]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
