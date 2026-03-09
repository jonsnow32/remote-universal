import React, { useRef } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme/ThemeProvider';

export interface RemoteButtonProps {
  label: string;
  icon?: React.ReactNode;
  onPress: (event: GestureResponderEvent) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  testID?: string;
}

const SIZE_MAP = {
  sm: { width: 40, height: 40, fontSize: 11 },
  md: { width: 56, height: 56, fontSize: 13 },
  lg: { width: 72, height: 72, fontSize: 16 },
} as const;

/**
 * Themed remote control button with haptic feedback and press animation.
 */
export function RemoteButton({
  label,
  icon,
  onPress,
  size = 'md',
  variant = 'primary',
  disabled = false,
  testID,
}: RemoteButtonProps): React.ReactElement {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (): void => {
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = (): void => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const handlePress = (event: GestureResponderEvent): void => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(event);
  };

  const sizeStyle = SIZE_MAP[size];

  const containerStyle: ViewStyle = {
    width: sizeStyle.width,
    height: sizeStyle.height,
    borderRadius: theme.shape.borderRadius.full,
    backgroundColor:
      variant === 'primary' ? theme.colors.primary : 'transparent',
    borderWidth: variant === 'ghost' ? 1 : 0,
    borderColor: variant === 'ghost' ? theme.colors.border : undefined,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: disabled ? 0.4 : 1,
  };

  const labelStyle: TextStyle = {
    color: theme.colors.text,
    fontSize: sizeStyle.fontSize,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.base, containerStyle]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        testID={testID}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {icon ? icon : <Text style={labelStyle}>{label}</Text>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
