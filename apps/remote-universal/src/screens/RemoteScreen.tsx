import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, StatusBar, Modal, ActivityIndicator, PermissionsAndroid, Platform, Linking, NativeEventEmitter, NativeModules } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RemoteLayout } from '@remote/ui-kit';
import type { TextInputWHandle } from '@remote/ui-kit';
import { findLayout, SamsungTizen, AndroidTV, ANDROID_TV_NOT_PAIRED } from '@remote/device-sdk';
import { IRModule, BLEModule, HomeKitModule, MatterModule, MicStreamModule } from '@remote/native-modules';
import type { DeviceType, LayoutSection } from '@remote/core';
import type { RemoteScreenProps, LayoutVariant } from '../types/navigation';
import { appConfig } from '../config';
import { getApiBaseUrl } from '../lib/apiUrl';
import { AndroidTVPairingModal } from '../components/AndroidTVPairingModal';
import { SamsungTVAllowModal } from '../components/SamsungTVAllowModal';
import { LayoutPicker } from '../components/LayoutPicker';
import { useConnection } from '../hooks/useConnection';
import type { ConnectParams } from '../hooks/useConnection';
import { useIRResolver } from '../hooks/useIRResolver';
import { ProtocolBadge } from '../components/ProtocolBadge';
import { VoiceCommandModal } from '../components/VoiceCommandModal';

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface Toast { message: string; ok: boolean }
type ConnStatus = 'connecting' | 'connected' | 'error';

// ─── Component ───────────────────────────────────────────────────────────────

