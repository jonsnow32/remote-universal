import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  NativeModules,
  Platform,
} from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AndroidTV } from '@remote/device-sdk';
import { useTheme } from '@remote/ui-kit';

/** Returns true when the AndroidTV native module is linked. */
function isAndroidTVAvailable(): boolean {
  const available = NativeModules.AndroidTV != null;
  if (__DEV__) {
    console.log('[AndroidTV] NativeModules.AndroidTV available:', available);
  }
  return available;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  deviceName: string;
  deviceIp: string;
  onPaired: () => void;
  onCancel: () => void;
}

type Step = 'idle' | 'starting' | 'waiting_pin' | 'confirming' | 'done' | 'error' | 'unsupported';

// ─── Component ────────────────────────────────────────────────────────────────

export function AndroidTVPairingModal({
  visible,
  deviceName,
  deviceIp,
  onPaired,
  onCancel,
}: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [step, setStep] = useState<Step>('idle');
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const pinInputRef = useRef<TextInput>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setPin('');
    setErrorMessage('');
  }, []);

  const handleCancel = useCallback(() => {
    reset();
    onCancel();
  }, [reset, onCancel]);

  const handleStartPairing = useCallback(async () => {
    if (!isAndroidTVAvailable()) {
      setStep('unsupported');
      return;
    }
    setStep('starting');
    setErrorMessage('');
    try {
      await AndroidTV.startPairing(deviceIp);
      setStep('waiting_pin');
      setTimeout(() => pinInputRef.current?.focus(), 100);
    } catch (err) {
      //log error details for debugging
      console.error('Error starting Android TV pairing:', err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }, [deviceIp]);

  const handleConfirmPin = useCallback(async () => {
    if (pin.length !== 6) return;
    setStep('confirming');
    setErrorMessage('');
    try {
      await AndroidTV.confirmPairing(deviceIp, pin);
      setStep('done');
      setTimeout(() => {
        reset();
        onPaired();
      }, 800);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }, [deviceIp, pin, reset, onPaired]);

  const handleRetry = useCallback(() => {
    setPin('');
    setErrorMessage('');
    setStep('idle');
  }, []);

  /** Accept only hex characters (0-9, A-F) and auto-uppercase. */
  const handlePinChange = useCallback((text: string) => {
    setPin(text.replace(/[^0-9a-fA-F]/g, '').toUpperCase());
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const renderBody = () => {
    switch (step) {
      case 'unsupported':
        return (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="phone-portrait-outline" size={48} color={theme.colors.warning} />
            </View>
            <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.fontFamilyBold }]}>Not available</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
              Android TV pairing requires a physical device.{`\n`}
              This feature is not available in the simulator or Expo Go.
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]} onPress={handleCancel} activeOpacity={0.85}>
              <Text style={[styles.primaryBtnText, { fontFamily: theme.typography.fontFamilyBold }]}>Close</Text>
            </TouchableOpacity>
          </>
        );

      case 'idle':
        return (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="tv-outline" size={48} color={theme.colors.primary} />
            </View>
            <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.fontFamilyBold }]}>Pair with {deviceName}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
              A 6-digit code will appear on your TV screen.{'\n'}
              Make sure your TV is on and connected to the same Wi-Fi.
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]} onPress={() => { void handleStartPairing(); }} activeOpacity={0.85}>
              <Text style={[styles.primaryBtnText, { fontFamily: theme.typography.fontFamilyBold }]}>Start Pairing</Text>
            </TouchableOpacity>
          </>
        );

      case 'starting':
        return (
          <>
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 20 }} />
            <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.fontFamilyBold }]}>Connecting to TV…</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>Please wait while we contact your TV.</Text>
          </>
        );

      case 'waiting_pin':
        return (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="keypad-outline" size={48} color={theme.colors.success} />
            </View>
            <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.fontFamilyBold }]}>Enter the code</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
              A 6-digit code is showing on your TV.{'\n'}Type it below.
            </Text>
            <TextInput
              ref={pinInputRef}
              style={[styles.pinInput, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border, fontFamily: theme.typography.fontFamilyBold }]}
              value={pin}
              onChangeText={handlePinChange}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              placeholder="0A1B2C"
              placeholderTextColor={theme.colors.textSecondary}
              textAlign="center"
              returnKeyType="done"
              onSubmitEditing={() => { void handleConfirmPin(); }}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }, pin.length !== 6 && styles.primaryBtnDisabled]}
              onPress={() => { void handleConfirmPin(); }}
              disabled={pin.length !== 6}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryBtnText, { fontFamily: theme.typography.fontFamilyBold }]}>Confirm</Text>
            </TouchableOpacity>
          </>
        );

      case 'confirming':
        return (
          <>
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 20 }} />
            <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.fontFamilyBold }]}>Verifying…</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>Confirming the code with your TV.</Text>
          </>
        );

      case 'done':
        return (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={theme.colors.success} />
            </View>
            <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.fontFamilyBold }]}>Paired!</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>{deviceName} is ready to control.</Text>
          </>
        );

      case 'error':
        return (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="warning-outline" size={48} color={theme.colors.error} />
            </View>
            <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.typography.fontFamilyBold }]}>Pairing failed</Text>
            <Text style={[styles.subtitle, styles.errorText, { fontFamily: theme.typography.fontFamily }]}>{errorMessage}</Text>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]} onPress={handleRetry} activeOpacity={0.85}>
              <Text style={[styles.primaryBtnText, { fontFamily: theme.typography.fontFamilyBold }]}>Try Again</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  const isBusy = step === 'starting' || step === 'confirming' || step === 'done';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={isBusy ? undefined : handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.sheet, { backgroundColor: theme.colors.background, paddingBottom: insets.bottom + 24 }]}> 
            {/* Drag handle */}
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

            {/* Close button */}
            {!isBusy && (
              <TouchableOpacity style={styles.closeBtn} onPress={handleCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}

            <View style={styles.body}>
              {renderBody()}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#131929',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A3348',
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
  },
  body: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconWrap: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  errorText: {
    color: '#FF6B6B',
  },
  pinInput: {
    width: '70%',
    height: 64,
    backgroundColor: '#1E2535',
    borderRadius: 14,
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A3348',
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
