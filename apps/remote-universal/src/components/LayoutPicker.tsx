import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { LayoutVariant } from '../types/navigation';

interface LayoutOption {
  id: LayoutVariant;
  title: string;
  subtitle: string;
  accentColor: string;
  isDefault?: boolean;
}

const LAYOUTS: LayoutOption[] = [
  { id: 'universal', title: 'Universal', subtitle: 'All controls — recommended', accentColor: '#4FC3F7', isDefault: true },
  { id: 'simple', title: 'Simple', subtitle: 'Power, Vol, Ch, OK only', accentColor: '#00C9A7' },
  { id: 'brand', title: 'Samsung Full', subtitle: 'Brand-specific layout', accentColor: '#FFB347' },
  { id: 'custom', title: 'Custom', subtitle: 'Build your own', accentColor: '#6C63FF' },
];

interface Props {
  selected: LayoutVariant;
  brandName?: string;
  onSelect: (variant: LayoutVariant) => void;
}

export function LayoutPicker({ selected, brandName, onSelect }: Props): React.ReactElement {
  const options = LAYOUTS.map(l =>
    l.id === 'brand' && brandName
      ? { ...l, title: `${brandName} Full` }
      : l
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Layout</Text>
      {options.map((option) => {
        const isSelected = selected === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.option,
              isSelected && { borderColor: option.accentColor },
            ]}
            onPress={() => onSelect(option.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.accent, { backgroundColor: option.accentColor }]} />
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                {option.isDefault && (
                  <View style={[styles.defaultBadge, { backgroundColor: option.accentColor + '22' }]}>
                    <Text style={[styles.defaultText, { color: option.accentColor }]}>Default</Text>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle}>{option.subtitle}</Text>
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
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#8892A4',
    marginTop: 4,
  },
});
