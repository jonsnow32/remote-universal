import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { RemoteButton } from '../RemoteButton/RemoteButton';
import { useTheme } from '../../theme/ThemeProvider';

export interface RemoteLayoutButton {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action: string;
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export interface RemoteLayoutSection {
  id: string;
  title?: string;
  buttons: RemoteLayoutButton[];
}

export interface RemoteLayoutProps {
  sections: RemoteLayoutSection[];
  onButtonPress: (action: string) => void;
}

/**
 * Renders a remote control layout from a list of sections and buttons.
 */
export function RemoteLayout({ sections, onButtonPress }: RemoteLayoutProps): React.ReactElement {
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {sections.map(section => (
        <View key={section.id} style={[styles.section, { marginBottom: theme.shape.spacing.lg }]}>
          {section.title && (
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.xs }]}>
              {section.title.toUpperCase()}
            </Text>
          )}
          <View style={styles.buttonGrid}>
            {section.buttons.map(btn => (
              <RemoteButton
                key={btn.id}
                label={btn.label}
                icon={btn.icon}
                onPress={() => onButtonPress(btn.action)}
                variant={btn.variant ?? 'ghost'}
                size={btn.size ?? 'md'}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  section: {
    width: '100%',
    alignItems: 'center',
  },
  sectionTitle: {
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
});
