import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  StatusBar,
} from 'react-native';
import type { PermissionsScreenProps } from '../../types/navigation';

interface Permission {
  id: string;
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
}

export function PermissionsScreen({ navigation }: PermissionsScreenProps) {
  const [permissions, setPermissions] = useState<Permission[]>([
    { id: 'wifi', icon: '📶', title: 'Wi-Fi Network', description: 'Find Smart TVs & ACs', enabled: true },
    { id: 'bluetooth', icon: '🔵', title: 'Bluetooth', description: 'Pair BLE devices', enabled: true },
    { id: 'localnet', icon: '🔍', title: 'Local Network', description: 'Device discovery', enabled: true },
  ]);

  const toggle = (id: string) => {
    setPermissions(prev =>
      prev.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const allEnabled = permissions.every(p => p.enabled);

  const handleContinue = () => {
    navigation.navigate('SetupComplete');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <Text style={styles.title}>Allow Access</Text>
        <Text style={styles.subtitle}>
          We need these to find{'\n'}your devices automatically
        </Text>
      </View>

      <View style={styles.permissionList}>
        {permissions.map(p => (
          <View key={p.id} style={styles.permissionRow}>
            <View style={styles.permIcon}>
              <Text style={{ fontSize: 22 }}>{p.icon}</Text>
            </View>
            <View style={styles.permInfo}>
              <Text style={styles.permTitle}>{p.title}</Text>
              <Text style={styles.permDesc}>{p.description}</Text>
            </View>
            <Switch
              value={p.enabled}
              onValueChange={() => toggle(p.id)}
              trackColor={{ false: '#2A3147', true: '#6C63FF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, !allEnabled && styles.btnPartial]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Allow All &amp; Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionList: {
    gap: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  permIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1A2035',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permInfo: {
    flex: 1,
  },
  permTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  permDesc: {
    fontSize: 13,
    color: '#8892A4',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
  },
  btn: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPartial: {
    opacity: 0.8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
