import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HomeStackParamList, RootStackParamList } from '../types/navigation';
import { usePro } from '../hooks/usePro';
import { FREE_DEVICE_LIMIT } from '../lib/purchases';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;

// ─── Types ──────────────────────────────────────────────────────────────────

type DeviceCategory = 'tv' | 'ac' | 'speaker' | 'soundbar' | 'projector' | 'set_top_box' | 'streaming_stick' | 'fan' | 'light' | 'other';

interface StoredDevice {
  id: string;
  nickname: string;
  brand: string;
  model: string;
  category: DeviceCategory;
  room: string;
  protocol: 'ir' | 'wifi' | 'ble';
  ip_address?: string;
  is_online: boolean;
  created_at: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = '@remote/user_devices';

const CATEGORY_META: Record<DeviceCategory, { label: string; icon: IoniconName; color: string }> = {
  tv:              { label: 'TV',           icon: 'tv-outline',              color: '#F5A623' },
  ac:              { label: 'Air Cond.',    icon: 'snow-outline',            color: '#00C9A7' },
  speaker:         { label: 'Speaker',     icon: 'volume-high-outline',     color: '#6C63FF' },
  soundbar:        { label: 'Soundbar',    icon: 'musical-notes-outline',   color: '#6C63FF' },
  projector:       { label: 'Projector',   icon: 'film-outline',            color: '#FF6B9D' },
  set_top_box:     { label: 'Set-Top Box', icon: 'cube-outline',            color: '#FFB347' },
  streaming_stick: { label: 'Streaming',   icon: 'play-circle-outline',     color: '#FF4F4F' },
  fan:             { label: 'Fan',         icon: 'refresh-circle-outline',  color: '#4FC3F7' },
  light:           { label: 'Smart Light', icon: 'bulb-outline',            color: '#FFEB3B' },
  other:           { label: 'Other',       icon: 'apps-outline',            color: '#8892A4' },
};

const PROTOCOL_META: Record<'ir' | 'wifi' | 'ble', { label: string; icon: IoniconName; description: string }> = {
  ir:   { label: 'Infrared',  icon: 'radio-outline',     description: 'Classic IR remote (TV, AC, …)' },
  wifi: { label: 'Wi-Fi',     icon: 'wifi-outline',      description: 'Smart device on local network' },
  ble:  { label: 'Bluetooth', icon: 'bluetooth-outline', description: 'BLE-enabled device' },
};

const POPULAR_BRANDS: Record<DeviceCategory, string[]> = {
  tv:              ['Samsung', 'LG', 'Sony', 'TCL', 'Hisense', 'Panasonic', 'Philips', 'Sharp', 'Other'],
  ac:              ['Daikin', 'Mitsubishi', 'LG', 'Samsung', 'Panasonic', 'Carrier', 'Trane', 'Gree', 'Other'],
  speaker:         ['Sonos', 'Bose', 'JBL', 'Harman Kardon', 'Sony', 'Bang & Olufsen', 'Other'],
  soundbar:        ['Samsung', 'LG', 'Sony', 'Bose', 'JBL', 'Sonos', 'Other'],
  projector:       ['Epson', 'BenQ', 'Optoma', 'Sony', 'LG', 'ViewSonic', 'Other'],
  set_top_box:     ['Apple TV', 'Android TV', 'NVIDIA Shield', 'Formuler', 'Mag', 'Other'],
  streaming_stick: ['Fire TV', 'Chromecast', 'Roku', 'Xiaomi Mi Stick', 'Other'],
  fan:             ['Dyson', 'Philips', 'Xiaomi', 'Panasonic', 'Other'],
  light:           ['Philips Hue', 'IKEA', 'Xiaomi', 'Yeelight', 'Govee', 'Other'],
  other:           ['Other'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function DeviceRow({ device, onPress }: { device: StoredDevice; onPress: () => void }) {
  const meta = CATEGORY_META[device.category];
  const isActive = device.is_online;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />
      <View style={[styles.cardIcon, { backgroundColor: meta.color + '22' }]}>
        <Ionicons name={meta.icon} size={22} color={meta.color} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{device.nickname || device.model}</Text>
        <Text style={styles.cardSub}>{device.room} · {device.brand}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: isActive ? meta.color + '22' : '#1E2535' }]}>
        <View style={[styles.statusDot, { backgroundColor: isActive ? meta.color : '#3A4257' }]} />
        <Text style={[styles.statusLabel, { color: isActive ? meta.color : '#4A5568' }]}>
          {isActive ? 'Online' : 'Offline'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={[styles.emptyIconWrap, { transform: [{ scale: pulse }] }]}>
        <Ionicons name="radio-outline" size={64} color="#3A4257" />
      </Animated.View>
      <Text style={styles.emptyTitle}>No devices yet</Text>
      <Text style={styles.emptySub}>Add your TV, air conditioner, or any IR / Wi-Fi device to get started.</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.8}>
        <Text style={styles.emptyBtnText}>+ Add First Device</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Device Wizard ────────────────────────────────────────────────────────

interface WizardState {
  step: 1 | 2 | 3;
  category: DeviceCategory | null;
  brand: string;
  model: string;
  nickname: string;
  room: string;
  protocol: 'ir' | 'wifi' | 'ble';
  ip_address: string;
}

const INITIAL_WIZARD: WizardState = {
  step: 1, category: null, brand: '', model: '',
  nickname: '', room: '', protocol: 'ir', ip_address: '',
};

function AddDeviceModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (device: StoredDevice) => void;
}) {
  const [w, setW] = useState<WizardState>(INITIAL_WIZARD);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setW(INITIAL_WIZARD);
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const goStep = (step: 1 | 2 | 3) => setW(prev => ({ ...prev, step }));

  const handleSave = () => {
    if (!w.category || !w.brand || !w.model.trim()) return;
    const device: StoredDevice = {
      id: uuid(),
      nickname: w.nickname.trim() || w.model.trim(),
      brand: w.brand,
      model: w.model.trim(),
      category: w.category,
      room: w.room.trim() || 'My Room',
      protocol: w.protocol,
      ip_address: w.ip_address.trim() || undefined,
      is_online: false,
      created_at: Math.floor(Date.now() / 1000),
    };
    onSave(device);
  };

  const slideStyle = {
    transform: [{
      translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }),
    }],
  };

  // ── Step 1: Choose category ────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.wizardBody}>
      <Text style={styles.wizardStepTitle}>What type of device?</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.categoryGrid}>
          {(Object.entries(CATEGORY_META) as [DeviceCategory, typeof CATEGORY_META[DeviceCategory]][]).map(([key, meta]) => (
            <TouchableOpacity
              key={key}
              style={[styles.categoryTile, w.category === key && { borderColor: meta.color, backgroundColor: meta.color + '18' }]}
              onPress={() => setW(prev => ({ ...prev, category: key }))}
              activeOpacity={0.7}
            >
              <Ionicons name={meta.icon} size={28} color={w.category === key ? meta.color : '#8892A4'} style={{ marginBottom: 6 }} />
              <Text style={[styles.categoryTileLabel, w.category === key && { color: meta.color }]}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <TouchableOpacity
        style={[styles.wizardPrimaryBtn, !w.category && styles.wizardBtnDisabled]}
        onPress={() => w.category && goStep(2)}
        activeOpacity={0.8}
      >
<Text style={styles.wizardPrimaryBtnText}>Next</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    </View>
  );

  // ── Step 2: Choose brand ───────────────────────────────────────────────────
  const renderStep2 = () => {
    const brands = w.category ? POPULAR_BRANDS[w.category] : [];
    return (
      <View style={styles.wizardBody}>
        <Text style={styles.wizardStepTitle}>Select brand</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {brands.map(brand => (
            <TouchableOpacity
              key={brand}
              style={[styles.brandRow, w.brand === brand && styles.brandRowSelected]}
              onPress={() => setW(prev => ({ ...prev, brand }))}
              activeOpacity={0.7}
            >
              <Text style={[styles.brandRowText, w.brand === brand && styles.brandRowTextSelected]}>
                {brand}
              </Text>
              {w.brand === brand && <Ionicons name="checkmark" size={18} color="#6C63FF" />}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.wizardFooterRow}>
          <TouchableOpacity style={styles.wizardSecondaryBtn} onPress={() => goStep(1)} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={16} color="#8892A4" style={{ marginRight: 4 }} />
            <Text style={styles.wizardSecondaryBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.wizardPrimaryBtn, { flex: 1 }, !w.brand && styles.wizardBtnDisabled]}
            onPress={() => w.brand && goStep(3)}
            activeOpacity={0.8}
          >
<Text style={styles.wizardPrimaryBtnText}>Next</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Step 3: Device details ─────────────────────────────────────────────────
  const renderStep3 = () => {
    const canSave = w.model.trim().length > 0;
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wizardBody}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.wizardStepTitle}>Device details</Text>

          <Text style={styles.fieldLabel}>Model / Name *</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="e.g. QLED QN85B, Emura III"
            placeholderTextColor="#3A4257"
            value={w.model}
            onChangeText={t => setW(p => ({ ...p, model: t }))}
          />

          <Text style={styles.fieldLabel}>Nickname (optional)</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="e.g. Living Room TV"
            placeholderTextColor="#3A4257"
            value={w.nickname}
            onChangeText={t => setW(p => ({ ...p, nickname: t }))}
          />

          <Text style={styles.fieldLabel}>Room</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="e.g. Living Room, Bedroom"
            placeholderTextColor="#3A4257"
            value={w.room}
            onChangeText={t => setW(p => ({ ...p, room: t }))}
          />

          <Text style={styles.fieldLabel}>Connection protocol</Text>
          <View style={styles.protocolRow}>
            {(Object.entries(PROTOCOL_META) as ['ir' | 'wifi' | 'ble', typeof PROTOCOL_META['ir']][]).map(([key, meta]) => (
              <TouchableOpacity
                key={key}
                style={[styles.protocolChip, w.protocol === key && styles.protocolChipSelected]}
                onPress={() => setW(p => ({ ...p, protocol: key }))}
                activeOpacity={0.7}
              >
                <Ionicons name={meta.icon} size={16} color={w.protocol === key ? '#6C63FF' : '#8892A4'} />
                <Text style={[styles.protocolChipLabel, w.protocol === key && { color: '#6C63FF' }]}>
                  {meta.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {w.protocol === 'wifi' && (
            <>
              <Text style={styles.fieldLabel}>IP Address (optional)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. 192.168.1.42"
                placeholderTextColor="#3A4257"
                value={w.ip_address}
                onChangeText={t => setW(p => ({ ...p, ip_address: t }))}
                keyboardType="numeric"
              />
            </>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={styles.wizardFooterRow}>
          <TouchableOpacity style={styles.wizardSecondaryBtn} onPress={() => goStep(2)} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={16} color="#8892A4" style={{ marginRight: 4 }} />
          <Text style={styles.wizardSecondaryBtnText}>Back</Text>
        </TouchableOpacity>
          <TouchableOpacity
            style={[styles.wizardPrimaryBtn, { flex: 1 }, !canSave && styles.wizardBtnDisabled]}
            onPress={canSave ? handleSave : undefined}
            activeOpacity={0.8}
          >
            <Ionicons name="save-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.wizardPrimaryBtnText}>Save Device</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.modalSheet, slideStyle, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Device</Text>
          <View style={styles.stepIndicator}>
            {([1, 2, 3] as (1 | 2 | 3)[]).map(n => (
              <View key={n} style={[styles.stepDot, w.step >= n && styles.stepDotActive]} />
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Ionicons name="close" size={18} color="#8892A4" />
          </TouchableOpacity>
        </View>

        {/* Step content */}
        {w.step === 1 && renderStep1()}
        {w.step === 2 && renderStep2()}
        {w.step === 3 && renderStep3()}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export function HomeScreen(): React.ReactElement {
  const navigation = useNavigation<HomeNav>();
  const rootNavigation = useNavigation<RootNav>();
  const { isPro } = usePro();
  const [devices, setDevices] = useState<StoredDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [addVisible, setAddVisible] = useState(false);

  // Load devices from storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try { setDevices(JSON.parse(raw) as StoredDevice[]); } catch { /* ignore */ }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const saveDevices = useCallback(async (updated: StoredDevice[]) => {
    setDevices(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const openAddDeviceModal = useCallback(() => {
    if (!isPro && devices.length >= FREE_DEVICE_LIMIT) {
      rootNavigation.navigate('Paywall', { trigger: 'device_limit' });
      return;
    }
    setAddVisible(true);
  }, [isPro, devices.length, rootNavigation]);

  const handleAddDevice = useCallback((device: StoredDevice) => {
    setAddVisible(false);
    saveDevices([...devices, device]);
  }, [devices, saveDevices]);

  const handleDevicePress = useCallback((device: StoredDevice) => {
    if (device.category === 'tv') {
      navigation.navigate('TVRemote', { deviceId: device.id, deviceName: device.nickname, location: device.room });
    } else if (device.category === 'ac') {
      navigation.navigate('ACControl', { deviceId: device.id, deviceName: device.nickname, location: device.room });
    }
  }, [navigation]);

  const activeCount = devices.filter(d => d.is_online).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
          <Text style={styles.subGreeting}>
            {devices.length === 0
              ? 'No devices added yet'
              : `${activeCount} of ${devices.length} device${devices.length > 1 ? 's' : ''} online`}
          </Text>
        </View>
        <TouchableOpacity style={styles.bellBtn}>
          <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#6C63FF" size="large" />
        </View>
      ) : devices.length === 0 ? (
        <EmptyState onAdd={openAddDeviceModal} />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <DeviceRow device={item} onPress={() => handleDevicePress(item)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB — only shown when there are already devices */}
      {devices.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={openAddDeviceModal} activeOpacity={0.85}>
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Add Device Modal */}
      <AddDeviceModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSave={handleAddDevice}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subGreeting: {
    fontSize: 13,
    color: '#8892A4',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141928',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 10,
  },
  // Device card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 14,
    paddingRight: 14,
    gap: 12,
  },
  cardAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  cardSub: {
    fontSize: 12,
    color: '#8892A4',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 14,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    height: '82%',
    backgroundColor: '#0D1220',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2535',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A3147',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A3147',
  },
  stepDotActive: {
    backgroundColor: '#6C63FF',
  },
  modalCloseBtn: {
    position: 'absolute',
    right: 20,
    top: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E2535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#8892A4',
    fontSize: 12,
    fontWeight: '700',
  },
  // Wizard steps
  wizardBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  wizardStepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 16,
  },
  categoryTile: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#141928',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E2535',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8892A4',
    textAlign: 'center',
  },
  // Brand list
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#141928',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  brandRowSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#6C63FF18',
  },
  brandRowText: {
    fontSize: 15,
    color: '#8892A4',
    fontWeight: '500',
  },
  brandRowTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Form fields
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8892A4',
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldInput: {
    backgroundColor: '#141928',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2535',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  // Protocol chips
  protocolRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  protocolChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#141928',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1E2535',
  },
  protocolChipSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#6C63FF18',
  },
  protocolChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8892A4',
  },
  // Wizard buttons
  wizardFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  wizardPrimaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizardPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  wizardSecondaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#141928',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  wizardSecondaryBtnText: {
    color: '#8892A4',
    fontSize: 15,
    fontWeight: '600',
  },
  wizardBtnDisabled: {
    opacity: 0.35,
  },
});
