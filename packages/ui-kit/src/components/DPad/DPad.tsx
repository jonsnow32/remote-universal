import React, { useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type * as HapticsType from 'expo-haptics';

export interface DPadProps {
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
  onOk: () => void;
  /** Diameter of the disc in dp. Defaults to 200. */
  size?: number;
  /** Show debug overlay: zone boundaries, divider lines, and last touch point. */
  debug?: boolean;
}

const CENTER_RATIO   = 0.32; // inner fraction of radius → OK zone
const SWIPE_MIN      = 18;   // minimum px movement to count as swipe
const OUTER_BG       = '#131929';
const CENTER_BG      = '#1E2535';
const ICON_COLOR     = '#8892A4';
const ICON_ACTIVE    = '#FFFFFF';

type Zone = 'up' | 'down' | 'left' | 'right' | 'center';

/** Per-zone accent colours used in the debug overlay. */
const ZONE_COLORS: Record<Zone, string> = {
  up:     '#4FC3F7', // cyan
  down:   '#AED581', // lime
  left:   '#FFB74D', // orange
  right:  '#F48FB1', // pink
  center: '#CE93D8', // purple
};

function haptic(medium = false) {
  try {
    const H = require('expo-haptics') as typeof HapticsType;
    void H.impactAsync(medium ? H.ImpactFeedbackStyle.Medium : H.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

/**
 * Classify a (relX, relY) point (relative to disc centre) into a D-Pad zone.
 * Uses pure polar-coordinate maths — zero overlap possible.
 */
function classifyZone(relX: number, relY: number, radius: number): Zone {
  const dist = Math.sqrt(relX * relX + relY * relY);
  if (dist < radius * CENTER_RATIO) return 'center';
  const angle = Math.atan2(relY, relX) * 180 / Math.PI; // -180..180
  if (angle > -45 && angle <= 45)        return 'right';
  if (angle > 45  && angle <= 135)       return 'down';
  if (angle > -135 && angle <= -45)      return 'up';
  return 'left';
}

/**
 * Directional pad (D-Pad) with centre OK button.
 *
 * Touch strategy: `pointerEvents="box-only"` on the wrapper so that ALL
 * touch events are delivered exclusively to this View — children are purely
 * visual. `onTouchStart/End` give us locationX/Y that are always relative
 * to the wrapper itself. We then do polar-coordinate math to decide zone.
 * No PanResponder, no measureInWindow, zero overlap.
 */
export function DPad({ onUp, onDown, onLeft, onRight, onOk, size = 200, debug = false }: DPadProps): React.ReactElement {
  const discSize = size * 0.88; // matches the 88% visual disc
  const radius   = discSize / 2;
  // gap between the wrapper edge and the disc edge
  const discPad  = (size - discSize) / 2;

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [debugTouch, setDebugTouch] = useState<{ x: number; y: number; zone: Zone } | null>(null);

  const anim = useRef({
    up:     new Animated.Value(1),
    down:   new Animated.Value(1),
    left:   new Animated.Value(1),
    right:  new Animated.Value(1),
    center: new Animated.Value(1),
  }).current;

  const flash = (zone: Zone) => {
    Animated.sequence([
      Animated.timing(anim[zone], { toValue: 0.3, duration: 70,  useNativeDriver: true }),
      Animated.timing(anim[zone], { toValue: 1,   duration: 130, useNativeDriver: true }),
    ]).start();
  };

  const fire = (zone: Zone) => {
    haptic(zone === 'center');
    flash(zone);
    const cb = { up: onUp, down: onDown, left: onLeft, right: onRight, center: onOk }[zone];
    cb();
  };

  const handleTouchStart = (evt: any) => {
    touchStart.current = {
      x: evt.nativeEvent.locationX,
      y: evt.nativeEvent.locationY,
    };
  };

  const handleTouchEnd = (evt: any) => {
    if (!touchStart.current) return;
    const ex = evt.nativeEvent.locationX;
    const ey = evt.nativeEvent.locationY;
    const dx = ex - touchStart.current.x;
    const dy = ey - touchStart.current.y;
    touchStart.current = null;

    // Centre of the wrapper in wrapper-local coords
    const cx = size / 2;
    const cy = size / 2;

    let zone: Zone;
    if (Math.abs(dx) >= SWIPE_MIN || Math.abs(dy) >= SWIPE_MIN) {
      // Swipe: direction by dominant axis, starting from touch-start point
      if (Math.abs(dx) >= Math.abs(dy)) {
        zone = dx > 0 ? 'right' : 'left';
      } else {
        zone = dy > 0 ? 'down' : 'up';
      }
    } else {
      // Tap: classify end-point relative to disc centre
      zone = classifyZone(ex - cx, ey - cy, radius);
    }

    if (debug) setDebugTouch({ x: ex, y: ey, zone });
    fire(zone);
  };

  return (
    // pointerEvents="box-only" → this View swallows ALL touches;
    // nothing leaks into children, so locationX/Y is always relative
    // to this exact View — perfectly accurate, no overlap.
    <View
      style={[styles.wrapper, { width: size, height: size }]}
      pointerEvents="box-only"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Visual disc — purely decorative, receives no touches */}
      <View style={[styles.disc, { width: discSize, height: discSize, borderRadius: discSize / 2 }]}>
        <Animated.View style={[styles.arrow, styles.arrowTop,    { opacity: anim.up    }]}>
          <Ionicons name="chevron-up"      size={24} color={ICON_COLOR} />
        </Animated.View>
        <Animated.View style={[styles.arrow, styles.arrowLeft,   { opacity: anim.left  }]}>
          <Ionicons name="chevron-back"    size={24} color={ICON_COLOR} />
        </Animated.View>
        <Animated.View style={[styles.arrow, styles.arrowRight,  { opacity: anim.right }]}>
          <Ionicons name="chevron-forward" size={24} color={ICON_COLOR} />
        </Animated.View>
        <Animated.View style={[styles.arrow, styles.arrowBottom, { opacity: anim.down  }]}>
          <Ionicons name="chevron-down"    size={24} color={ICON_COLOR} />
        </Animated.View>

        <Animated.View style={[
          styles.center,
          { width: discSize * CENTER_RATIO * 2, height: discSize * CENTER_RATIO * 2, borderRadius: discSize },
          { opacity: anim.center },
        ]}>
          <Text style={styles.okLabel}>OK</Text>
        </Animated.View>
      </View>

      {/* ── Debug overlay ─────────────────────────────────────────────── */}
      {debug && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/*
           * Disc-clipped container: the divider lines are drawn at full
           * disc width/height but clipped to the circular disc boundary.
           */}
          <View style={[
            styles.debugDiscClip,
            {
              width:        discSize,
              height:       discSize,
              borderRadius: discSize / 2,
              left:         discPad,
              top:          discPad,
            },
          ]}>
            {/* Zone-boundary lines at ±45°. The diagonal split points are
                at 45° increments. Up/Right boundary = 45° CCW from right axis,
                i.e. a line rotated 45°. Down/Left boundary = same line. */}
            <View style={[styles.debugLine, { transform: [{ rotate:  '45deg' }] }]} />
            <View style={[styles.debugLine, { transform: [{ rotate: '-45deg' }] }]} />
            {/* Vertical + horizontal cross — helps spot the exact centre */}
            <View style={[styles.debugLine, { transform: [{ rotate:  '0deg'  }], opacity: 0.25 }]} />
            <View style={[styles.debugLine, { transform: [{ rotate: '90deg'  }], opacity: 0.25 }]} />
          </View>

          {/* Centre-zone boundary ring */}
          <View style={[
            styles.debugCenterRing,
            {
              width:        discSize * CENTER_RATIO * 2,
              height:       discSize * CENTER_RATIO * 2,
              borderRadius: discSize,
              left:         size / 2 - discSize * CENTER_RATIO,
              top:          size / 2 - discSize * CENTER_RATIO,
            },
          ]} />

          {/* Zone labels — positioned in each directional arm */}
          <Text style={[styles.debugZoneLabel, { color: ZONE_COLORS.up,
            left: size / 2 - 10, top: discPad + discSize * 0.10 }]}>UP</Text>
          <Text style={[styles.debugZoneLabel, { color: ZONE_COLORS.down,
            left: size / 2 - 10, top: discPad + discSize * 0.78 }]}>DN</Text>
          <Text style={[styles.debugZoneLabel, { color: ZONE_COLORS.left,
            left: discPad + discSize * 0.06, top: size / 2 - 8 }]}>L</Text>
          <Text style={[styles.debugZoneLabel, { color: ZONE_COLORS.right,
            left: discPad + discSize * 0.82, top: size / 2 - 8 }]}>R</Text>

          {/* Last touch dot */}
          {debugTouch && (
            <View style={[
              styles.debugDot,
              {
                left:            debugTouch.x - 7,
                top:             debugTouch.y - 7,
                backgroundColor: ZONE_COLORS[debugTouch.zone],
              },
            ]} />
          )}

          {/* Last zone name badge at bottom of wrapper */}
          {debugTouch && (
            <View style={[styles.debugBadge, { backgroundColor: ZONE_COLORS[debugTouch.zone] }]}>
              <Text style={styles.debugBadgeText}>{debugTouch.zone.toUpperCase()}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    backgroundColor: OUTER_BG,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  arrow: {
    position: 'absolute',
  },
  arrowTop:    { top: '9%' },
  arrowBottom: { bottom: '9%' },
  arrowLeft:   { left: '9%' },
  arrowRight:  { right: '9%' },
  center: {
    backgroundColor: CENTER_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okLabel: {
    color: ICON_ACTIVE,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  // ── Debug overlay styles ──────────────────────────────────────────────────
  /** Circular clip container that constrains the divider lines to the disc. */
  debugDiscClip: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Thin yellow divider line, full disc width, centred. */
  debugLine: {
    position: 'absolute',
    width: '141%', // sqrt(2) × disc so it always crosses edge-to-edge after rotation
    height: 1.5,
    backgroundColor: 'rgba(255, 235, 59, 0.7)',
  },
  /** Dashed ring that marks the centre-zone boundary. */
  debugCenterRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 235, 59, 0.9)',
    borderStyle: 'dashed',
  },
  /** Small zone label inside each arm. */
  debugZoneLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  /** Coloured dot marking the last touch end-point. */
  debugDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
    opacity: 0.95,
  },
  /** Zone-name badge shown below the disc. */
  debugBadge: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  debugBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
  },
});
