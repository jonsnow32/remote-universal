import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { ConnectionProtocol } from '../types/navigation';
import { useTheme } from '@remote/ui-kit';

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
  /** Protocols reported by the device's catalog entry. When provided, each
   * option shows whether it is supported by the specific model. */
  deviceProtocols?: ConnectionProtocol[];
}

function resolveDescription(proto: ProtocolOption, deviceProtocols?: ConnectionProtocol[]): { text: string; supported: boolean | null } {
  if (!deviceProtocols || deviceProtocols.length === 0) {
    return { text: proto.description, supported: null };
  }
  if (deviceProtocols.includes(proto.id)) {
    return { text: 'Supported by this model ✓', supported: true };
  }
  return { text: 'Not listed for this model', supported: false };
}

export function ProtocolPicker({ selected, recommended = 'wifi', onSelect, deviceProtocols }: Props): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamilyBold }]}>Choose connection method</Text>
      {ALL_PROTOCOLS.map((proto) => {
        const isSelected = selected === proto.id;
        const isRecommended = proto.id === recommended;
        const { text: descText, supported } = resolveDescription(proto, deviceProtocols);
        const dimmed = supported === false;
        return (
          <TouchableOpacity
            key={proto.id}
            style={[
              styles.option,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              isSelected && { borderColor: proto.color },
              dimmed && styles.optionDimmed,
            ]}
            onPress={() => onSelect(proto.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: proto.color + (dimmed ? '11' : '22') }]}>
              <Ionicons name={proto.icon} size={20} color={dimmed ? '#3A4257' : proto.color} />
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: theme.typography.fontFamilyBold }, dimmed && styles.optionLabelDimmed]}>{proto.label}</Text>
                {isRecommended && (
                  <View style={styles.recommendBadge}>
                    <Text style={styles.recommendText}>Recommended</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.description, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }, supported === true && styles.descriptionSupported]}>
                {descText}
              </Text>
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
  optionLabelDimmed: {
    color: '#3A4257',
  },
  optionDimmed: {
    opacity: 0.55,
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
  descriptionSupported: {
    color: '#00C9A7',
  },
});
