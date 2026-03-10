import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

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
  const [settings, setSettings] = useState<Record<string, boolean>>({
    notifications: true,
    haptics: true,
    autoConnect: false,
  });

  const toggle = (id: string) => {
    setSettings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Profile card */}
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
      </View>

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
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
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
});
