import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ConnectionProtocol } from '../types/navigation';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ProtocolOption {
  id: ConnectionProtocol;
  label: string;
  icon: IoniconName;
  description: string;
  color: string;
}

const ALL_PROTOCOLS: ProtocolOption[] = [
  { id: 'wifi', label: 'Wi-Fi', icon: 'wifi', description: 'Same network detected ✓', color: '#4FC3F7' },
  { id: 'ble', label: 'BLE', icon: 'bluetooth', description: 'Not in range', color: '#6C63FF' },
  { id: 'ir', label: 'IR', icon: 'radio-outline', description: 'IR hub connected ✓', color: '#FFB347' },
  { id: 'homekit', label: 'HomeKit', icon: 'home-outline', description: 'iOS only', color: '#FF6B9D' },
  { id: 'matter', label: 'Matter', icon: 'globe-outline', description: 'Both platforms', color: '#00C9A7' },
];

interface Props {
  selected: ConnectionProtocol;
  recommended?: ConnectionProtocol;
  onSelect: (protocol: ConnectionProtocol) => void;
}

export function ProtocolPicker({ selected, recommended = 'wifi', onSelect }: Props): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose connection method</Text>
      {ALL_PROTOCOLS.map((proto) => {
        const isSelected = selected === proto.id;
        const isRecommended = proto.id === recommended;
        return (
          <TouchableOpacity
            key={proto.id}
            style={[
              styles.option,
              isSelected && { borderColor: proto.color },
            ]}
            onPress={() => onSelect(proto.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: proto.color + '22' }]}>
              <Ionicons name={proto.icon} size={20} color={proto.color} />
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={styles.optionLabel}>{proto.label}</Text>
                {isRecommended && (
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendText}>Recommended</Text>
                  </View>
                )}
              </View>
              <Text style={styles.description}>{proto.description}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8892A4',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#1E2535',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recommendBadge: {
    backgroundColor: '#00C9A722',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00C9A7',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13,
    color: '#8892A4',
    marginTop: 2,
  },
});
