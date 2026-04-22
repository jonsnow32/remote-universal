import React, { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import type { ButtonWidget } from '@remote/core';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useTheme } from '../../../theme/ThemeProvider';
import type * as HapticsType from 'expo-haptics';

interface Props {
  widget: ButtonWidget;
  onAction: (action: string) => void;
}

function haptic() {
  try {
    const H = require('expo-haptics') as typeof HapticsType;
    void H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

export function ButtonW({ widget, onAction }: Props) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const isFilled = widget.variant === 'primary' || widget.variant === 'danger';

  const bgColor =
    widget.variant === 'primary' ? theme.colors.primary
    : widget.variant === 'danger' ? theme.colors.error
    : 'transparent';

  const hasBorder = !widget.variant || widget.variant === 'ghost';

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        style={{
          flex: 1,
          borderRadius: 16,
          backgroundColor: bgColor,
          borderWidth: hasBorder ? 1 : 0,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 40, bounciness: 4 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start()
        }
        onPress={() => {
          haptic();
          onAction(widget.action);
        }}
      >
        {widget.icon ? (
          <>
            <Ionicons
              name={widget.icon as React.ComponentProps<typeof Ionicons>['name']}
              size={18}
              color={isFilled ? '#FFFFFF' : theme.colors.text}
            />
            <Text style={{ color: isFilled ? '#FFFFFF' : theme.colors.textSecondary, fontSize: 10, textAlign: 'center' }}>
              {widget.label}
            </Text>
          </>
        ) : (
          <Text
            style={{
              color: isFilled ? '#FFFFFF' : theme.colors.text,
              fontSize: 13,
              fontWeight: '600',
              textAlign: 'center',
              paddingHorizontal: 4,
            }}
            numberOfLines={2}
          >
            {widget.label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
