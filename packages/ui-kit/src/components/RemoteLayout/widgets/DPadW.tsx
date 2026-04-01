import React, { useRef, useState } from 'react';
import { View, Text, PanResponder, Animated, LayoutChangeEvent, StyleSheet } from 'react-native';
import type { DPadWidget } from '@remote/core';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import type * as HapticsType from 'expo-haptics';

interface Props {
  widget: DPadWidget;
  onAction: (action: string) => void;
  /** Debug overlay: draws zone boundaries and last touch point. */
  debug?: boolean;
}

const SWIPE_THRESHOLD = 22; // minimum px to count as swipe vs tap
const CENTER_RATIO = 0.32;  // fraction of radius treated as center zone

type Zone = 'up' | 'down' | 'left' | 'right' | 'center';

const ZONE_COLORS: Record<Zone, string> = {
  up:     '#4FC3F7',
  down:   '#AED581',
  left:   '#FFB74D',
  right:  '#F48FB1',
  center: '#CE93D8',
};

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

export function DPadW({ widget, onAction, debug = false }: Props) {
  const containerRef = useRef<View>(null);
  const containerSize = useRef({ w: 0, h: 0 });
  // Page-absolute position of the container, updated via measureInWindow after layout
  const containerPage = useRef({ left: 0, top: 0 });
  // For debug overlay: re-render-capable size + last touch
  const [debugSize,  setDebugSize]  = useState({ w: 0, h: 0 });
  const [debugTouch, setDebugTouch] = useState<{ x: number; y: number; zone: Zone } | null>(null);

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

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    containerSize.current = { w: width, h: height };
    if (debug) setDebugSize({ w: width, h: height });
    // Measure page-absolute position so we can convert gs.moveX/Y → local coords
    containerRef.current?.measureInWindow((x, y) => {
      containerPage.current = { left: x, top: y };
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,

      onPanResponderRelease: (evt, gs) => {
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

        // ── Tap: use locationX/Y which is container-relative because
        //   the disc has pointerEvents="none" so touches go straight to
        //   the container View (no child interception offset).
        const { w, h } = containerSize.current;
        const r    = Math.min(w, h) / 2;
        const localX = evt.nativeEvent.locationX;
        const localY = evt.nativeEvent.locationY;
        const tapX = localX - w / 2;
        const tapY = localY - h / 2;
        const dist  = Math.sqrt(tapX * tapX + tapY * tapY);

        let zone: Zone;
        if (r === 0 || dist < r * CENTER_RATIO) {
          zone = 'center';
        } else {
          const angle = Math.atan2(tapY, tapX) * 180 / Math.PI; // -180..180
          if (angle > -45 && angle <= 45)        zone = 'right';
          else if (angle > 45 && angle <= 135)   zone = 'down';
          else if (angle > -135 && angle <= -45) zone = 'up';
          else                                   zone = 'left';
        }

        if (debug) setDebugTouch({ x: localX, y: localY, zone });

        if (zone === 'center') fire(widget.actions.center, 'center');
        else if (zone === 'right') fire(widget.actions.right, 'right');
        else if (zone === 'down')  fire(widget.actions.down,  'down');
        else if (zone === 'up')    fire(widget.actions.up,    'up');
        else                       fire(widget.actions.left,  'left');
      },
    })
  ).current;

  return (
    <View
      ref={containerRef}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {/* Outer disc — fills the shorter dimension, stays circular */}
      {/* pointerEvents="none" → touches pass through to the container so locationX/Y is accurate */}
      <View
        pointerEvents="none"
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

      {/* ── Debug overlay ──────────────────────────────────────────────── */}
      {debug && debugSize.w > 0 && (() => {
        const { w, h } = debugSize;
        const discSize   = Math.min(w, h) * 0.88;
        const discRadius = discSize / 2;
        const discLeft   = (w - discSize) / 2;
        const discTop    = (h - discSize) / 2;
        const cx = w / 2;
        const cy = h / 2;
        const centerR = discRadius * CENTER_RATIO; // px

        return (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Circular clip matching the disc */}
            <View style={[dbg.discClip, {
              width: discSize, height: discSize,
              borderRadius: discSize / 2,
              left: discLeft, top: discTop,
            }]}>
              {/* ±45° boundary lines */}
              <View style={[dbg.line, { transform: [{ rotate:  '45deg' }] }]} />
              <View style={[dbg.line, { transform: [{ rotate: '-45deg' }] }]} />
              {/* Cross-hair at centre */}
              <View style={[dbg.line, { transform: [{ rotate:  '0deg'  }], opacity: 0.2 }]} />
              <View style={[dbg.line, { transform: [{ rotate: '90deg'  }], opacity: 0.2 }]} />
            </View>

            {/* Center zone ring */}
            <View style={[dbg.centerRing, {
              width: centerR * 2, height: centerR * 2,
              borderRadius: centerR,
              left: cx - centerR, top: cy - centerR,
            }]} />

            {/* Zone labels */}
            <Text style={[dbg.label, { color: ZONE_COLORS.up,    left: cx - 10, top: discTop + discSize * 0.10 }]}>UP</Text>
            <Text style={[dbg.label, { color: ZONE_COLORS.down,  left: cx - 10, top: discTop + discSize * 0.78 }]}>DN</Text>
            <Text style={[dbg.label, { color: ZONE_COLORS.left,  left: discLeft + discSize * 0.05, top: cy - 8 }]}>L</Text>
            <Text style={[dbg.label, { color: ZONE_COLORS.right, left: discLeft + discSize * 0.83, top: cy - 8 }]}>R</Text>

            {/* Last touch dot */}
            {debugTouch && (
              <View style={[dbg.dot, {
                left: debugTouch.x - 7,
                top:  debugTouch.y - 7,
                backgroundColor: ZONE_COLORS[debugTouch.zone],
              }]} />
            )}

            {/* Zone name badge */}
            {debugTouch && (
              <View style={[dbg.badge, { backgroundColor: ZONE_COLORS[debugTouch.zone], left: cx - 24, top: discTop + discSize + 4 }]}>
                <Text style={dbg.badgeText}>{debugTouch.zone.toUpperCase()}</Text>
              </View>
            )}
          </View>
        );
      })()}
    </View>
  );
}

const dbg = StyleSheet.create({
  discClip: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    position: 'absolute',
    width: '141%',
    height: 1.5,
    backgroundColor: 'rgba(255,235,59,0.75)',
  },
  centerRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,235,59,0.9)',
    borderStyle: 'dashed',
  },
  label: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badge: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
  },
});
