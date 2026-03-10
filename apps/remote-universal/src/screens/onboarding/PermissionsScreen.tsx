import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  StatusBar,
  ScrollView,
  Platform,
  Linking,
  PermissionsAndroid,
  type Permission as AndroidPermission,
} from 'react-native';
import type { PermissionsScreenProps } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PermId = 'wifi' | 'bluetooth' | 'localnet' | 'ir';

/**
 * - info       : informational only — no OS request, no toggle
 * - permission : needs a runtime OS permission grant (shows Switch)
 * - capability : hardware probe — not requestable, shows Supported/Unavailable badge
 */
type PermKind = 'info' | 'permission' | 'capability';

interface PermItem {
  id: PermId;
  kind: PermKind;
  icon: string;
  title: string;
  description: string;
  /** null = still checking */
  granted: boolean | null;
}

// ---------------------------------------------------------------------------
// Android permission constants
// ---------------------------------------------------------------------------

const ANDROID_BLE_PERMS: AndroidPermission[] =
  Platform.OS === 'android' && Number(Platform.Version) >= 31
    ? [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as AndroidPermission,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as AndroidPermission,
    ]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as AndroidPermission];

const ANDROID_LOCATION_PERM =
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as AndroidPermission;

// ---------------------------------------------------------------------------
// Static item definitions
// ---------------------------------------------------------------------------

