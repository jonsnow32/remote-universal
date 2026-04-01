import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  /** Called when user dismisses without accepting (aborts the connection attempt). */
  onDismiss: () => void;
}

type Method = 'button' | 'smartthings';

/**
 * Full-screen modal shown when awaiting the user to accept the Samsung TV
 * "Allow" pairing popup — assuming they have no physical remote.
 */
export function SamsungTVAllowModal({ visible, onDismiss }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<Method>('button');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* TV icon + title */}
            <View style={styles.iconWrap}>
              <Ionicons name="tv-outline" size={48} color="#3B82F6" />
            </View>
            <Text style={styles.title}>Confirm pairing on your TV</Text>
            <Text style={styles.subtitle}>
              Your TV is showing an <Text style={styles.highlight}>"Allow"</Text> popup.
              {' '}Since you don't have a physical remote, choose a method below to confirm it.
            </Text>

            {/* Method tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, method === 'button' && styles.tabActive]}
                onPress={() => setMethod('button')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="radio-button-on-outline"
                  size={16}
                  color={method === 'button' ? '#3B82F6' : '#64748B'}
                />
                <Text style={[styles.tabText, method === 'button' && styles.tabTextActive]}>
                  TV button
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, method === 'smartthings' && styles.tabActive]}
                onPress={() => setMethod('smartthings')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={16}
                  color={method === 'smartthings' ? '#3B82F6' : '#64748B'}
                />
                <Text style={[styles.tabText, method === 'smartthings' && styles.tabTextActive]}>
                  SmartThings
                </Text>
              </TouchableOpacity>
            </View>

            {/* Instructions per method */}
            {method === 'button' ? (
              <View style={styles.steps}>
                <InfoBox
                  icon="information-circle-outline"
                  text="Most Samsung TVs have a single joystick button — usually centred on the bottom edge or bottom-back of the TV panel."
                />
                <Step index={1} text='Look at your TV screen — the "Allow" popup is visible now.' />
                <Step index={2} text="Find the physical button on the TV body (not the remote)." />
                <Step index={3} text="Press the button once to move the cursor to Allow, then hold for 1–2 seconds to confirm." />
                <Step index={4} text="Some models: press the button repeatedly to cycle between Deny / Allow, then press-and-hold to select." />
              </View>
            ) : (
              <View style={styles.steps}>
                <InfoBox
                  icon="information-circle-outline"
                  text='Use the free Samsung SmartThings app on another phone or tablet as a temporary remote to press "Allow".'
                />
                <Step index={1} text="On another phone, open the App Store / Play Store and install Samsung SmartThings." />
                <Step index={2} text="Open SmartThings → tap + → Add device → Samsung → TV and follow the prompts to add your TV." />
                <Step index={3} text='Once connected, tap the remote icon, navigate to the "Allow" popup on your TV, and press OK.' />
                <Step index={4} text="Come back to this app — it will connect automatically once you allow." />
              </View>
            )}

            {/* Waiting indicator */}
            <View style={styles.waitingRow}>
              <ActivityIndicator color="#3B82F6" size="small" />
              <Text style={styles.waitingText}>Waiting for Allow confirmation…</Text>
            </View>

            {/* Dismiss */}
            <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.8}>
              <Text style={styles.dismissText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Step row ────────────────────────────────────────────────────────────────

function Step({ index, text }: { index: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNum}>{index}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function InfoBox({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.infoBox}>
      <Ionicons name={icon} size={16} color="#60A5FA" style={{ marginTop: 1 }} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#131929',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 28,
    paddingHorizontal: 24,
    maxHeight: '85%',
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  highlight: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3448',
    backgroundColor: '#1A2235',
  },
  tabActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  steps: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    color: '#93C5FD',
    fontSize: 13,
    lineHeight: 19,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNum: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  waitingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  dismissBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A3448',
    alignItems: 'center',
    marginBottom: 4,
  },
  dismissText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
});
