import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert, Modal, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RemoteLayout } from '@remote/ui-kit';
import { findLayout, SamsungTizen, SAMSUNG_UNAUTHORIZED, AndroidTV, ANDROID_TV_NOT_PAIRED } from '@remote/device-sdk';
import { IRModule, BLEModule, HomeKitModule, MatterModule } from '@remote/native-modules';
import type { DeviceType, LayoutSection, LayoutButton } from '@remote/core';
import type { RemoteScreenProps, LayoutVariant } from '../types/navigation';
import type { RemoteLayoutSection } from '@remote/ui-kit';
import { appConfig } from '../config';
import { getApiBaseUrl } from '../lib/apiUrl';
import { AndroidTVPairingModal } from '../components/AndroidTVPairingModal';
import { LayoutPicker } from '../components/LayoutPicker';
import { useConnection } from '../hooks/useConnection';
import type { ConnectParams } from '../hooks/useConnection';
import { ProtocolBadge } from '../components/ProtocolBadge';

// ─── Layout helpers ──────────────────────────────────────────────────────────

const DEVICE_TYPE_TO_LAYOUT: Record<DeviceType, string> = {
  tv:        'universal-tv',
  ac:        'universal-ac',
  speaker:   'universal-speaker',
  soundbar:  'universal-soundbar',
  projector: 'universal-projector',
  fan:       'universal-fan',
  light:     'universal-light',
  stb:       'universal-stb',
};

