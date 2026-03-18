import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RemoteLayout } from '@remote/ui-kit';
import { findLayout, SamsungTizen, SAMSUNG_UNAUTHORIZED, AndroidTV, ANDROID_TV_NOT_PAIRED } from '@remote/device-sdk';
import { IRModule, BLEModule, HomeKitModule, MatterModule } from '@remote/native-modules';
import type { DeviceType, LayoutSection, LayoutButton } from '@remote/core';
import type { RemoteScreenProps, LayoutVariant, ConnectionProtocol } from '../types/navigation';
import type { RemoteLayoutSection } from '@remote/ui-kit';
import { appConfig } from '../config';
import { getApiBaseUrl } from '../lib/apiUrl';
import { AndroidTVPairingModal } from '../components/AndroidTVPairingModal';
import { ConnectionSteps } from '../components/ConnectionSteps';
import { LayoutPicker } from '../components/LayoutPicker';
import { useConnection } from '../hooks/useConnection';
import type { ConnectParams, PairingRequest } from '../hooks/useConnection';
import { ProtocolBadge } from '../components/ProtocolBadge';

// ─── Phase enum ──────────────────────────────────────────────────────────────

type Phase = 'connecting' | 'layout' | 'remote';

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

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast { message: string; ok: boolean }

// ─── Component ───────────────────────────────────────────────────────────────

export function RemoteScreen({ route }: RemoteScreenProps): React.ReactElement {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { deviceName, deviceType, address, protocol, brand, layoutId } = route.params;

  // Phase state
  const [phase, setPhase] = useState<Phase>('connecting');
  const [selectedLayout, setSelectedLayout] = useState<LayoutVariant>('universal');

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

  // Android TV / Samsung state
  const isAndroidTV = layoutId === 'universal-stb';
  const isSamsungTV = layoutId === 'samsung-tv';
  const [showPairingModal, setShowPairingModal] = useState(false);
  const pendingActionRef = useRef<string | null>(null);

  // Resolve backend URL
  useEffect(() => {
    void getApiBaseUrl().then(url => setApiBaseUrlState(url));
  }, []);

  // Start connection on mount — calls real native modules per protocol
  useEffect(() => {
    const params: ConnectParams = { protocol, address, brand, layoutId };
    void connection.connect(params).then((success) => {
      if (success) {
        setPhase('layout');
      }
    });
    return () => { connection.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-establish WebSocket/pairing after layout selection
  useEffect(() => {
    if (phase !== 'remote') return;
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
  }, [phase, isAndroidTV, isSamsungTV, address]);

  // Layout sections based on selected variant
  const universalFallback = DEVICE_TYPE_TO_LAYOUT[deviceType] ?? 'universal-tv';
  const effectiveLayoutId = selectedLayout === 'brand' ? layoutId : selectedLayout === 'simple' ? undefined : layoutId;
  const sections = toRemoteLayoutSections(effectiveLayoutId, universalFallback);

  // Toast
  const showToast = useCallback((message: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, ok });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  // Button handler — protocol-aware command dispatch
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
        // Generic Wi-Fi device (AirPlay, Roku, Chromecast, etc.)
        // Try sending directly to the device, then fall back to the backend relay.
        let sent = false;
        const errors: string[] = [];

        // 1. Direct device HTTP endpoint
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
          } catch (e) {
            errors.push(`Device unreachable`);
          }
        }

        // 2. Backend relay — only attempt if URL points to a real host
        //    (skip localhost / 127.x on physical devices where it's unreachable)
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
            `Command not delivered — ${errors.join('; ') || 'no command channel configured for this device'}`,
          );
        }
      } else {
        throw new Error('No command channel available for this protocol');
      }
      showToast(`✓ ${action}`, true);
    } catch (err) {
      console.log('Error sending command:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, false);
    }
  }, [address, protocol, isSamsungTV, isAndroidTV, apiBaseUrl, showToast]);

  const handlePaired = useCallback(() => {
    setShowPairingModal(false);
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pendingAction) void handleButtonPress(pendingAction);
  }, [handleButtonPress]);

  // ─── Phase: Connecting ─────────────────────────────────────────────────────

  if (phase === 'connecting') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{deviceName}</Text>
            <Text style={styles.headerSub}>Connecting via {protocol === 'wifi' ? 'Wi-Fi' : protocol.toUpperCase()}...</Text>
          </View>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.phaseContent}>
          <ConnectionSteps steps={connection.steps} />
          {connection.status === 'error' ? (
            <>
              <Text style={styles.errorLabel}>Connection failed</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  void connection.connect({ protocol, address, brand, layoutId }).then((success) => {
                    if (success) setPhase('layout');
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.connectingLabel}>Connecting...</Text>
          )}
        </ScrollView>

        {/* Android TV pairing during connection flow */}
        {connection.pairingRequest && (
          <AndroidTVPairingModal
            visible
            deviceName={deviceName}
            deviceIp={connection.pairingRequest.address}
            onPaired={connection.resolvePairing}
            onCancel={connection.rejectPairing}
          />
        )}
      </View>
    );
  }

  // ─── Phase: Layout Selection ───────────────────────────────────────────────

  if (phase === 'layout') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{deviceName}</Text>
            <View style={styles.connectedRow}>
              <Text style={styles.connectedText}>Connected ✓</Text>
              <ProtocolBadge protocol={protocol} />
            </View>
          </View>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.phaseContent}>
          <LayoutPicker
            selected={selectedLayout}
            brandName={brand}
            onSelect={handleLayoutSelect}
          />
        </ScrollView>

        <View style={[styles.phaseFooter, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setPhase('remote')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Phase: Remote Control ─────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{brand ? `${brand} ${deviceType.toUpperCase()}` : deviceName}</Text>
          <View style={styles.connectedRow}>
            <Text style={styles.layoutLabel}>{selectedLayout.charAt(0).toUpperCase() + selectedLayout.slice(1)}</Text>
            <View style={styles.protocolDot}>
              <View style={[styles.protocolDotInner, { backgroundColor: '#00C9A7' }]} />
            </View>
            <Text style={styles.protocolLabel}>{protocol === 'wifi' ? 'Wi-Fi' : protocol.toUpperCase()}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setPhase('layout')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="settings-outline" size={20} color="#8892A4" />
        </TouchableOpacity>
      </View>

      <RemoteLayout sections={sections} onButtonPress={handleButtonPress} />

      {/* Toast */}
      {toast && (
        <Animated.View style={[styles.toast, toast.ok ? styles.toastOk : styles.toastErr, { opacity: toastAnim }]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

      {/* Android TV pairing */}
      {isAndroidTV && (
        <AndroidTVPairingModal
          visible={showPairingModal}
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
  headerSub: {
    fontSize: 12,
    color: '#8892A4',
    marginTop: 2,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  connectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00C9A7',
  },
  layoutLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8892A4',
  },
  protocolDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  protocolLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8892A4',
  },
  // Phases
  phaseContent: {
    padding: 20,
    paddingBottom: 100,
  },
  connectingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4FC3F7',
    textAlign: 'center',
    marginTop: 24,
  },
  errorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4F4F',
    textAlign: 'center',
    marginTop: 24,
  },
  retryBtn: {
    backgroundColor: '#1E2535',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 40,
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4FC3F7',
  },
  phaseFooter: {
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
  primaryBtn: {
    backgroundColor: '#4FC3F7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0E1A',
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
});
