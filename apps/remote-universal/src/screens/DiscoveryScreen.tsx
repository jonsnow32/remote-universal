import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, DeviceCategory } from '../types/navigation';
import { useDiscovery } from '../hooks/useDiscovery';
import type { DiscoveredDeviceInfo } from '../hooks/useDiscovery';
import { RadarScanner } from '../components/RadarScanner';
import { DeviceCard } from '../components/DeviceCard';
import { AddDeviceSheet } from '../components/AddDeviceSheet';
import type { AddDeviceResult } from '../components/AddDeviceSheet';

export function DiscoveryScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { status, devices, startScan } = useDiscovery();
  const [showAddSheet, setShowAddSheet] = useState(false);

  const scanning = status === 'scanning';

  const handleDevicePress = useCallback((device: DiscoveredDeviceInfo) => {
    navigation.navigate('Remote', {
      deviceId: device.raw.id,
      deviceName: device.name,
      address: device.raw.address,
      deviceType: device.deviceType,
      protocol: device.protocol,
      brand: device.brand,
      layoutId: device.layoutId,
    });
  }, [navigation]);

  const handleManualAdd = useCallback((result: AddDeviceResult) => {
    navigation.navigate('Remote', {
      deviceId: `manual-${Date.now()}`,
      deviceName: `${result.brand} ${result.model}`,
      address: '',
      deviceType: result.category === 'ac' ? 'ac' : result.category === 'speaker' ? 'speaker' : result.category === 'light' ? 'light' : 'tv',
      protocol: result.protocol,
      brand: result.brand,
    });
  }, [navigation]);

  const renderDevice = useCallback(({ item }: { item: DiscoveredDeviceInfo }) => {
    const category: DeviceCategory =
      item.deviceType === 'ac' ? 'ac' :
      item.deviceType === 'speaker' || item.deviceType === 'soundbar' ? 'speaker' :
      item.deviceType === 'light' ? 'light' : 'tv';
    return (
      <DeviceCard
        name={item.name}
        location={item.location}
        protocol={item.protocol}
        category={category}
        onPress={() => handleDevicePress(item)}
      />
    );
  }, [handleDevicePress]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Devices</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={startScan}
            disabled={scanning}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.headerBtn}
          >
            <Ionicons name="refresh" size={20} color={scanning ? '#4A5568' : '#8892A4'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="settings-outline" size={22} color="#8892A4" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Radar Scanner */}
      <TouchableOpacity
        style={styles.radarWrap}
        onPress={scanning ? undefined : startScan}
        activeOpacity={scanning ? 1 : 0.7}
      >
        <RadarScanner scanning={scanning} deviceCount={devices.length} />
        <Text style={styles.scanStatus}>
          {scanning
            ? `Scanning...  ${devices.length} found`
            : devices.length > 0
            ? `${devices.length} device${devices.length !== 1 ? 's' : ''} found  ·  Tap to rescan`
            : 'Tap to scan'}
        </Text>
      </TouchableOpacity>

      {/* Device List */}
      <FlatList
        data={devices}
        keyExtractor={item => item.raw.id}
        renderItem={renderDevice}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !scanning ? (
            <Text style={styles.emptyText}>No devices detected yet. Make sure your devices are powered on and on the same network.</Text>
          ) : null
        }
      />

      {/* + Add Device Button */}
      <View style={[styles.addBtnWrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddSheet(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add Device</Text>
        </TouchableOpacity>
      </View>

      {/* Add Device Bottom Sheet */}
      <AddDeviceSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onSelect={handleManualAdd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerBtn: {
    padding: 2,
  },
  radarWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  scanStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00C9A7',
    marginTop: 8,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
    marginTop: 12,
  },
  addBtnWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#0A0E1A',
    borderTopWidth: 1,
    borderTopColor: '#1E2535',
  },
  addBtn: {
    backgroundColor: '#1E2535',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