const INITIAL_ITEMS: PermItem[] = [
  {
    id: 'wifi',
    kind: 'info',
    icon: '📶',
    title: 'Wi-Fi Network',
    description:
      'Không cần cấp quyền. Chỉ cần đảm bảo điện thoại và thiết bị thông minh (TV, máy lạnh…) đang kết nối cùng một mạng Wi-Fi thì app mới có thể tìm thấy và điều khiển chúng.',
    granted: true, // always "ready" — informational only
  },
  {
    id: 'bluetooth',
    kind: 'permission',
    icon: '🔵',
    title: 'Bluetooth',
    description:
      'Dùng để quét và kết nối các thiết bị BLE như loa thông minh, đèn thông minh, và một số điều hòa thế hệ mới hỗ trợ giao thức BLE.',
    granted: null,
  },
  {
    id: 'localnet',
    kind: 'permission',
    icon: '🔍',
    title: 'Local Network (mDNS / SSDP)',
    description:
      'Cho phép quét mạng nội bộ để phát hiện Smart TV, Daikin AC, Chromecast và các thiết bị hỗ trợ Zeroconf. Trên Android, quyền này dùng chung với Location Access.',
    granted: null,
  },
  {
    id: 'ir',
    kind: 'capability',
    icon: '🔴',
    title: 'IR Blaster (Hồng ngoại)',
    description:
      'Biến điện thoại thành remote hồng ngoại để điều khiển TV, điều hòa, đầu thu không cần Wi-Fi hay Bluetooth. Chỉ hoạt động trên máy có đèn IR tích hợp (Samsung Galaxy S/A series). iPhone không hỗ trợ tính năng này.',
    granted: null, // will be probed on mount
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PermissionsScreen({ navigation }: PermissionsScreenProps) {
  const [items, setItems] = useState<PermItem[]>(INITIAL_ITEMS);

  const patchItem = (id: PermId, granted: boolean) =>
    setItems(prev => prev.map(p => (p.id === id ? { ...p, granted } : p)));

  // On mount: check existing permissions + probe IR hardware
  useEffect(() => {
    void (async () => {
      // Android runtime permissions
      if (Platform.OS === 'android') {
        const locGranted = await PermissionsAndroid.check(ANDROID_LOCATION_PERM);
        patchItem('localnet', locGranted);

        const bleResults = await Promise.all(
          ANDROID_BLE_PERMS.map(p => PermissionsAndroid.check(p))
        );
        patchItem('bluetooth', bleResults.every(Boolean));
      }

      // IR hardware probe
      if (Platform.OS !== 'android') {
        patchItem('ir', false); // iPhones have no IR emitter
      } else {
        try {
          // Dynamic import — gracefully degrades if native module isn't linked
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { IRModule } = require('@remote/native-modules') as typeof import('@remote/native-modules');
          patchItem('ir', await IRModule.isAvailable());
        } catch {
          patchItem('ir', false); // not linked (e.g. Expo Go)
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Request one permission group (kind === 'permission' only). */
  const requestPermission = useCallback(async (id: PermId): Promise<boolean> => {
    if (Platform.OS === 'android') {
      if (id === 'localnet') {
        const result = await PermissionsAndroid.request(ANDROID_LOCATION_PERM, {
          title: 'Quyền truy cập vị trí',
          message:
            'UniRemote dùng quyền Location để quét mạng nội bộ và tìm thiết bị thông minh trong nhà bạn.',
          buttonPositive: 'Cho phép',
          buttonNegative: 'Từ chối',
        });
        const ok = result === PermissionsAndroid.RESULTS.GRANTED;
        patchItem('localnet', ok);
        return ok;
      }
      if (id === 'bluetooth') {
        const results = await PermissionsAndroid.requestMultiple(ANDROID_BLE_PERMS);
        const ok = Object.values(results).every(
          r => r === PermissionsAndroid.RESULTS.GRANTED
        );
        patchItem('bluetooth', ok);
        return ok;
      }
    } else {
      // iOS — open Settings so user can toggle manually
      await Linking.openSettings();
      patchItem(id, true); // optimistic
      return true;
    }
    return false;
  }, []);

  const handleToggle = useCallback(
    (id: PermId, newValue: boolean) => {
      if (newValue) {
        void requestPermission(id);
      } else {
        // Can't revoke from JS — send to Settings
        void Linking.openSettings();
      }
    },
    [requestPermission]
  );

  const handleAllowAll = useCallback(async () => {
    // Only request items that are actual permissions and not yet granted
    const pending = items.filter(
      p => p.kind === 'permission' && p.granted !== true
    );
    await Promise.all(pending.map(p => requestPermission(p.id)));
    navigation.navigate('SetupComplete');
  }, [items, navigation, requestPermission]);

  // "All done" only counts actual permission items
  const allPermissionsGranted = items
    .filter(p => p.kind === 'permission')
    .every(p => p.granted === true);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderRight = (p: PermItem) => {
    if (p.kind === 'info') {
      return (
        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeText}>✓ Sẵn sàng</Text>
        </View>
      );
    }
    if (p.kind === 'capability') {
      if (p.granted === null) {
        return <Text style={styles.capabilityChecking}>Đang kiểm tra…</Text>;
      }
      return (
        <View style={[styles.capabilityBadge, p.granted ? styles.capabilityOk : styles.capabilityNo]}>
          <Text style={styles.capabilityText}>
            {p.granted ? '✓ Hỗ trợ' : '✗ Không có'}
          </Text>
        </View>
      );
    }
    // kind === 'permission'
    return (
      <Switch
        value={p.granted === true}
        onValueChange={v => handleToggle(p.id, v)}
        trackColor={{ false: '#2A3147', true: '#6C63FF' }}
        thumbColor="#FFFFFF"
      />
    );
  };

  const rowBorderColor = (p: PermItem): string | undefined => {
    if (p.kind === 'info') return '#1E3A5F';
    if (p.kind === 'capability') {
      if (p.granted === null) return undefined;
      return p.granted ? '#00C896' : '#2A3147';
    }
    if (p.granted === true) return '#6C63FF';
    if (p.granted === false) return '#FF6B6B';
    return undefined;
  };

  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />
      <ScrollView
        style={styles.permissionList}
        contentContainerStyle={styles.permissionListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Thiết lập quyền truy cập</Text>
          <Text style={styles.subtitle}>
            Xem lại từng tính năng để UniRemote{'\n'}hoạt động tốt nhất trong nhà bạn
          </Text>
        </View>
        {items.map(p => (
          <View
            key={p.id}
            style={[
              styles.permissionRow,
              rowBorderColor(p) ? { borderWidth: 1, borderColor: rowBorderColor(p) } : null,
            ]}
          >
            <View style={styles.permIcon}>
              <Text style={{ fontSize: 22 }}>{p.icon}</Text>
            </View>
            <View style={styles.permInfo}>
              <Text style={styles.permTitle}>{p.title}</Text>
              <Text style={styles.permDesc}>{p.description}</Text>
              {p.kind === 'permission' && p.granted === false && (
                <Text style={styles.permDenied}>Bị từ chối — nhấn để mở Cài đặt</Text>
              )}
            </View>
            <View style={styles.permRight}>{renderRight(p)}</View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, !allPermissionsGranted && styles.btnPartial]}
          onPress={() => void handleAllowAll()}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>
            {allPermissionsGranted ? 'Tiếp tục' : 'Cấp tất cả quyền & Tiếp tục'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => navigation.navigate('SetupComplete')}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Bỏ qua bước này</Text>
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
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 21,
  },
  permissionList: {
    flex: 1,
  },
  permissionListContent: {
    gap: 10,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#141928',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  permIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#1A2035',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  permInfo: {
    flex: 1,
  },
  permTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  permDesc: {
    fontSize: 12,
    color: '#8892A4',
    lineHeight: 18,
  },
  permDenied: {
    fontSize: 11,
    color: '#FF6B6B',
    marginTop: 4,
  },
  permRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 2,
  },
  // Info badge (wifi)
  infoBadge: {
    backgroundColor: '#1E3A5F',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  infoBadgeText: {
    fontSize: 11,
    color: '#5BA4F5',
    fontWeight: '600',
  },
  // Capability badge (IR)
  capabilityChecking: {
    fontSize: 11,
    color: '#8892A4',
    fontStyle: 'italic',
  },
  capabilityBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  capabilityOk: {
    backgroundColor: '#0D3028',
  },
  capabilityNo: {
    backgroundColor: '#252535',
  },
  capabilityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    gap: 10,
    paddingTop: 12,
    paddingBottom: 44,
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
    opacity: 0.75,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipText: {
    color: '#8892A4',
    fontSize: 14,
  },
});
