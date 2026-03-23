import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getLayoutsForDeviceType } from '@remote/device-sdk';
import type { DeviceType } from '@remote/core';

// Derive an accent color from the layout id prefix (brand or universal)
const BRAND_ACCENT: Record<string, string> = {
  samsung:   '#1428A0',
  lg:        '#C8142A',
  daikin:    '#0097CC',
  universal: '#4FC3F7',
};

function accentForId(id: string): string {
  const prefix = id.split('-')[0];
  return BRAND_ACCENT[prefix] ?? '#4FC3F7';
}

interface Props {
  deviceType: DeviceType;
  selected: string;
  onSelect: (layoutId: string) => void;
}

export function LayoutPicker({ deviceType, selected, onSelect }: Props): React.ReactElement {
  const layouts = getLayoutsForDeviceType(deviceType);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Layout</Text>
      {layouts.map((layout) => {
        const isSelected = selected === layout.id;
        const accent = accentForId(layout.id);
        const isUniversal = layout.id.startsWith('universal-');
        return (
          <TouchableOpacity
            key={layout.id}
            style={[styles.option, isSelected && { borderColor: accent }]}
            onPress={() => onSelect(layout.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.accent, { backgroundColor: accent }]} />
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={styles.optionTitle}>{layout.name}</Text>
                {isUniversal && (
                  <View style={[styles.badge, { backgroundColor: accent + '22' }]}>
                    <Text style={[styles.badgeText, { color: accent }]}>Universal</Text>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle}>
                {isUniversal ? 'Works with any compatible device' : 'Brand-specific controls'}
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
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  option: {
    flexDirection: 'row',
    backgroundColor: '#141928',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1E2535',
    overflow: 'hidden',
  },
  accent: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#8892A4',
    marginTop: 4,
  },
});

