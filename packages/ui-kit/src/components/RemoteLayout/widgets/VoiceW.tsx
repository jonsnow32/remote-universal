import React, { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import type { VoiceWidget } from '@remote/core';
import { useTheme } from '../../../theme/ThemeProvider';
import type * as HapticsType from 'expo-haptics';

interface Props {
  widget: VoiceWidget;
  /** Called with the special action string "VOICE_COMMAND" when mic is tapped. */
  onAction: (action: string) => void;
}

function haptic() {
  try {
    const H = require('expo-haptics') as typeof HapticsType;
    void H.impactAsync(H.ImpactFeedbackStyle.Medium);
  } catch (_) {}
}

/**
 * Voice command button widget.
 *
 * Renders a round mic button with a breathing ring animation on press.
 * The host (RemoteScreen) intercepts the "VOICE_COMMAND" action and
 * opens the VoiceCommandModal.
 */
export function VoiceW({ widget, onAction }: Props): React.ReactElement {
  const theme = useTheme();
  const accentColor = widget.accentColor ?? '#E53E3E'; // mic is typically red

  const scale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.8)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 40, bounciness: 4 }),
      Animated.timing(ringOpacity, { toValue: 0.35, duration: 120, useNativeDriver: true }),
      Animated.spring(ringScale, { toValue: 1.25, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
      Animated.timing(ringOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.spring(ringScale, { toValue: 0.8, useNativeDriver: true, speed: 20, bounciness: 4 }),
    ]).start();
  };

  const handlePress = () => {
    haptic();
    onAction('VOICE_COMMAND');
  };

  return (
    <Animated.View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale }],
      }}
    >
      {/* Pulse ring */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: accentColor,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
      />

      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: accentColor,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.55,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <Ionicons name="mic" size={26} color="#FFFFFF" />
      </Pressable>

      <Text
        style={{
          marginTop: 6,
          fontSize: 10,
          fontWeight: '600',
          color: theme.colors.textSecondary,
          letterSpacing: 0.3,
        }}
      >
        {widget.label ?? 'Voice'}
      </Text>
    </Animated.View>
  );
}
