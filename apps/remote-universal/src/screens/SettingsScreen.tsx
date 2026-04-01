import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { usePro } from '../hooks/usePro';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { getApiBaseUrl, setApiBaseUrl } from '../lib/apiUrl';
import { appConfig } from '../config';

interface SettingRow {
  id: string;
  label: string;
  description?: string;
  type: 'toggle' | 'chevron';
  value?: boolean;
}

const GENERAL_SETTINGS: SettingRow[] = [
  { id: 'notifications', label: 'Push Notifications', description: 'Device status alerts', type: 'toggle', value: true },
  { id: 'haptics', label: 'Haptic Feedback', description: 'Vibration on button press', type: 'toggle', value: true },
  { id: 'autoConnect', label: 'Auto-Connect Devices', description: 'Reconnect on network change', type: 'toggle', value: false },
];

const ABOUT_ROWS: SettingRow[] = [
  { id: 'version', label: 'App Version', description: '1.0.0', type: 'chevron' },
  { id: 'privacy', label: 'Privacy Policy', type: 'chevron' },
  { id: 'terms', label: 'Terms of Service', type: 'chevron' },
  { id: 'support', label: 'Contact Support', type: 'chevron' },
];

export function SettingsScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isPro } = usePro();
  const [settings, setSettings] = useState<Record<string, boolean>>({
    notifications: true,
    haptics: true,
    autoConnect: false,
  });

  // Backend URL config
  const [backendUrl, setBackendUrl] = useState(appConfig.apiBaseUrl);
  const [backendUrlDirty, setBackendUrlDirty] = useState(false);

  useEffect(() => {
    void getApiBaseUrl().then(url => setBackendUrl(url));
  }, []);

  const saveBackendUrl = async () => {
    const trimmed = backendUrl.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/.test(trimmed)) {
      Alert.alert('Invalid URL', 'URL must start with http:// or https://');
      return;
    }
    await setApiBaseUrl(trimmed);
    setBackendUrlDirty(false);
    Alert.alert('Saved', 'Backend URL updated. Reopen any remote screens to apply.');
  };

  const resetBackendUrl = async () => {
    await setApiBaseUrl(null);
    setBackendUrl(appConfig.apiBaseUrl);
    setBackendUrlDirty(false);
  };

  const toggle = (id: string) => {
    setSettings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Pro status banner */}
      {isPro ? (
        <View style={styles.proBanner}>
          <Ionicons name="flash" size={24} color="#6C63FF" />
          <View style={styles.proBannerText}>
            <Text style={styles.proBannerTitle}>Pro Active</Text>
            <Text style={styles.proBannerDesc}>All features unlocked — thank you!</Text>
          </View>
          <View style={styles.proActiveBadge}>
            <Text style={styles.proActiveBadgeText}>ACTIVE</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.upgradeCard}
          onPress={() => navigation.navigate('Paywall', { trigger: 'settings' })}
          activeOpacity={0.85}
        >
          <View style={styles.upgradeCardLeft}>
            <Ionicons name="flash" size={24} color="#6C63FF" />
            <View>
              <Text style={styles.upgradeCardTitle}>Upgrade to Pro</Text>
              <Text style={styles.upgradeCardDesc}>Unlimited devices · Macros · Cloud sync</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#6C63FF" />
        </TouchableOpacity>
      )}

      {/* Profile card
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>U</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>UniRemote User</Text>
          <Text style={styles.profileSub}>1 home · 3 devices</Text>
        </View>
        <TouchableOpacity style={styles.editBtn}>
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View> */}

      {/* General */}
      <Text style={styles.sectionLabel}>GENERAL</Text>
      <View style={styles.section}>
        {GENERAL_SETTINGS.map((item, index) => (
          <View key={item.id} style={[styles.row, index < GENERAL_SETTINGS.length - 1 && styles.rowBorder]}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              {item.description && <Text style={styles.rowDesc}>{item.description}</Text>}
            </View>
            <Switch
              value={settings[item.id] ?? false}
              onValueChange={() => toggle(item.id)}
              trackColor={{ false: '#2A3147', true: '#6C63FF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}
      </View>

      {/* About */}
      <Text style={styles.sectionLabel}>ABOUT</Text>
      <View style={styles.section}>
        {ABOUT_ROWS.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, index < ABOUT_ROWS.length - 1 && styles.rowBorder]}
            activeOpacity={0.7}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              {item.description && <Text style={styles.rowDesc}>{item.description}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#4A5568" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Developer / Network */}
      <Text style={styles.sectionLabel}>DEVELOPER</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Backend URL</Text>
            <Text style={styles.rowDesc}>Server IP for real-device testing</Text>
          </View>
        </View>
        <View style={styles.urlRowInput}>
          <TextInput
            style={styles.urlInput}
            value={backendUrl}
            onChangeText={text => { setBackendUrl(text); setBackendUrlDirty(true); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.X:3000"
            placeholderTextColor="#4A5568"
          />
          <TouchableOpacity
            style={[styles.urlSaveBtn, !backendUrlDirty && styles.urlSaveBtnDisabled]}
            onPress={saveBackendUrl}
            disabled={!backendUrlDirty}
          >
            <Text style={styles.urlSaveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.row, styles.urlResetRow]} onPress={resetBackendUrl} activeOpacity={0.7}>
          <View style={styles.rowText}>
            <Text style={[styles.rowLabel, { color: '#8892A4' }]}>Reset to default</Text>
          </View>
          <Ionicons name="refresh" size={16} color="#4A5568" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Pro / upgrade banner
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1E2D',
    borderWidth: 1,
    borderColor: '#6C63FF40',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    gap: 12,
  },
  proBannerEmoji: { fontSize: 24 },
  proBannerText: { flex: 1 },
  proBannerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  proBannerDesc: { color: '#8892A4', fontSize: 12, marginTop: 2 },
  proActiveBadge: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  proActiveBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF18',
    borderWidth: 1,
    borderColor: '#6C63FF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
  },
  upgradeCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeCardEmoji: { fontSize: 24 },
  upgradeCardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  upgradeCardDesc: { color: '#8892A4', fontSize: 12, marginTop: 2 },
  upgradeCardArrow: { color: '#6C63FF', fontSize: 24, fontWeight: '300' },
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    marginRight: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  profileSub: {
    color: '#8892A4',
    fontSize: 13,
    marginTop: 2,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#0A0E1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    color: '#8892A4',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  section: {
    backgroundColor: '#141928',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#2A3147',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  rowDesc: {
    color: '#8892A4',
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: '#8892A4',
    fontSize: 22,
    fontWeight: '300',
  },
  signOutBtn: {
    marginHorizontal: 20,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  signOutText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  urlRowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3147',
    color: '#FFFFFF',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: 'monospace',
  },
  urlSaveBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  urlSaveBtnDisabled: {
    backgroundColor: '#2A3147',
  },
  urlSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  urlResetRow: {
    borderTopWidth: 1,
    borderTopColor: '#2A3147',
  },
});