function toRemoteLayoutSections(layoutId: string | undefined, fallbackId: string): RemoteLayoutSection[] {
  const layout = findLayout(layoutId, fallbackId);
  if (!layout) return [];
  return layout.sections.map((section: LayoutSection) => ({
    id: section.id,
    title: section.title,
    buttons: section.buttons.map((btn: LayoutButton) => ({
      id: btn.id,
      label: btn.label,
      icon: btn.icon
        ? <Ionicons name={btn.icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color="#FFFFFF" />
        : undefined,
      action: btn.action,
      variant: btn.variant === 'danger' ? 'ghost' : btn.variant,
      size: btn.size,
    })),
  }));
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Toast { message: string; ok: boolean }
type ConnStatus = 'connecting' | 'connected' | 'error';

// ─── Component ───────────────────────────────────────────────────────────────

export function RemoteScreen({ route }: RemoteScreenProps): React.ReactElement {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { deviceName, deviceType, address, protocol, brand, layoutId } = route.params;

  // Connection runs in background — remote is shown immediately
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting');

  // Layout
  const [selectedLayout, setSelectedLayout] = useState<LayoutVariant>('universal');
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);

  // Persist layout preference per device
  const layoutStorageKey = `layout_pref_${route.params.deviceId ?? address}`;
  useEffect(() => {
    void AsyncStorage.getItem(layoutStorageKey).then(saved => {
      if (saved === 'universal' || saved === 'brand' || saved === 'simple' || saved === 'custom') {
        setSelectedLayout(saved);
      }
    });
  }, [layoutStorageKey]);

  const handleLayoutSelect = useCallback((variant: LayoutVariant) => {
    setSelectedLayout(variant);
    setShowLayoutPicker(false);
    void AsyncStorage.setItem(layoutStorageKey, variant);
  }, [layoutStorageKey]);

  // Connection hook
  const connection = useConnection();

  // Toast
  const [toast, setToast] = useState<Toast | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // API URL
  const [apiBaseUrl, setApiBaseUrlState] = useState(appConfig.apiBaseUrl);

  // Android TV / Samsung pairing state
  const isAndroidTV = layoutId === 'universal-stb';
  const isSamsungTV = layoutId === 'samsung-tv';
  const [showPairingModal, setShowPairingModal] = useState(false);
  const pendingActionRef = useRef<string | null>(null);

  // Connection error modal
  const [showConnErrorModal, setShowConnErrorModal] = useState(false);

  useEffect(() => {
    void getApiBaseUrl().then(url => setApiBaseUrlState(url));
  }, []);

  // ─── Connect in background ────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    setShowConnErrorModal(false);
    setConnStatus('connecting');
    void connection.connect({ protocol, address, brand, layoutId }).then((success) => {
      setConnStatus(success ? 'connected' : 'error');
      if (!success) setShowConnErrorModal(true);
    });
  }, [connection, protocol, address, brand, layoutId]);

  useEffect(() => {
    void connection.connect({ protocol, address, brand, layoutId } as ConnectParams).then((success) => {
      setConnStatus(success ? 'connected' : 'error');
      if (!success) setShowConnErrorModal(true);
    });
    return () => { connection.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Post-connect TV setup (WebSocket / pairing check) ───────────────────

  useEffect(() => {
    if (connStatus !== 'connected') return;
    if (isAndroidTV) {
      void AndroidTV.isPaired(address).then(paired => {
        if (!paired) setShowPairingModal(true);
        else void AndroidTV.connectRemote(address).catch(() => {});
      });
      return () => { void AndroidTV.disconnectRemote(address).catch(() => {}); };
    }
    if (isSamsungTV) {
      let cancelled = false;
      void SamsungTizen.connect(address).catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === SAMSUNG_UNAUTHORIZED) {
          Alert.alert('Samsung TV pairing', 'Please check your TV screen for an "Allow" popup and accept it.');
        }
      });
      return () => { cancelled = true; SamsungTizen.disconnect(address); };
    }
  }, [connStatus, isAndroidTV, isSamsungTV, address]);

  // ─── Layout sections ──────────────────────────────────────────────────────

  const universalFallback = DEVICE_TYPE_TO_LAYOUT[deviceType] ?? 'universal-tv';
  const effectiveLayoutId = selectedLayout === 'brand' ? layoutId : selectedLayout === 'simple' ? undefined : layoutId;
  const sections = toRemoteLayoutSections(effectiveLayoutId, universalFallback);

  // ─── Toast ────────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, ok });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  // ─── Button handler ───────────────────────────────────────────────────────

  const handleButtonPress = useCallback(async (action: string) => {
    showToast(`⏳ ${action}`, true);
    try {
      if (isSamsungTV) {
        await SamsungTizen.sendAction(address, action);
      } else if (isAndroidTV) {
        try {
          await AndroidTV.sendAction(address, action);
        } catch (err) {
          const code = (err as Error & { code?: string }).code;
          if (code === ANDROID_TV_NOT_PAIRED) {
            pendingActionRef.current = action;
            setShowPairingModal(true);
            return;
          }
          throw err;
        }
      } else if (protocol === 'ir') {
        await IRModule.transmit(address, action);
      } else if (protocol === 'ble') {
        await BLEModule.write(address, action);
      } else if (protocol === 'homekit') {
        await HomeKitModule.sendCharacteristic(address, action);
      } else if (protocol === 'matter') {
        await MatterModule.invoke(address, action);
      } else if (protocol === 'wifi') {
        let sent = false;
        const errors: string[] = [];

        if (address) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 4000);
            const directRes = await fetch(`http://${address}/remotecommand`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action }),
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            sent = directRes.ok;
            if (!sent) errors.push(`Device returned ${directRes.status}`);
          } catch {
            errors.push('Device unreachable');
          }
        }

        if (!sent && apiBaseUrl && !/localhost|127\.0\.0\.\d/i.test(apiBaseUrl)) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 4000);
            const res = await fetch(`${apiBaseUrl}/api/commands`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ deviceId: address, action }),
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (!res.ok) errors.push(`Backend HTTP ${res.status}`);
            else sent = true;
          } catch {
            errors.push('Backend relay unreachable');
          }
        }

        if (!sent) {
          throw new Error(
            `Command not delivered — ${errors.join('; ') || 'no command channel configured'}`,
          );
        }
      } else {
        throw new Error('No command channel available for this protocol');
      }
      showToast(`✓ ${action}`, true);
    } catch (err) {
      console.log('Error sending command:', err);
      showToast(err instanceof Error ? err.message : String(err), false);
    }
  }, [address, protocol, isSamsungTV, isAndroidTV, apiBaseUrl, showToast]);

  const handlePaired = useCallback(() => {
    setShowPairingModal(false);
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pendingAction) void handleButtonPress(pendingAction);
  }, [handleButtonPress]);

  // ─── Connection error message (from failed step) ────────────────────────

  const connErrorMessage = (() => {
    const failedStep = [...connection.steps].reverse().find(s => s.status === 'error');
    return failedStep?.error ?? 'Could not reach the device. Check that it is powered on and connected to the same network.';
  })();

  // ─── Header status indicator ──────────────────────────────────────────────

  const renderStatus = () => {
    if (connStatus === 'connecting') {
      return (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#8892A4" style={{ marginRight: 6 }} />
          <Text style={styles.statusText}>Connecting...</Text>
        </View>
      );
    }
    if (connStatus === 'error') {
      return (
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: '#FF4F4F' }]} />
          <Text style={[styles.statusText, { color: '#FF4F4F' }]}>Failed</Text>
          <TouchableOpacity onPress={() => setShowConnErrorModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.retryLink}>· Details</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: '#00C9A7' }]} />
        <ProtocolBadge protocol={protocol} />
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {brand ? `${brand} ${deviceType.toUpperCase()}` : deviceName}
          </Text>
          {renderStatus()}
        </View>
        <TouchableOpacity
          onPress={() => setShowLayoutPicker(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="grid-outline" size={20} color="#8892A4" />
        </TouchableOpacity>
      </View>

      {/* Remote control */}
      <RemoteLayout sections={sections} onButtonPress={handleButtonPress} />

      {/* Toast */}
      {toast && (
        <Animated.View style={[styles.toast, toast.ok ? styles.toastOk : styles.toastErr, { opacity: toastAnim }]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

      {/* Layout picker bottom sheet */}
      <Modal
        visible={showLayoutPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLayoutPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowLayoutPicker(false)}
        >
          <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.pickerHandle} />
            <LayoutPicker
              selected={selectedLayout}
              brandName={brand}
              onSelect={handleLayoutSelect}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Connection error modal */}
      <Modal
        visible={showConnErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConnErrorModal(false)}
      >
        <View style={styles.errorModalOverlay}>
          <View style={[styles.errorModalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.errorModalIcon}>
              <Ionicons name="wifi-outline" size={32} color="#FF4F4F" />
            </View>
            <Text style={styles.errorModalTitle}>Connection Failed</Text>
            <Text style={styles.errorModalDevice} numberOfLines={1}>
              {brand ? `${brand} ${deviceType.toUpperCase()}` : deviceName}
            </Text>
            <Text style={styles.errorModalAddress}>{address}</Text>
            <View style={styles.errorModalDivider} />
            <Text style={styles.errorModalMessage}>{connErrorMessage}</Text>
            <TouchableOpacity
              style={styles.errorModalRetryBtn}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={16} color="#0A0E1A" style={{ marginRight: 6 }} />
              <Text style={styles.errorModalRetryText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.errorModalBackBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.errorModalBackText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Android TV pairing — triggered by connection hook */}
      {connection.pairingRequest != null && (
        <AndroidTVPairingModal
          visible
          deviceName={deviceName}
          deviceIp={connection.pairingRequest.address}
          onPaired={connection.resolvePairing}
          onCancel={connection.rejectPairing}
        />
      )}

      {/* Android TV pairing — triggered post-connection (isPaired check / NOT_PAIRED error) */}
      {isAndroidTV && showPairingModal && connection.pairingRequest == null && (
        <AndroidTVPairingModal
          visible
          deviceName={deviceName}
          deviceIp={address}
          onPaired={handlePaired}
          onCancel={() => {
            setShowPairingModal(false);
            pendingActionRef.current = null;
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2535',
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#8892A4',
  },
  retryLink: {
    fontSize: 12,
    color: '#4FC3F7',
    fontWeight: '600',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  // Toast
  toast: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastOk: {
    backgroundColor: '#00C9A7',
  },
  toastErr: {
    backgroundColor: '#FF4F4F',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  // Connection error modal
  errorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorModalCard: {
    width: '100%',
    backgroundColor: '#131929',
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2535',
  },
  errorModalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,79,79,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  errorModalDevice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8892A4',
  },
  errorModalAddress: {
    fontSize: 12,
    color: '#4A5568',
    marginTop: 2,
    marginBottom: 12,
  },
  errorModalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#1E2535',
    marginBottom: 14,
  },
  errorModalMessage: {
    fontSize: 13,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorModalRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4FC3F7',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    marginBottom: 10,
  },
  errorModalRetryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0E1A',
  },
  errorModalBackBtn: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 6,
  },
  errorModalBackText: {
    fontSize: 14,
    color: '#8892A4',
    fontWeight: '500',
  },
  // Layout picker sheet
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#131929',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  pickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A3348',
    alignSelf: 'center',
    marginBottom: 8,
  },
});

