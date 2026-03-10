import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  FlatList,
  StatusBar,
} from 'react-native';
import { DeviceDiscovery } from '@remote/core';
import type { DiscoveredDevice } from '@remote/core';

const discovery = new DeviceDiscovery();

const PROTOCOLS = [
  { id: 'mdns', label: 'mDNS', angle: -45 },
  { id: 'hub', label: 'Hub', angle: 90 },
  { id: 'ble', label: 'BLE', angle: 225 },
];

export function DiscoveryScreen(): React.ReactElement {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef<Animated.CompositeAnimation | null>(null);

  const startRingAnimation = () => {
    const makeRing = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    scanAnim.current = Animated.parallel([
      makeRing(ring1, 0),
      makeRing(ring2, 600),
      makeRing(ring3, 1200),
    ]);
    scanAnim.current.start();
  };

  const stopRingAnimation = () => {
    scanAnim.current?.stop();
    ring1.setValue(0);
    ring2.setValue(0);
    ring3.setValue(0);
  };

  const handleScan = async () => {
    if (scanning) {
      setScanning(false);
      stopRingAnimation();
      return;
    }
    setScanning(true);
    setDevices([]);
    startRingAnimation();
    try {
      const found = await discovery.discoverAll();
      setDevices(found);
    } catch {
      // silent
    } finally {
      setScanning(false);
      stopRingAnimation();
    }
  };

  const ringStyle = (anim: Animated.Value) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] }) }],
    opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.7, 0.3, 0] }),
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
      <Text style={styles.title}>{scanning ? 'Scanning...' : devices.length > 0 ? `Found ${devices.length} device${devices.length > 1 ? 's' : ''}` : 'Discover Devices'}</Text>

      {/* Radar */}
      <View style={styles.radar}>
        {/* Rings */}
        {[ring1, ring2, ring3].map((r, i) => (
          <Animated.View key={i} style={[styles.radarRing, ringStyle(r)]} />
        ))}
        {/* Protocol labels */}
        {PROTOCOLS.map(p => {
          const rad = (p.angle * Math.PI) / 180;
          const r = 78;
          return (
            <View
              key={p.id}
              style={[
                styles.protocolLabel,
                {
                  left: 80 + r * Math.cos(rad) - 20,
                  top: 80 + r * Math.sin(rad) - 14,
                },
              ]}
            >
              <Text style={styles.protocolText}>{p.label}</Text>
            </View>
          );
        })}
        {/* Center button */}
        <TouchableOpacity
          style={[styles.centerBtn, scanning && styles.centerBtnStop]}
          onPress={() => { void handleScan(); }}
          activeOpacity={0.8}
        >
          <Text style={styles.centerBtnText}>{scanning ? 'STOP' : 'SCAN'}</Text>
        </TouchableOpacity>
      </View>

      {scanning && (
        <Text style={styles.found}>Searching for devices...</Text>
      )}

      {/* Device list */}
      {devices.length > 0 && (
        <FlatList
          data={devices}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.deviceRow}>
              <View style={styles.deviceDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceName}>{item.name ?? item.id}</Text>
                <Text style={styles.deviceSource}>{item.source}</Text>
              </View>
              <View style={styles.deviceOnline} />
            </View>
          )}
          contentContainerStyle={styles.deviceList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 56,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 36,
  },
  radar: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  radarRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: '#00C9A7',
  },
  protocolLabel: {
    position: 'absolute',
    backgroundColor: '#141928',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  protocolText: {
    fontSize: 11,
    color: '#00C9A7',
    fontWeight: '600',
  },
  centerBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  centerBtnStop: {
    backgroundColor: '#FF4F4F',
    shadowColor: '#FF4F4F',
  },
  centerBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  found: {
    color: '#00C9A7',
    fontSize: 14,
    marginBottom: 20,
  },
  deviceList: {
    paddingHorizontal: 20,
    width: 360,
    paddingBottom: 100,
    gap: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  deviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00C9A7',
  },
  deviceName: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  deviceSource: {
    fontSize: 12,
    color: '#8892A4',
    marginTop: 2,
  },
  deviceOnline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00C896',
  },
});
