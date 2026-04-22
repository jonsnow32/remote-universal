import React, { useRef, useState } from 'react';
import { View, Text, PanResponder, Animated } from 'react-native';
import type { TouchpadWidget } from '@remote/core';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import type * as HapticsType from 'expo-haptics';
import { useTheme } from '../../../theme/ThemeProvider';

interface Props {
  widget: TouchpadWidget;
  onAction: (action: string) => void;
}

const TAP_THRESHOLD = 28;

function haptic() {
  try {
    const H = require('expo-haptics') as typeof HapticsType;
    void H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

export function TouchpadW({ widget, onAction }: Props) {
  const theme = useTheme();
  const rippleAnim  = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const [ripplePos, setRipplePos] = useState({ x: 0, y: 0 });

  const triggerRipple = (x: number, y: number) => {
    setRipplePos({ x, y });
    rippleAnim.setValue(0);
    rippleOpacity.setValue(0.35);
    Animated.parallel([
      Animated.timing(rippleAnim,    { toValue: 1,  duration: 350, useNativeDriver: true }),
      Animated.timing(rippleOpacity, { toValue: 0,  duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const containerRef = useRef<View>(null);
  const pageLayout = useRef({ left: 0, top: 0, width: 0, height: 0 });

  const measure = () => {
    containerRef.current?.measureInWindow((x, y, w, h) => {
      pageLayout.current = { left: x, top: y, width: w, height: h };
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, gs) =>
        Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6,

      onPanResponderRelease: (_, gs) => {
        const { dx, dy, x0, y0 } = gs;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        const { left, top } = pageLayout.current;
        const relX = x0 - left;
        const relY = y0 - top;
        triggerRipple(relX, relY);
        haptic();

        if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD) {
          onAction(widget.actions.tap);
          return;
        }

        if (absX >= absY) {
          onAction(dx > 0 ? widget.actions.right : widget.actions.left);
        } else {
          onAction(dy > 0 ? widget.actions.down : widget.actions.up);
        }
      },
    })
  ).current;

  const rippleSize = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 200],
  });

  return (
    <View
      ref={containerRef}
      style={{ flex: 1 }}
      onLayout={measure}
      {...panResponder.panHandlers}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 16,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* hint label */}
        {widget.hint ? (
          <Text style={{ color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 0.5 }}>
            {widget.hint}
          </Text>
        ) : (
          <Ionicons name="hand-left-outline" size={24} color={theme.colors.textSecondary} />
        )}

        {/* ripple */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: ripplePos.x,
            top:  ripplePos.y,
            width: rippleSize,
            height: rippleSize,
            marginLeft: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [-5, -100] }),
            marginTop:  rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [-5, -100] }),
            borderRadius: 100,
            backgroundColor: theme.colors.primary,
            opacity: rippleOpacity,
          }}
        />
      </View>
    </View>
  );
}
