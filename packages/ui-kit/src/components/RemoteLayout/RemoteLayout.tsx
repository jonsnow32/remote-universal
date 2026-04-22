import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import type { LayoutSection } from '@remote/core';
import { SectionGrid } from './SectionGrid';
import type { TextInputWHandle } from './widgets/TextInputW';
import { useTheme } from '../../theme/ThemeProvider';

// ─── Deprecated aliases kept for backward compatibility ───────────────────────
/** @deprecated Use ButtonWidget from @remote/core */
export interface RemoteLayoutButton {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action: string;
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}
/** @deprecated Use LayoutSection from @remote/core */
export interface RemoteLayoutSection {
  id: string;
  title?: string;
  buttons: RemoteLayoutButton[];
}
// ─────────────────────────────────────────────────────────────────────────────

export interface RemoteLayoutProps {
  sections: LayoutSection[];
  onButtonPress: (action: string) => void;
  /** Called with the first text-input widget's handle so the host can programmatically open it. */
  onRegisterTextInput?: (handle: TextInputWHandle) => void;
}

export function RemoteLayout({ sections, onButtonPress, onRegisterTextInput }: RemoteLayoutProps): React.ReactElement {
  const theme = useTheme();
  return (
    <ScrollView
      contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 0 }}
      showsVerticalScrollIndicator={false}
    >
      {sections.map(section => (
        <View key={section.id} style={{ width: '100%', marginBottom: 16 }}>
          {section.title && (
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 10,
                letterSpacing: 1.4,
                fontWeight: '600',
                fontFamily: theme.typography.fontFamilyBold,
                paddingHorizontal: 16,
                marginBottom: 6,
              }}
            >
              {section.title.toUpperCase()}
            </Text>
          )}
          <SectionGrid section={section} onAction={onButtonPress} onRegisterTextInput={onRegisterTextInput} />
        </View>
      ))}
    </ScrollView>
  );
}

