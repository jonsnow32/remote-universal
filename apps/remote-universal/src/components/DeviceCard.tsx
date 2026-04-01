import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { ProtocolBadge } from './ProtocolBadge';
import type { ConnectionProtocol, DeviceCategory } from '../types/navigation';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORY_ICONS: Record<DeviceCategory, { icon: IoniconName; color: string }> = {
  tv:      { icon: 'tv-outline', color: '#F5A623' },
  ac:      { icon: 'snow-outline', color: '#00C9A7' },
  speaker: { icon: 'volume-high-outline', color: '#6C63FF' },
  light:   { icon: 'bulb-outline', color: '#FFEB3B' },
};

interface Props {
  name: string;
  location: string;
  protocol: ConnectionProtocol;
  category?: DeviceCategory;
  onPress: () => void;
}

export function DeviceCard({ name, location, protocol, category = 'tv', onPress }: Props): React.ReactElement {
  const meta = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.tv;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
        <Ionicons name={meta.icon} size={22} color={meta.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <Text style={styles.location}>{location}</Text>
      </View>
      <ProtocolBadge protocol={protocol} />
      <Ionicons name="chevron-forward" size={16} color="#3A4257" style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E2535',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  location: {
    fontSize: 12,
    color: '#8892A4',
  },
  chevron: {
    marginLeft: 6,
  },
});
