import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RemoteLayout } from '@remote/ui-kit';
import { findLayout, SamsungTizen, SAMSUNG_UNAUTHORIZED, AndroidTV, ANDROID_TV_NOT_PAIRED } from '@remote/device-sdk';
import type { DeviceType, LayoutSection, LayoutButton } from '@remote/core';
import type { DeviceRemoteProps } from '../types/navigation';
import type { RemoteLayoutSection } from '@remote/ui-kit';
import { appConfig } from '../config';
import { getApiBaseUrl } from '../lib/apiUrl';
import { AndroidTVPairingModal } from '../components/AndroidTVPairingModal';

// ─────────────────────────────────────────────────────────────────────────────

/** Map DeviceType → universal layout id from device-sdk */
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

/** Convert device-sdk LayoutSection[] → ui-kit RemoteLayoutSection[] */
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
      // ui-kit RemoteLayoutButton only supports 'primary' | 'ghost'; map 'danger' → 'ghost'
      variant: btn.variant === 'danger' ? 'ghost' : btn.variant,
      size: btn.size,
    })),
  }));
}

interface Toast { message: string; ok: boolean }

export function RemoteScreen({ route }: DeviceRemoteProps): React.ReactElement {
  const navigation = useNavigation();
  const { deviceName, deviceType, address, layoutId } = route.params;

  const universalFallback = DEVICE_TYPE_TO_LAYOUT[deviceType] ?? 'universal-tv';
  const sections = toRemoteLayoutSections(layoutId, universalFallback);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolved backend URL (AsyncStorage override > env var > hardcoded default)
  const [apiBaseUrl, setApiBaseUrlState] = useState(appConfig.apiBaseUrl);

  // Android TV pairing state
  const isAndroidTV = layoutId === 'universal-stb';
  const isSamsungTV = layoutId === 'samsung-tv';
  const [showPairingModal, setShowPairingModal] = useState(false);
  const pendingActionRef = useRef<string | null>(null);

  // Resolve the real backend URL on mount (may differ from build-time default on real devices)
  useEffect(() => {
    void getApiBaseUrl().then(url => setApiBaseUrlState(url));
  }, []);

  // On mount, proactively check pairing status for Android TV devices.
  // If already paired, pre-establish persistent remote session for instant key sends.
  useEffect(() => {
    if (!isAndroidTV) return;
    void AndroidTV.isPaired(address).then(paired => {
      if (!paired) setShowPairingModal(true);
      else void AndroidTV.connectRemote(address).catch(() => {});
    });
    return () => { void AndroidTV.disconnectRemote(address).catch(() => {}); };
  }, [isAndroidTV, address]);

  // Pre-establish persistent WebSocket for Samsung Tizen TVs.
  useEffect(() => {
    if (!isSamsungTV) return;
    let cancelled = false;
    void SamsungTizen.connect(address).catch((err) => {
      if (cancelled) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === SAMSUNG_UNAUTHORIZED) {
        Alert.alert(
          'Samsung TV pairing',
          'Please check your TV screen for an "Allow" popup and accept it.\n\n' +
          'If no popup appears, go to:\nSettings › General › External Device Manager › Device Connection Manager\nand set Access Notification to "First Time Only".',
        );
      }
    });
    return () => { cancelled = true; SamsungTizen.disconnect(address); };
  }, [isSamsungTV, address]);

  const showToast = useCallback((message: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, ok });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  const handleButtonPress = useCallback(async (action: string) => {
    showToast(`⏳ ${action}`, true);
    try {
      if (layoutId === 'samsung-tv') {
        await SamsungTizen.sendAction(address, action);
      } else if (isAndroidTV) {
        try {
          await AndroidTV.sendAction(address, action);
        } catch (err) {
          // NOT_PAIRED = not paired yet — open pairing modal and retry after pairing.
          const code = (err as Error & { code?: string }).code;
          if (code === ANDROID_TV_NOT_PAIRED) {
            pendingActionRef.current = action;
            setShowPairingModal(true);
            return;
          }
          throw err;
        }
      } else {
        const res = await fetch(`${apiBaseUrl}/api/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: address, action }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      showToast(`✓ ${action}`, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === SAMSUNG_UNAUTHORIZED) {
        Alert.alert(
          'TV pairing required',
          'Your Samsung TV is blocking connections.\n\n' +
          '1. Find the physical button on the back of your TV (center joystick).\n' +
          '2. Press it to open the menu.\n' +
          '3. Navigate to:\n' +
          '   Settings › General › External Device Manager › Device Connection Manager\n' +
          '4. Set "Access Notification" to "First Time Only".\n' +
          '5. Then press any button here — the TV will show a popup, approve it using the physical button.',
          [{ text: 'OK' }]
        );
      } else {
        console.warn('[RemoteScreen] command failed:', msg);
        showToast(msg, false);
      }
    }
  }, [address, layoutId, isAndroidTV, apiBaseUrl, showToast]);

  const handlePaired = useCallback(() => {
    setShowPairingModal(false);
    // Retry any button press that triggered the pairing modal.
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pendingAction) void handleButtonPress(pendingAction);
  }, [handleButtonPress]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{deviceName}</Text>
          <Text style={styles.headerSub}>{address}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <RemoteLayout sections={sections} onButtonPress={handleButtonPress} />

      {toast && (
        <Animated.View style={[styles.toast, toast.ok ? styles.toastOk : styles.toastErr, { opacity: toastAnim }]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2535',
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
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
