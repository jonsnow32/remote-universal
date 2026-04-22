import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { ProtocolBadge } from './ProtocolBadge';
import type { ConnectionProtocol, DeviceCategory } from '../types/navigation';
import { useTheme } from '@remote/ui-kit';

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

export const DeviceCard = memo(function DeviceCard({ name, location, protocol, category = 'tv', onPress }: Props): React.ReactElement {
  const theme = useTheme();
  const meta = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.tv;
  return (
    <Pressable style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={onPress}>
      <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
        <Ionicons name={meta.icon} size={22} color={meta.color} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.colors.text, fontFamily: theme.typography.fontFamilyBold }]} numberOfLines={2}>{name}</Text>
        <Text style={[styles.location, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>{location}</Text>
      </View>
      <ProtocolBadge protocol={protocol} />
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} style={styles.chevron} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 26,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2535',
    shadowColor: '#8C7A4B',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
