import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  FlatList,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DeviceDiscovery } from '@remote/core';
import type { DiscoveredDevice } from '@remote/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DevicesStackParamList } from '../types/navigation';

const discovery = new DeviceDiscovery();

/** Infer a brand-specific layout id from the discovered device's id/name.
 *  Returns undefined when no brand match → RemoteScreen will use universal fallback. */
function inferLayoutId(device: DiscoveredDevice): string | undefined {
  const id = device.id.toLowerCase();
  const name = (device.name ?? '').toLowerCase();
  if (id.includes('samsung') || id.includes('smarttv-rest') || name.includes('samsung')) return 'samsung-tv';
  if (id.includes('lg') || name.includes('lg oled') || name.includes('lg tv')) return 'lg-tv';
  if (id.includes('daikin') || name.includes('daikin')) return 'daikin-ac';
  // Android TV devices (NVIDIA Shield, Mi Box, etc.)
  if (id.includes('androidtvremote') || id.includes('ssdp-cast') || name.includes('shield') || name.includes('android tv') || name.includes('mi box') || name.includes('chromecast with google tv')) return 'universal-stb';
  return undefined;
}

const PROTOCOLS = [
  { id: 'mdns', label: 'mDNS', angle: -45 },
  { id: 'hub', label: 'Hub', angle: 90 },
  { id: 'ble', label: 'BLE', angle: 225 },
];

const SOURCE_COLOR: Record<string, string> = {
  mdns: '#00C9A7',
  ssdp: '#6C63FF',
  ble: '#FFB347',
  hub: '#FF6B9D',
};

function ts(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`;
}

interface LogEntry {
  text: string;
  color: string;
}

export function DiscoveryScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<DevicesStackParamList>>();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef<Animated.CompositeAnimation | null>(null);
  const consoleRef = useRef<ScrollView>(null);

  const addLog = useCallback((text: string, color = '#8892A4') => {
    setLogs(prev => [...prev, { text: `[${ts()}] ${text}`, color }]);
    setTimeout(() => consoleRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

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
      addLog('Scan aborted by user.', '#FF4F4F');
      return;
    }
    setScanning(true);
    setDevices([]);
    setLogs([]);
    startRingAnimation();

    addLog('Starting discovery on all channels...', '#FFFFFF');
    addLog('↳ mDNS  — googlecast · airplay · amzn-wplay · smarttv-rest · androidtvremote2', SOURCE_COLOR.mdns);
    addLog('↳ SSDP  — Samsung Tizen :8001 · Cast :8008 (Shield/Chromecast/MiBox)', SOURCE_COLOR.ssdp);
    addLog('↳ BLE   — scanning for nearby BLE devices', SOURCE_COLOR.ble);
    addLog('↳ Hub   — fetching from cloud registry', SOURCE_COLOR.hub);

    try {
      const found = await discovery.discoverStream(
        (device) => {
          const color = SOURCE_COLOR[device.source] ?? '#8892A4';
          const label = `[${device.source.toUpperCase().padEnd(4)}] ${device.name ?? device.id} @ ${device.address}`;
          addLog(label, color);
          setDevices(prev => [...prev, device]);
        },
        8000
      );
      addLog(
        found.length > 0
          ? `Scan complete — ${found.length} device(s) found.`
          : 'Scan complete — no devices found.',
        found.length > 0 ? '#00C9A7' : '#8892A4'
      );
    } catch {
      addLog('Scan error.', '#FF4F4F');
    } finally {
      setScanning(false);
      stopRingAnimation();
    }
  };

  const handleDevicePress = (device: DiscoveredDevice) => {
    navigation.navigate('DeviceRemote', {
      deviceId: device.id,
      deviceName: device.name ?? device.id,
      address: device.address,
      deviceType: device.type ?? 'tv',
      layoutId: inferLayoutId(device),
    });
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

      {devices.length > 0 && (
        <FlatList
          data={devices}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.deviceRow}
              onPress={() => handleDevicePress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.deviceDot, { backgroundColor: SOURCE_COLOR[item.source] ?? '#00C9A7' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceName}>{item.name ?? item.id}</Text>
                <Text style={styles.deviceSource}>{item.source} · {item.address}</Text>
              </View>
              <View style={styles.deviceChevron} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.deviceList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Console */}
      <View style={styles.console}>
        <View style={styles.consoleHeader}>
          <View style={styles.consoleDotRed} />
          <View style={styles.consoleDotYellow} />
          <View style={styles.consoleDotGreen} />
          <Text style={styles.consoleTitle}>discovery console</Text>
          {scanning && <Text style={styles.consolePulse}>●</Text>}
        </View>
        <ScrollView
          ref={consoleRef}
          style={styles.consoleBody}
          showsVerticalScrollIndicator={false}
        >
          {logs.length === 0 ? (
            <Text style={styles.consolePlaceholder}>Press SCAN to start discovery...</Text>
          ) : (
            logs.map((log, i) => (
              <Text key={i} style={[styles.consoleLine, { color: log.color }]}>
                {log.text}
              </Text>
            ))
          )}
        </ScrollView>
      </View>
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
  deviceChevron: {
    width: 7,
    height: 7,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#8892A4',
    transform: [{ rotate: '45deg' }],
    marginRight: 4,
  },
  // Console
  console: {
    width: 360,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#080C14',
    borderWidth: 1,
    borderColor: '#1E2535',
    overflow: 'hidden',
  },
  consoleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2535',
    backgroundColor: '#0D1220',
  },
  consoleDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5F57',
  },
  consoleDotYellow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFBD2E',
  },
  consoleDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#28C840',
  },
  consoleTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: '#4A5568',
    fontWeight: '500',
    letterSpacing: 0.5,
    marginLeft: -32,
  },
  consolePulse: {
    fontSize: 10,
    color: '#00C9A7',
  },
  consoleBody: {
    height: 160,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  consolePlaceholder: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#2A3147',
    lineHeight: 18,
  },
  consoleLine: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
