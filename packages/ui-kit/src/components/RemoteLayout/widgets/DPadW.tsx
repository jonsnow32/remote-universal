import React, { useRef } from 'react';
import { View, Text, PanResponder, Animated } from 'react-native';
import type { DPadWidget } from '@remote/core';
import { Ionicons } from '@expo/vector-icons';
import type * as HapticsType from 'expo-haptics';

interface Props {
  widget: DPadWidget;
  onAction: (action: string) => void;
}

const SWIPE_THRESHOLD = 22; // minimum px to count as swipe vs tap
const CENTER_RATIO = 0.32;  // fraction of radius treated as center zone

function haptic(medium = false) {
  try {
    const H = require('expo-haptics') as typeof HapticsType;
    void H.impactAsync(medium ? H.ImpactFeedbackStyle.Medium : H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

const OUTER_BG  = '#131929';
const CENTER_BG = '#1E2535';
const ICON_COLOR = '#8892A4';
const ICON_ACTIVE = '#FFFFFF';

export function DPadW({ widget, onAction }: Props) {
  const containerRef = useRef<View>(null);
  // Page-space coordinates for tap-zone detection
  const layout = useRef({ cx: 0, cy: 0, r: 0 });

  // Per-direction opacity anims for press-flash feedback
  const anim = useRef({
    up:     new Animated.Value(1),
    down:   new Animated.Value(1),
    left:   new Animated.Value(1),
    right:  new Animated.Value(1),
    center: new Animated.Value(1),
  }).current;

  const flash = (dir: keyof typeof anim) => {
    Animated.sequence([
      Animated.timing(anim[dir], { toValue: 0.35, duration: 70, useNativeDriver: true }),
      Animated.timing(anim[dir], { toValue: 1,    duration: 130, useNativeDriver: true }),
    ]).start();
  };

  const fire = (action: string, dir: keyof typeof anim) => {
    haptic();
    flash(dir);
    onAction(action);
  };

  const measureLayout = () => {
    containerRef.current?.measureInWindow((x, y, w, h) => {
      const r = Math.min(w, h) / 2;
      layout.current = { cx: x + w / 2, cy: y + h / 2, r };
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,

      onPanResponderRelease: (_, gs) => {
        const { dx, dy } = gs;

        // ── Swipe ──────────────────────────────────────────────────────────
        if (Math.abs(dx) >= SWIPE_THRESHOLD || Math.abs(dy) >= SWIPE_THRESHOLD) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            dx > 0
              ? fire(widget.actions.right, 'right')
              : fire(widget.actions.left,  'left');
          } else {
            dy > 0
              ? fire(widget.actions.down, 'down')
              : fire(widget.actions.up,   'up');
          }
          return;
        }

        // ── Tap: determine zone by position ───────────────────────────────
        const { cx, cy, r } = layout.current;
        // gs.x0/y0 are page-space coords of the touch start
        const tapX = gs.x0 - cx;
        const tapY = gs.y0 - cy;
        const dist  = Math.sqrt(tapX * tapX + tapY * tapY);

        if (r === 0 || dist < r * CENTER_RATIO) {
          // Center zone → OK
          fire(widget.actions.center, 'center');
        } else {
          // Directional quadrant by angle
          const angle = Math.atan2(tapY, tapX) * 180 / Math.PI; // -180..180
          if (angle > -45 && angle <= 45)   fire(widget.actions.right, 'right');
          else if (angle > 45 && angle <= 135) fire(widget.actions.down,  'down');
          else if (angle > -135 && angle <= -45) fire(widget.actions.up, 'up');
          else fire(widget.actions.left, 'left');
        }
      },
    })
  ).current;

  return (
    <View
      ref={containerRef}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      onLayout={measureLayout}
      {...panResponder.panHandlers}
    >
      {/* Outer disc — fills the shorter dimension, stays circular */}
      <View
        style={{
          width: '88%',
          aspectRatio: 1,
          borderRadius: 9999,
          backgroundColor: OUTER_BG,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* ── Directional arrows ── */}
        <Animated.View style={{ position: 'absolute', top: '9%', opacity: anim.up }}>
          <Ionicons name="chevron-up" size={24} color={ICON_COLOR} />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: '9%', opacity: anim.left }}>
          <Ionicons name="chevron-back" size={24} color={ICON_COLOR} />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', right: '9%', opacity: anim.right }}>
          <Ionicons name="chevron-forward" size={24} color={ICON_COLOR} />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', bottom: '9%', opacity: anim.down }}>
          <Ionicons name="chevron-down" size={24} color={ICON_COLOR} />
        </Animated.View>

        {/* ── Center OK button ── */}
        <Animated.View
          style={{
            width: '36%',
            aspectRatio: 1,
            borderRadius: 9999,
            backgroundColor: CENTER_BG,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: anim.center,
          }}
        >
          <Text style={{ color: ICON_ACTIVE, fontWeight: '700', fontSize: 14, letterSpacing: 0.5 }}>
            OK
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
