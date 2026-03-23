import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, DeviceCategory, ConnectionProtocol } from '../types/navigation';
import { useDiscovery } from '../hooks/useDiscovery';
import type { DiscoveredDeviceInfo } from '../hooks/useDiscovery';
import { useUSBIRDetector } from '../hooks/useUSBIRDetector';
import { RadarScanner } from '../components/RadarScanner';
import { DeviceCard } from '../components/DeviceCard';
import { AddDeviceSheet } from '../components/AddDeviceSheet';
import type { AddDeviceResult } from '../components/AddDeviceSheet';

export function DiscoveryScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { status, devices, startScan } = useDiscovery();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addSheetDefaultProtocol, setAddSheetDefaultProtocol] = useState<ConnectionProtocol | undefined>();
  const usb = useUSBIRDetector();

  // ── USB permission gate ──────────────────────────────────────────────────
  // When a USB IR blaster is detected but permission hasn't been granted yet,
  // show an in-app dialog so the user can retry granting access.
  const permAlertShownRef = useRef(false);
  useEffect(() => {
    if (usb.needsPermission) {
      if (!permAlertShownRef.current) {
        permAlertShownRef.current = true;
        Alert.alert(
          'IR Blaster Detected',
          `Allow Universal Remote to access "${usb.deviceName ?? 'USB IR Blaster'}"?`,
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Allow', onPress: () => void usb.requestPermission() },
          ],
        );
      }
    } else {
      // Reset so we can show again if device is unplugged and re-plugged
      permAlertShownRef.current = false;
    }
  }, [usb.needsPermission]);

  const openAddSheetForIR = useCallback(() => {
    setAddSheetDefaultProtocol('ir');
    setShowAddSheet(true);
  }, []);

  const openAddSheet = useCallback(() => {
    setAddSheetDefaultProtocol(undefined);
    setShowAddSheet(true);
  }, []);

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
      address: result.address ?? '',
      deviceType: result.category === 'ac' ? 'ac' : result.category === 'speaker' ? 'speaker' : result.category === 'light' ? 'light' : 'tv',
      protocol: result.protocol,
      brand: result.brandSlug ?? result.brand,
      model: result.model,
      codesetId: result.codesetId,
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
        ListHeaderComponent={
          (usb.isConnected || usb.needsPermission) ? (
            <TouchableOpacity
              style={[
                styles.usbBanner,
                usb.isConnected ? styles.usbBannerReady : styles.usbBannerPending,
              ]}
              onPress={usb.isConnected ? openAddSheetForIR : () => void usb.requestPermission()}
              activeOpacity={0.8}
            >
              <View style={styles.usbBannerIcon}>
                <Ionicons
                  name={usb.isConnected ? 'radio-outline' : 'warning-outline'}
                  size={22}
                  color={usb.isConnected ? '#00C9A7' : '#F6AD55'}
                />
              </View>
              <View style={styles.usbBannerText}>
                <Text style={styles.usbBannerTitle}>
                  {usb.isConnected
                    ? (usb.deviceName ?? 'USB IR Blaster')
                    : 'IR Blaster detected — needs access'}
                </Text>
                <Text style={styles.usbBannerSub}>
                  {usb.isConnected ? 'Tap to add an IR device' : 'Tap to grant permission'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#4A5568" />
            </TouchableOpacity>
          ) : null
        }
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
          onPress={openAddSheet}
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
        defaultProtocol={addSheetDefaultProtocol}
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
  usbBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  usbBannerReady: {
    backgroundColor: 'rgba(0, 201, 167, 0.08)',
    borderColor: 'rgba(0, 201, 167, 0.3)',
  },
  usbBannerPending: {
    backgroundColor: 'rgba(246, 173, 85, 0.08)',
    borderColor: 'rgba(246, 173, 85, 0.3)',
  },
  usbBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  usbBannerText: {
    flex: 1,
  },
  usbBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  usbBannerSub: {
    fontSize: 12,
    color: '#8892A4',
  },
});
