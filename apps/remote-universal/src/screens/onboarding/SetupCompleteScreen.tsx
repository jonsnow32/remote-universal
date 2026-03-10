import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceDiscovery } from '@remote/core';
import type { DiscoveredDevice } from '@remote/core';
import type { SetupCompleteScreenProps } from '../../types/navigation';

/** Map device metadata to a display emoji. */
function getDeviceIcon(device: DiscoveredDevice): string {
  const name = (device.name ?? '').toLowerCase();
  if (name.includes('samsung') || name.includes('tizen')) return '📺';
  if (name.includes('lg') || name.includes('oled')) return '📺';
  if (name.includes('daikin') || name.includes('aircon') || name.includes(' ac')) return '❄️';
  if (name.includes('chromecast') || name.includes('google')) return '📡';
  if (name.includes('apple') || name.includes('airplay') || name.includes('airprint')) return '🍎';
  if (name.includes('amazon') || name.includes('fire tv')) return '🔥';
  if (name.includes('sony')) return '📺';
  if (device.source === 'ble') return '🔵';
  return '📡';
}

export function SetupCompleteScreen({ navigation }: SetupCompleteScreenProps) {
  const checkScale = useRef(new Animated.Value(0)).current;
  const listFade = useRef(new Animated.Value(0)).current;
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  const [foundDevices, setFoundDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(true);

  // Entry animation
  useEffect(() => {
    Animated.spring(checkScale, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [checkScale]);

  // Pulsing dots while scanning is active
  useEffect(() => {
    if (!scanning) return;
    const makePulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
    const a1 = makePulse(dot1Opacity, 0);
    const a2 = makePulse(dot2Opacity, 150);
    const a3 = makePulse(dot3Opacity, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [scanning, dot1Opacity, dot2Opacity, dot3Opacity]);

  // Live device discovery
  useEffect(() => {
    let cancelled = false;
    const disc = new DeviceDiscovery();

    void disc.discoverStream(
      (device) => {
        if (cancelled) return;
        setFoundDevices(prev => {
          if (prev.some(d => d.id === device.id)) return prev;
          // Fade in the list on first hit
          if (prev.length === 0) {
            Animated.timing(listFade, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }).start();
          }
          return [...prev, device];
        });
      },
      6000
    ).then(() => {
      if (!cancelled) setScanning(false);
    });

    return () => { cancelled = true; };
  }, [listFade]);

  const handleGoHome = () => {
    // Mark onboarding as done so SplashScreen auto-skips next time
    void AsyncStorage.setItem('hasOnboarded', 'true').then(() => {
      navigation.replace('MainTabs');
    });
  };

  const subtitle = scanning
    ? `UniRemote is scanning your\nnetwork for devices...`
    : foundDevices.length > 0
      ? `Found ${foundDevices.length} device${foundDevices.length > 1 ? 's' : ''} on your network`
      : `No devices found.\nYou can add them manually in Settings.`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.content}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
          <Text style={styles.checkIcon}>✓</Text>
        </Animated.View>

        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, styles.dotActive, { opacity: scanning ? dot1Opacity : 1 }]} />
          <Animated.View style={[styles.dot, styles.dotActive, { opacity: scanning ? dot2Opacity : 1 }]} />
          <Animated.View style={[styles.dot, styles.dotActive, { opacity: scanning ? dot3Opacity : 1 }]} />
        </View>

        {scanning && foundDevices.length === 0 && (
          <ActivityIndicator color="#00C896" style={styles.spinner} />
        )}

        <Animated.View style={[styles.deviceList, { opacity: listFade }]}>
          {foundDevices.map(d => (
            <View key={d.id} style={styles.deviceRow}>
              <Text style={styles.deviceCheck}>✓</Text>
              <Text style={styles.deviceIcon}>{getDeviceIcon(d)}</Text>
              <Text style={styles.deviceName} numberOfLines={1}>
                {d.name ?? d.address}
              </Text>
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceText}>{d.source.toUpperCase()}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, scanning && styles.btnSecondary]}
          onPress={handleGoHome}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>
            {scanning ? 'Skip Scanning' : 'Go to Home'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#00C896',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  checkIcon: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A3147',
  },
  dotActive: {
    backgroundColor: '#00C896',
  },
  spinner: {
    marginBottom: 24,
  },
  deviceList: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderWidth: 1,
    borderColor: '#00C896',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  deviceCheck: {
    color: '#00C896',
    fontSize: 16,
    fontWeight: '700',
  },
  deviceIcon: {
    fontSize: 20,
  },
  deviceName: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  sourceBadge: {
    backgroundColor: '#1A2035',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceText: {
    fontSize: 10,
    color: '#8892A4',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    paddingBottom: 48,
  },
  btn: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnSecondary: {
    backgroundColor: '#1A2035',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
