import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../types/navigation';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;

type DeviceCategory = 'TV' | 'AC';

interface Device {
  id: string;
  name: string;
  brand: string;
  category: DeviceCategory;
  location: string;
  isConnected: boolean;
  status: string;
}

const MOCK_DEVICES: Device[] = [
  { id: 'samsung-qled', name: 'Samsung QLED', location: 'Living Room', brand: 'Samsung', category: 'TV', isConnected: true, status: 'ON' },
  { id: 'daikin-emura', name: 'Daikin Emura', location: 'Bedroom', brand: 'Daikin', category: 'AC', isConnected: true, status: '24°C' },
  { id: 'lg-oled-c3', name: 'LG OLED C3', location: 'Study Room', brand: 'LG', category: 'TV', isConnected: false, status: 'OFF' },
];

const CATEGORY_COLORS: Record<DeviceCategory, string> = {
  TV: '#F5A623',
  AC: '#00C9A7',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning 🌅';
  if (h < 18) return 'Good Afternoon ☀️';
  return 'Good Evening 🌙';
}

function DeviceRow({ device, onPress }: { device: Device; onPress: () => void }) {
  const connected = device.isConnected;
  const catColor = CATEGORY_COLORS[device.category];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardBorder, { backgroundColor: catColor }]} />
      <View style={styles.cardIcon}>
        <Text style={{ fontSize: 24 }}>{device.category === 'TV' ? '📺' : '❄️'}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{device.name}</Text>
        <Text style={styles.cardLocation}>{device.location}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: connected ? (device.status === 'OFF' ? '#2A3147' : '#1A2C1A') : '#2A3147' }]}>
        <Text style={[styles.statusText, { color: connected && device.status !== 'OFF' ? catColor : '#8892A4' }]}>
          {device.status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function HomeScreen(): React.ReactElement {
  const navigation = useNavigation<HomeNav>();
  const activeCount = MOCK_DEVICES.filter(d => d.isConnected).length;

  const handleDevicePress = (device: Device) => {
    if (device.category === 'TV') {
      navigation.navigate('TVRemote', { deviceId: device.id, deviceName: device.name, location: device.location });
    } else {
      navigation.navigate('ACControl', { deviceId: device.id, deviceName: device.name, location: device.location });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.subGreeting}>{activeCount} devices active</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={{ fontSize: 22 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Device list */}
      <FlatList
        data={MOCK_DEVICES}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DeviceRow device={item} onPress={() => handleDevicePress(item)} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 56,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subGreeting: {
    fontSize: 13,
    color: '#8892A4',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141928',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 16,
    paddingRight: 16,
    gap: 14,
  },
  cardBorder: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1A2035',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cardLocation: {
    fontSize: 13,
    color: '#8892A4',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
});
