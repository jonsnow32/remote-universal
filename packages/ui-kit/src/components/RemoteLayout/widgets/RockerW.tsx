import React, { useRef } from 'react';
import { View, Text, PanResponder, Animated } from 'react-native';
import type { RockerWidget } from '@remote/core';
import { Ionicons } from '@expo/vector-icons';
import type * as HapticsType from 'expo-haptics';

interface Props {
  widget: RockerWidget;
  onAction: (action: string) => void;
}

const SWIPE_THRESHOLD = 18;
const PILL_BG     = '#131929';
const DIVIDER_COLOR = '#1E2535';
const ICON_COLOR  = '#8892A4';

function haptic() {
  try {
    const H = require('expo-haptics') as typeof HapticsType;
    void H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

export function RockerW({ widget, onAction }: Props) {
  const containerRef = useRef<View>(null);
  const pageLayout = useRef({ top: 0, height: 0 });
  const upAnim   = useRef(new Animated.Value(1)).current;
  const downAnim = useRef(new Animated.Value(1)).current;
  const midAnim  = useRef(new Animated.Value(1)).current;

  const flash = (anim: Animated.Value) =>
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.35, duration: 70,  useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1,    duration: 130, useNativeDriver: true }),
    ]).start();

  const measure = () => {
    containerRef.current?.measureInWindow((_, y, __, h) => {
      pageLayout.current = { top: y, height: h };
    });
  };

  const hasMid = !!widget.midAction;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,

      onPanResponderRelease: (_, gs) => {
        const { dy } = gs;

        // ── Swipe ──────────────────────────────────────────────────────────
        if (Math.abs(dy) >= SWIPE_THRESHOLD) {
          haptic();
          if (dy < 0) { flash(upAnim);   onAction(widget.upAction); }
          else         { flash(downAnim); onAction(widget.downAction); }
          return;
        }

        // ── Tap: top / mid / bottom zone ───────────────────────────────────
        const { top, height } = pageLayout.current;
        const relY = gs.y0 - top;
        haptic();

        if (hasMid) {
          const third = height / 3;
          if      (relY < third)         { flash(upAnim);   onAction(widget.upAction); }
          else if (relY < 2 * third)     { flash(midAnim);  onAction(widget.midAction!); }
          else                           { flash(downAnim); onAction(widget.downAction); }
        } else {
          if (relY < height / 2) { flash(upAnim);   onAction(widget.upAction); }
          else                   { flash(downAnim); onAction(widget.downAction); }
        }
      },
    })
  ).current;

  const renderZoneContent = (
    iconName: string | undefined,
    label: string | undefined,
    fallbackIcon: 'chevron-up' | 'chevron-down',
  ) => (
    <>
      <Ionicons
        name={(iconName ?? fallbackIcon) as React.ComponentProps<typeof Ionicons>['name']}
        size={20}
        color={ICON_COLOR}
      />
      {label ? (
        <Text style={{ color: ICON_COLOR, fontSize: 10, marginTop: 3 }}>{label}</Text>
      ) : null}
    </>
  );

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
          borderRadius: 28,
          backgroundColor: PILL_BG,
          borderWidth: 1,
          borderColor: DIVIDER_COLOR,
          overflow: 'hidden',
        }}
      >
        {/* ─ Up zone ─ */}
        <Animated.View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: upAnim }}
        >
          {renderZoneContent(widget.upIcon, widget.upLabel, 'chevron-up')}
        </Animated.View>

        <View style={{ height: 1, backgroundColor: DIVIDER_COLOR }} />

        {/* ─ Optional mid zone ─ */}
        {hasMid && (
          <>
            <Animated.View
              style={{ flex: 0.7, alignItems: 'center', justifyContent: 'center', opacity: midAnim }}
            >
              {widget.midIcon ? (
                <Ionicons
                  name={widget.midIcon as React.ComponentProps<typeof Ionicons>['name']}
                  size={18}
                  color={ICON_COLOR}
                />
              ) : (
                <Text style={{ color: ICON_COLOR, fontSize: 11 }}>{widget.midLabel}</Text>
              )}
            </Animated.View>
            <View style={{ height: 1, backgroundColor: DIVIDER_COLOR }} />
          </>
        )}

        {/* ─ Down zone ─ */}
        <Animated.View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity: downAnim }}
        >
          {renderZoneContent(widget.downIcon, widget.downLabel, 'chevron-down')}
        </Animated.View>
      </View>
    </View>
  );
}
