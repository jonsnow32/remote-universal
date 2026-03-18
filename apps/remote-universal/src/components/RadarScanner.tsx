import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface Props {
  scanning: boolean;
  deviceCount: number;
}

const RING_COUNT = 3;

export function RadarScanner({ scanning, deviceCount }: Props): React.ReactElement {
  const rings = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0))
  ).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (scanning) {
      const makeRing = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
      animRef.current = Animated.parallel(
        rings.map((r, i) => makeRing(r, i * 600))
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
      rings.forEach(r => r.setValue(0));
    }
    return () => { animRef.current?.stop(); };
  }, [scanning, rings]);

  const ringStyle = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.4] }) }],
    opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 0.2, 0] }),
  });

  // Device dots at fixed positions around the radar
  const DOT_POSITIONS = [
    { angle: -30, distance: 0.65, color: '#4FC3F7' },   // wifi blue
    { angle: 120, distance: 0.55, color: '#FFB347' },    // ir orange
    { angle: 210, distance: 0.7, color: '#4FC3F7' },     // wifi blue
    { angle: 60, distance: 0.45, color: '#6C63FF' },     // ble purple
    { angle: 160, distance: 0.6, color: '#00C9A7' },     // matter green
  ];

  return (
    <View style={styles.container}>
      {/* Pulse rings */}
      {rings.map((r, i) => (
        <Animated.View key={i} style={[styles.ring, ringStyle(r)]} />
      ))}

      {/* Static orbit guides */}
      <View style={[styles.orbitRing, { width: 120, height: 120, borderRadius: 60 }]} />
      <View style={[styles.orbitRing, { width: 180, height: 180, borderRadius: 90 }]} />

      {/* Center scanner icon */}
      <View style={styles.center}>
        <View style={[styles.centerDot, scanning && styles.centerDotActive]} />
      </View>

      {/* Device dots */}
      {DOT_POSITIONS.slice(0, Math.min(deviceCount, DOT_POSITIONS.length)).map((dot, i) => {
        const rad = (dot.angle * Math.PI) / 180;
        const r = 90 * dot.distance;
        return (
          <View
            key={i}
            style={[
              styles.deviceDot,
              {
                backgroundColor: dot.color,
                left: 100 + r * Math.cos(rad) - 6,
                top: 100 + r * Math.sin(rad) - 6,
                shadowColor: dot.color,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: '#4FC3F7',
  },
  orbitRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#1E2535',
    borderStyle: 'dashed',
  },
  center: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141928',
    borderWidth: 2,
    borderColor: '#2A3147',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3A4257',
  },
  centerDotActive: {
    backgroundColor: '#4FC3F7',
    shadowColor: '#4FC3F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  deviceDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
});