export function RemoteScreen({ route }: RemoteScreenProps): React.ReactElement {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { deviceName, deviceType, address, protocol, brand, layoutId, model, codesetId } = route.params;

  const irResolver = useIRResolver({
    brand: brand ?? '',
    category: deviceType,
    model,
    codesetId,
  });

  // Connection runs in background — remote is shown immediately
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting');

  // Layout — selectedLayout holds a layout ID from the registry
  const universalFallbackId = DEVICE_TYPE_TO_LAYOUT[deviceType] ?? 'universal-tv';
  const [selectedLayout, setSelectedLayout] = useState<string>(layoutId ?? universalFallbackId);
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);

  // Persist layout preference per device
  const layoutStorageKey = `layout_pref_${route.params.deviceId ?? address}`;
  useEffect(() => {
    void AsyncStorage.getItem(layoutStorageKey).then(saved => {
      if (saved) setSelectedLayout(saved);
    });
  }, [layoutStorageKey]);

  const handleLayoutSelect = useCallback((layoutId: string) => {
    setSelectedLayout(layoutId);
    setShowLayoutPicker(false);
    void AsyncStorage.setItem(layoutStorageKey, layoutId);
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
  const brandLower = (brand ?? '').toLowerCase();
  const isSamsungTV = brandLower === 'samsung' && (deviceType === 'tv' || deviceType === 'stb');
  const isAndroidTV = !isSamsungTV && (
    deviceType === 'stb' ||
    brandLower.includes('android') ||
    brandLower === 'google' ||
    brandLower === 'nvidia'
  );
  const [showPairingModal, setShowPairingModal] = useState(false);
  const pendingActionRef = useRef<string | null>(null);

  // Samsung TV "Allow" guidance modal (shown on ms.channel.unauthorized)
  const [showSamsungAllowModal, setShowSamsungAllowModal] = useState(false);

  // Voice command modal
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Connection error modal
  const [showConnErrorModal, setShowConnErrorModal] = useState(false);

  // Keyboard mirroring — tracks the last text value sent to the TV so we can
  // diff each KEYBOARD_INPUT event and only send the delta (Android TV) or
  // replace the whole field (Samsung).
  const lastMirroredTextRef = useRef<string>('');
  // Handle to the TextInputW widget — used to programmatically open it when
  // the TV opens a text field (AndroidTVIme event).
  const textInputHandleRef = useRef<TextInputWHandle | null>(null);

  useEffect(() => {
    void getApiBaseUrl().then(url => setApiBaseUrlState(url));
  }, []);

  // ─── Connect in background ────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    setShowConnErrorModal(false);
    setShowSamsungAllowModal(false);
    setConnStatus('connecting');
    void connection.connect({
      protocol, address, brand, layoutId,
      onSamsungUnauthorized: () => setShowSamsungAllowModal(true),
    }).then((success) => {
      setShowSamsungAllowModal(false);
      setConnStatus(success ? 'connected' : 'error');
      if (!success) setShowConnErrorModal(true);
    });
  }, [connection, protocol, address, brand, layoutId]);

  useEffect(() => {
    void connection.connect({
      protocol, address, brand, layoutId,
      onSamsungUnauthorized: () => setShowSamsungAllowModal(true),
    } as ConnectParams).then((success) => {
      setShowSamsungAllowModal(false);
      setConnStatus(success ? 'connected' : 'error');
      if (!success) setShowConnErrorModal(true);
    });
    return () => { connection.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Post-connect TV setup (WebSocket / pairing check) ───────────────────
  // Pre-connect as soon as we are connected and paired so the first button
  // press is instant.  We intentionally do NOT disconnect in this cleanup —
  // a connStatus flicker would otherwise tear down and immediately recreate
  // the session, causing the double-connect race.
  useEffect(() => {
    if (connStatus !== 'connected' || !isAndroidTV) return;
    void AndroidTV.isPaired(address).then(paired => {
      if (!paired) setShowPairingModal(true);
      else void AndroidTV.connectRemote(address).catch(() => {});
    });
  }, [connStatus, isAndroidTV, address]);

  // Disconnect only when the target device changes or the screen unmounts.
  useEffect(() => {
    if (!isAndroidTV) return;
    return () => { void AndroidTV.disconnectRemote(address).catch(() => {}); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAndroidTV, address]);

  // ─── TV-driven keyboard sync ──────────────────────────────────────────────
  // When the TV opens a text field it sends RMF_IME, which the native module
  // re-emits as "AndroidTVIme".  We open the phone keyboard pre-filled with
  // the TV's current text so the user can edit it directly.
  useEffect(() => {
    if (!isAndroidTV) return;
    const emitter = new NativeEventEmitter(NativeModules.AndroidTV);
    const sub = emitter.addListener(
      'AndroidTVIme',
      (event: { ip: string; text: string; hint: string; active: boolean }) => {
        if (event.ip !== address) return;
        if (event.active) {
          lastMirroredTextRef.current = event.text;
          textInputHandleRef.current?.openWithText(event.text, event.hint);
        }
      },
    );
    return () => sub.remove();
  }, [isAndroidTV, address]);

  // ─── Layout sections ──────────────────────────────────────────────────────

  const sections: LayoutSection[] = findLayout(selectedLayout, universalFallbackId)?.sections ?? [];

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
    // ── Keyboard mirroring intercept ─────────────────────────────────────────
    // TextInputW fires KEYBOARD_INPUT:<text> on every keystroke.
    // Reset mirroring state when the keyboard modal opens.
    if (action === 'KEYBOARD_OPEN') {
      lastMirroredTextRef.current = '';
      return;
    }

    if (action.startsWith('KEYBOARD_INPUT:')) {
      const newText = action.slice('KEYBOARD_INPUT:'.length);
      lastMirroredTextRef.current = newText;

      try {
        if (isSamsungTV) {
          // Samsung: replace the entire field value in one shot.
          await SamsungTizen.replaceInputText(address, newText);
        } else if (isAndroidTV) {
          // Android TV: use native IME batch-edit (debounced 300 ms in native).
          // The native sendText calls RemoteImeKeyInject which replaces the full
          // field value — no per-character diffing needed.
          await AndroidTV.sendText(address, newText);
        }
        // IR / BLE / WiFi: mirroring not supported.
      } catch (err) {
        const code = (err as Error & { code?: string }).code;
        if (code === ANDROID_TV_NOT_PAIRED) {
          setShowPairingModal(true);
        } else {
          showToast(err instanceof Error ? err.message : 'Keyboard sync failed', false);
        }
      }
      return;
    }

    // ── Text-input submit intercept ──────────────────────────────────────────
    // TextInputW fires `${widget.action}:${text}` on submit (e.g. "SEARCH:hello").
    const colonIdx = action.indexOf(':');
    if (colonIdx !== -1 && !action.startsWith('KEYBOARD_INPUT:')) {
      const baseAction = action.slice(0, colonIdx);
      const inputText  = action.slice(colonIdx + 1);
      try {
        if (isSamsungTV) {
          // If text was already mirrored just press ENTER; otherwise open search + type.
          if (lastMirroredTextRef.current !== '') {
            await SamsungTizen.sendKey(address, 'KEY_ENTER');
          } else {
            await SamsungTizen.sendText(address, inputText);
          }
        } else if (isAndroidTV) {
          // submitText cancels the pending debounce, immediately sends the text
          // via RemoteImeKeyInject, then presses ENTER — all in one native call.
          await AndroidTV.submitText(address, inputText);
        } else {
          // IR / BLE / WiFi: forward the base action so backend can handle it.
          await handleButtonPress(baseAction);
        }
        lastMirroredTextRef.current = '';
        showToast(`✓ ${baseAction}: ${inputText}`, true);
      } catch (err) {
        const code = (err as Error & { code?: string }).code;
        if (isAndroidTV && code === ANDROID_TV_NOT_PAIRED) {
          pendingActionRef.current = action;
          setShowPairingModal(true);
        } else {
          showToast(err instanceof Error ? err.message : String(err), false);
        }
      }
      return;
    }

    // Voice widget intercept
    if (action === 'VOICE_COMMAND') {
      if (isAndroidTV) {
        // Android TV: send KEYCODE_ASSIST to open Google Assistant on the TV
        try {
          await AndroidTV.sendAction(address, 'VOICE_COMMAND');
        } catch (err) {
          const code = (err as Error & { code?: string }).code;
          if (code === ANDROID_TV_NOT_PAIRED) {
            pendingActionRef.current = action;
            setShowPairingModal(true);
            return;
          }
          showToast(err instanceof Error ? err.message : 'Could not reach TV', false);
        }
        return;
      }
      // Samsung TV: stream mic audio via ms.remote.voice WebSocket
      if (isSamsungTV) {
        if (Platform.OS === 'android') {
          const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          if (!already) {
            const result = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
              {
                title: 'Microphone permission',
                message: 'Voice remote needs the microphone to send audio to your TV.',
                buttonPositive: 'Allow',
                buttonNegative: 'Deny',
              },
            );
            if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
              showToast('Enable microphone in Settings → App permissions', false);
              void Linking.openSettings();
              return;
            }
            if (result !== PermissionsAndroid.RESULTS.GRANTED) {
              showToast('Microphone permission denied', false);
              return;
            }
          }
        }
        setShowVoiceModal(true);
        return;
      }
      showToast('Voice not supported for this device', false);
      return;
    }

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
        const irResult = await irResolver.transmit(action);
        if (irResult.status === 'unavailable') {
          showToast(irResult.reason ?? 'IR blaster not available', false);
          return;
        }
        if (irResult.status === 'not_found') {
          showToast(`No IR code found for: ${action}`, false);
          return;
        }
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
            {`${deviceName} ${deviceType.toUpperCase()}`}
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
      <RemoteLayout
        sections={sections}
        onButtonPress={handleButtonPress}
        onRegisterTextInput={h => { textInputHandleRef.current = h; }}
      />

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
          <View
            style={[styles.pickerSheet, { paddingBottom: insets.bottom + 16 }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.pickerHandle} />
            <LayoutPicker
              deviceType={deviceType}
              selected={selectedLayout}
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

      {/* Samsung TV "Allow" guidance modal */}
      <SamsungTVAllowModal
        visible={showSamsungAllowModal}
        onDismiss={() => {
          setShowSamsungAllowModal(false);
          SamsungTizen.disconnect(address);
        }}
      />

      {/* Voice command modal.
          'stream' mode: press-and-hold mic, audio streamed to TV via ms.remote.voice.
          'stt' mode:    tap mic, phone STT → text typed into TV search field.
          Mode auto-switches to 'stt' on first ms.error from the TV. */}
      <VoiceCommandModal
        visible={showVoiceModal}
        mode="stream"
        onMicStart={() => {
          void (async () => {
            if (isSamsungTV) {
              try {
                await SamsungTizen.startVoiceSession(address);
                console.log('[Voice] startVoiceSession accepted — stream mode');
              } catch (e) {
                console.warn('[Voice] ms.remote.voice rejected:', e);
                showToast('Voice streaming not supported on this TV', false);
                setShowVoiceModal(false);
                return;
              }
              await MicStreamModule.start().catch((err: unknown) => {
                showToast(err instanceof Error ? err.message : 'Mic failed to start', false);
              });
              const unsubscribe = MicStreamModule.onChunk((b64) => {
                if (isSamsungTV) SamsungTizen.sendVoiceAudioChunk(address, b64);
              });
              (pendingActionRef as React.MutableRefObject<unknown>).current = unsubscribe;
            }
          })();
        }}
        onMicStop={() => {
          void MicStreamModule.stop().catch(() => {});
          if (isSamsungTV) void SamsungTizen.stopVoiceSession(address).catch(() => {});
          const unsubscribe = (pendingActionRef as React.MutableRefObject<unknown>).current;
          if (typeof unsubscribe === 'function') {
            (unsubscribe as () => void)();
            (pendingActionRef as React.MutableRefObject<unknown>).current = null;
          }
        }}
        onClose={() => {
          void MicStreamModule.stop().catch(() => {});
          if (isSamsungTV) void SamsungTizen.stopVoiceSession(address).catch(() => {});
          const unsubscribe = (pendingActionRef as React.MutableRefObject<unknown>).current;
          if (typeof unsubscribe === 'function') {
            (unsubscribe as () => void)();
            (pendingActionRef as React.MutableRefObject<unknown>).current = null;
          }
          setShowVoiceModal(false);
        }}
      />

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

