import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAllBrands, useModelsByBrand, useSearchModels } from '../hooks/useCatalog';
import type { CatalogModel } from '../hooks/useCatalog';
import { ProtocolPicker } from './ProtocolPicker';
import type { ConnectionProtocol, DeviceCategory } from '../types/navigation';
import { BLEModule, IRModule } from '@remote/native-modules';
import { fetchIRCodesets, resolveIRCommand } from '../lib/irApi';
import type { IRCodeset } from '../lib/irApi';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORIES: { id: DeviceCategory; label: string; icon: IoniconName }[] = [
  { id: 'tv', label: 'TV', icon: 'tv-outline' },
  { id: 'ac', label: 'AC', icon: 'snow-outline' },
  { id: 'speaker', label: 'Speaker', icon: 'volume-high-outline' },
  { id: 'light', label: 'Light', icon: 'bulb-outline' },
];

const PROTOCOL_LABELS: Record<ConnectionProtocol, string> = {
  wifi: 'Wi-Fi', ble: 'Bluetooth', ir: 'IR', homekit: 'HomeKit', matter: 'Matter',
};

interface AddressConfig {
  label: string;
  placeholder: string;
  hint: string;
  icon: IoniconName;
  keyboardType: 'default' | 'numbers-and-punctuation' | 'decimal-pad';
}

const ADDRESS_CONFIG: Partial<Record<ConnectionProtocol, AddressConfig>> = {
  wifi: {
    label: 'Device IP Address',
    placeholder: '192.168.1.xxx',
    hint: 'Find this in your router admin panel or in the device\'s Wi-Fi settings.',
    icon: 'wifi',
    keyboardType: 'numbers-and-punctuation',
  },
  ble: {
    label: 'Bluetooth Device Name',
    placeholder: 'e.g. Samsung TV [BD4F]',
    hint: 'Open your phone\'s Bluetooth settings to find the exact device name nearby.',
    icon: 'bluetooth',
    keyboardType: 'default',
  },
  homekit: {
    label: 'HomeKit Pairing Code',
    placeholder: 'XXX-XX-XXX',
    hint: 'Found on the device label or packaging. Then open the Home app and add the accessory.',
    icon: 'home-outline',
    keyboardType: 'numbers-and-punctuation',
  },
  matter: {
    label: 'Matter Setup Code',
    placeholder: 'Numeric setup code…',
    hint: 'Scan the QR code on the device or enter the numeric code from the device label.',
    icon: 'globe-outline',
    keyboardType: 'default',
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AddDeviceResult {
  brand: string;
  model: string;
  category?: DeviceCategory;
  protocol: ConnectionProtocol;
  modelId?: string;
  /** Catalog brand slug (e.g. 'samsung'). Used by IR code resolver. */
  brandSlug?: string;
  address?: string;
  /** Pre-selected IR codeset ID (from the IR setup flow). */
  codesetId?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: AddDeviceResult) => void;
  /** Pre-select a protocol when the sheet opens (e.g. 'ir' when opened from USB banner). */
  defaultProtocol?: ConnectionProtocol;
}

type Step = 'search' | 'models' | 'protocol' | 'ble_scan' | 'address' | 'ir_setup' | 'connecting';
type ConnectPhase = 'connecting' | 'failed';
type IRSetupPhase = 'loading' | 'testing' | 'confirmed' | 'not_found' | 'no_blaster';
type BLEScanStatus = 'idle' | 'scanning' | 'done' | 'unavailable';

interface BLEDeviceItem {
  id: string;
  name: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddDeviceSheet({ visible, onClose, onSelect, defaultProtocol }: Props): React.ReactElement | null {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const abortRef = useRef<AbortController | null>(null);
  const pendingResultRef = useRef<AddDeviceResult | null>(null);

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedBrandSlug, setSelectedBrandSlug] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<ConnectionProtocol>('wifi');
  const [selectedModelProtocols, setSelectedModelProtocols] = useState<ConnectionProtocol[]>([]);
  const [address, setAddress] = useState('');
  const [connectPhase, setConnectPhase] = useState<ConnectPhase>('connecting');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [bleDevices, setBleDevices] = useState<BLEDeviceItem[]>([]);
  const [bleScanStatus, setBleScanStatus] = useState<BLEScanStatus>('idle');
  const bleScanAbortRef = useRef<{ stop: () => void } | null>(null);

  // ── IR Setup state ────────────────────────────────────────────────────────
  const [irSetupPhase, setIRSetupPhase] = useState<IRSetupPhase>('loading');
  const [irCodesets, setIRCodesets] = useState<IRCodeset[]>([]);
  const [irCodesetIndex, setIRCodesetIndex] = useState(0);
  const [irTestPayload, setIRTestPayload] = useState<string | null>(null);
  const [irTestCommand, setIRTestCommand] = useState<string>('POWER');
  const irSelectedCodesetId = useRef<string | null>(null);
  const irTransmittingRef = useRef(false);

  const { data: brands, isLoading: brandsLoading } = useAllBrands();
  const { data: models, isLoading: modelsLoading } = useModelsByBrand(selectedBrandSlug);
  const isSearching = searchQuery.trim().length >= 2;
  const { data: searchedModels, isLoading: searchModelsLoading } = useSearchModels(searchQuery);

  useEffect(() => {
    if (visible) {
      resetState();
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      abortRef.current?.abort();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  const resetState = () => {
    setStep('search');
    setSearchQuery('');
    setModelSearchQuery('');
    setSelectedCategory(null);
    setSelectedBrand('');
    setSelectedBrandSlug(null);
    setSelectedModel('');
    setSelectedModelId(null);
    setSelectedProtocol(defaultProtocol ?? 'wifi');
    setSelectedModelProtocols([]);
    setAddress('');
    setConnectPhase('connecting');
    setConnectError(null);
    setBleDevices([]);
    setBleScanStatus('idle');
    bleScanAbortRef.current?.stop();
    bleScanAbortRef.current = null;
    abortRef.current?.abort();
    pendingResultRef.current = null;
    setIRSetupPhase('loading');
    setIRCodesets([]);
    setIRCodesetIndex(0);
    setIRTestPayload(null);
    setIRTestCommand('POWER');
    irSelectedCodesetId.current = null;
  };  // ─── BLE Scan ────────────────────────────────────────────────────────────

  const startBleScan = async () => {
    setBleDevices([]);
    setBleScanStatus('scanning');

    const available = await BLEModule.isAvailable();
    if (!available) {
      setBleScanStatus('unavailable');
      return;
    }

    let stopped = false;
    bleScanAbortRef.current = { stop: () => { stopped = true; } };

    setBleDevices([]);
    BLEModule.scanForDevicesWithInfo(7000, (device) => {
      if (stopped) return;
      setBleDevices(prev =>
        prev.some(d => d.id === device.id) ? prev : [...prev, device]
      );
    }).then(() => {
      if (!stopped) setBleScanStatus('done');
    });
  };

  const handleBleDeviceSelect = (device: BLEDeviceItem) => {
    bleScanAbortRef.current?.stop();
    setAddress(device.id);
    const result: AddDeviceResult = {
      brand: selectedBrand,
      model: selectedModel,
      category: selectedCategory ?? 'tv',
      protocol: 'ble',
      modelId: selectedModelId ?? undefined,
      address: device.id,
    };
    setStep('connecting');
    runConnectionAttempt(result);
  };

  // ─── Navigation helpers ─────────────────────────────────────────────────

  const handleBack = () => {
    switch (step) {
      case 'models':    setStep('search');    break;
      case 'protocol':  setStep('models');    break;
      case 'ble_scan':  setStep('protocol');  bleScanAbortRef.current?.stop(); setBleScanStatus('idle'); break;
      case 'address':   setStep('protocol');  break;
      // connecting + failed: handled by in-page buttons
    }
  };

  // ─── Step handlers ──────────────────────────────────────────────────────

  const handleBrandSelect = (name: string, slug: string | null) => {
    setSelectedBrand(name);
    setSelectedBrandSlug(slug);
    setStep('models');
  };

  const handleModelSelect = (model: CatalogModel) => {
    setSelectedModel(model.model_number);
    setSelectedModelId(model.id);
    const protocols = (model.protocols ?? []) as ConnectionProtocol[];
    setSelectedModelProtocols(protocols);
    if (protocols.length && !defaultProtocol) {
      setSelectedProtocol(protocols[0]);
    }
    if (model.category) {
      setSelectedCategory(model.category as DeviceCategory);
    }
    setStep('protocol');
  };

  /** Select a model from cross-brand search — pre-fills brand from the loaded brands list. */
  const handleSearchModelSelect = (model: CatalogModel) => {
    const brand = brands?.find(b => b.slug === model.brand_id);
    setSelectedBrand(brand?.name ?? model.brand_id);
    setSelectedBrandSlug(model.brand_id);
    setSelectedModel(model.model_number);
    setSelectedModelId(model.id);
    const protocols = (model.protocols ?? []) as ConnectionProtocol[];
    setSelectedModelProtocols(protocols);
    if (protocols.length && !defaultProtocol) {
      setSelectedProtocol(protocols[0]);
    }
    if (model.category) {
      setSelectedCategory(model.category as DeviceCategory);
    }
    setStep('protocol');
  };

  // ── IR Setup logic ────────────────────────────────────────────────────────

  const startIRSetup = async () => {
    setIRSetupPhase('loading');
    setIRCodesets([]);
    setIRCodesetIndex(0);
    setIRTestPayload(null);
    setIRTestCommand('POWER');
    irSelectedCodesetId.current = null;

    // Check IR blaster availability
    const available = await IRModule.isAvailable();
    if (!available) {
      setIRSetupPhase('no_blaster');
      return;
    }

    try {
      const codesets = await fetchIRCodesets(
        selectedBrandSlug ?? selectedBrand.toLowerCase(),
        selectedCategory ?? 'tv',
        selectedModel || undefined,
      );
      setIRCodesets(codesets);
      if (codesets.length > 0) {
        await loadTestPayload(codesets, 0);
      } else {
        setIRSetupPhase('not_found');
      }
    } catch {
      setIRSetupPhase('not_found');
    }
  };

  const loadTestPayload = async (codesets: IRCodeset[], index: number) => {
    setIRCodesetIndex(index);
    const codeset = codesets[index];
    if (!codeset) {
      setIRSetupPhase('not_found');
      return;
    }
    // Try commands in priority order: POWER first, then AC-specific fallbacks
    const testCommands = ['POWER', 'POWER_OFF', 'POWER_ON', 'COOL', 'HEAT', 'OFF', 'ON'];
    const brand = selectedBrandSlug ?? selectedBrand.toLowerCase();
    const category = selectedCategory ?? 'tv';
    const model = selectedModel || undefined;
    try {
      let resolved: Awaited<ReturnType<typeof resolveIRCommand>> | null = null;
      let usedCommand = 'POWER';
      for (const cmd of testCommands) {
        const r = await resolveIRCommand({ brand, category, model, command: cmd, codesetId: codeset.id });
        if (r.payload) { resolved = r; usedCommand = cmd; break; }
      }
      if (!resolved?.payload) {
        // No usable command in this codeset — try next
        if (index + 1 < codesets.length) {
          await loadTestPayload(codesets, index + 1);
        } else {
          setIRSetupPhase('not_found');
        }
        return;
      }
      setIRTestPayload(resolved.payload);
      setIRTestCommand(usedCommand);
      irSelectedCodesetId.current = codeset.id;
      setIRSetupPhase('testing');
    } catch {
      // Try next codeset
      if (index + 1 < codesets.length) {
        await loadTestPayload(codesets, index + 1);
      } else {
        setIRSetupPhase('not_found');
      }
    }
  };

  const handleIRTest = async () => {
    if (!irTestPayload || irTransmittingRef.current) return;
    irTransmittingRef.current = true;
    try {
      await IRModule.transmit('', irTestPayload);
    } catch {
      // Transmit error is non-fatal — let user still confirm/deny
    } finally {
      irTransmittingRef.current = false;
    }
  };

  const handleIRConfirm = () => {
    // User confirmed this codeset works
    const result: AddDeviceResult = {
      brand: selectedBrand,
      model: selectedModel,
      category: selectedCategory ?? undefined,
      protocol: 'ir',
      modelId: selectedModelId ?? undefined,
      brandSlug: selectedBrandSlug ?? undefined,
      address: '',
      codesetId: irSelectedCodesetId.current ?? undefined,
    };
    onSelect(result);
    onClose();
  };

  const handleIRNextCodeset = async () => {
    const nextIndex = irCodesetIndex + 1;
    if (nextIndex < irCodesets.length) {
      setIRSetupPhase('loading');
      await loadTestPayload(irCodesets, nextIndex);
    } else {
      setIRSetupPhase('not_found');
    }
  };

  const handleIRSkip = () => {
    // Add device without a confirmed codeset — codes will be fetched per-command
    const result: AddDeviceResult = {
      brand: selectedBrand,
      model: selectedModel,
      category: selectedCategory ?? 'tv',
      protocol: 'ir',
      modelId: selectedModelId ?? undefined,
      brandSlug: selectedBrandSlug ?? undefined,
      address: '',
    };
    onSelect(result);
    onClose();
  };

  /** Called from Protocol step — IR goes to ir_setup, BLE goes to scan */
  const handleProtocolNext = () => {
    if (selectedProtocol === 'ir') {
      setStep('ir_setup');
      void startIRSetup();
    } else if (selectedProtocol === 'ble') {
      setStep('ble_scan');
      startBleScan();
    } else {
      setStep('address');
    }
  };

  /** Called from Address step */
  const handleAddressNext = () => {
    const result: AddDeviceResult = {
      brand: selectedBrand,
      model: selectedModel,
      category: selectedCategory ?? 'tv',
      protocol: selectedProtocol,
      modelId: selectedModelId ?? undefined,
      address: address.trim(),
    };
    setStep('connecting');
    runConnectionAttempt(result);
  };

  // ─── Connection logic ───────────────────────────────────────────────────

  const runConnectionAttempt = async (result: AddDeviceResult) => {
    abortRef.current?.abort();
    setConnectPhase('connecting');
    setConnectError(null);
    pendingResultRef.current = result;

    const succeed = () => { onSelect(result); onClose(); };
    const fail = (msg: string) => { setConnectPhase('failed'); setConnectError(msg); };

    try {
      if (result.protocol === 'ir') {
        // IR blaster — just verify hub is reachable (simulated, ~1 s)
        await sleep(1200);
        succeed();
        return;
      }

      if (result.protocol === 'wifi') {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const addr = result.address ?? '';
        const url = addr.startsWith('http') ? addr : `http://${addr}`;
        const timeoutId = setTimeout(() => ctrl.abort(), 8000);
        try {
          await fetch(url, { signal: ctrl.signal, method: 'HEAD' });
          clearTimeout(timeoutId);
        } catch (e: any) {
          clearTimeout(timeoutId);
          if (e.name === 'AbortError') {
            fail('Connection timed out. Check the IP address and make sure the device is on the same Wi-Fi network.');
            return;
          }
          // Non-abort error (CORS, network error response) means device replied — treat as reachable
        }
        succeed();
        return;
      }

      // BLE / HomeKit / Matter — pairing handshake (simulated)
      await sleep(result.protocol === 'ble' ? 5000 : 3000);
      succeed();
    } catch {
      fail('Unexpected error. Please try again.');
    }
  };

  const handleRetryConnect = () => {
    if (pendingResultRef.current) {
      runConnectionAttempt(pendingResultRef.current);
    }
  };

  const handleAddAnyway = () => {
    if (pendingResultRef.current) {
      onSelect(pendingResultRef.current);
      onClose();
    }
  };

  // ─── Filter helpers ─────────────────────────────────────────────────────

  if (!visible) return null;

  const filteredBrands = brands?.filter(b => {
    if (!searchQuery) return true;
    return b.name.toLowerCase().includes(searchQuery.toLowerCase());
  }) ?? [];

  const filteredModels = models?.filter(m => {
    if (!modelSearchQuery) return true;
    const q = modelSearchQuery.toLowerCase();
    return m.model_number.toLowerCase().includes(q) || (m.model_name?.toLowerCase().includes(q) ?? false);
  }) ?? [];

  const addrCfg = ADDRESS_CONFIG[selectedProtocol];
  const addressIsValid = address.trim().length > 0;

  const canGoBack = step !== 'search' && step !== 'connecting' && step !== 'ir_setup';

  const headerTitle: Record<Step, string> = {
    search:     'Add Device',
    models:     `${selectedBrand} · ${selectedCategory?.toUpperCase() ?? 'TV'}`,
    protocol:   `${selectedBrand} ${selectedModel}`,
    ble_scan:   'Nearby Bluetooth Devices',
    address:    `${PROTOCOL_LABELS[selectedProtocol]} Setup`,
    ir_setup:   'Find Your Remote Code',
    connecting: connectPhase === 'failed' ? 'Connection Failed' : 'Connecting…',
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }) }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrapper}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            {canGoBack && (
              <TouchableOpacity
                onPress={handleBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>{headerTitle[step]}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#8892A4" />
            </TouchableOpacity>
          </View>

          {/* ── Step: Search + Browse ─────────────────────────────────── */}
          {step === 'search' && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#4A5568" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search brand or model..."
                  placeholderTextColor="#4A5568"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color="#4A5568" />
                  </TouchableOpacity>
                )}
              </View>

              {!isSearching ? (
                /* ── Popular brands (no query) ── */
                <>
                  <Text style={styles.sectionTitle}>POPULAR BRANDS</Text>
                  {brandsLoading ? (
                    <ActivityIndicator color="#6C63FF" style={{ marginTop: 20 }} />
                  ) : (
                    filteredBrands.slice(0, 15).map(brand => (
                      <TouchableOpacity
                        key={brand.id}
                        style={styles.brandRow}
                        onPress={() => handleBrandSelect(brand.name, brand.slug)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.brandAvatar}>
                          <Text style={styles.brandAvatarText}>{brand.name.charAt(0)}</Text>
                        </View>
                        <Text style={styles.brandName}>{brand.name}</Text>
                        <Ionicons name="chevron-forward" size={16} color="#3A4257" />
                      </TouchableOpacity>
                    ))
                  )}
                </>
              ) : (
                /* ── Unified search results (brands + models) ── */
                <>
                  {/* Brand matches */}
                  {filteredBrands.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>BRANDS</Text>
                      {filteredBrands.slice(0, 5).map(brand => (
                        <TouchableOpacity
                          key={brand.id}
                          style={styles.brandRow}
                          onPress={() => handleBrandSelect(brand.name, brand.slug)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.brandAvatar}>
                            <Text style={styles.brandAvatarText}>{brand.name.charAt(0)}</Text>
                          </View>
                          <Text style={styles.brandName}>{brand.name}</Text>
                          <Ionicons name="chevron-forward" size={16} color="#3A4257" />
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Model matches */}
                  <Text style={[styles.sectionTitle, { marginTop: filteredBrands.length > 0 ? 16 : 0 }]}>MODELS</Text>
                  {searchModelsLoading ? (
                    <ActivityIndicator color="#6C63FF" style={{ marginTop: 12 }} />
                  ) : searchedModels && searchedModels.length > 0 ? (
                    searchedModels.map(model => {
                      const brandName = brands?.find(b => b.slug === model.brand_id)?.name ?? model.brand_id;
                      return (
                        <TouchableOpacity
                          key={model.id}
                          style={styles.modelRow}
                          onPress={() => handleSearchModelSelect(model)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.brandAvatar}>
                            <Text style={styles.brandAvatarText}>{brandName.charAt(0)}</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.modelNumber}>{model.model_number}</Text>
                            <Text style={styles.modelName}>
                              {brandName}{model.model_name ? ` · ${model.model_name}` : ''}{model.category ? ` · ${model.category.toUpperCase()}` : ''}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color="#3A4257" />
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyText}>No models found for "{searchQuery}"</Text>
                  )}

                  {!brandsLoading && !searchModelsLoading && filteredBrands.length === 0 && (!searchedModels || searchedModels.length === 0) && (
                    <Text style={styles.emptyText}>No results for "{searchQuery}"</Text>
                  )}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {/* ── Step: Models ──────────────────────────────────────────── */}
          {step === 'models' && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modelCount}>
                {modelsLoading ? 'Loading models...' : `${filteredModels.length} models`}
              </Text>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#4A5568" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search model..."
                  placeholderTextColor="#4A5568"
                  value={modelSearchQuery}
                  onChangeText={setModelSearchQuery}
                  returnKeyType="search"
                  autoCorrect={false}
                />
              </View>

              {modelsLoading ? (
                <ActivityIndicator color="#6C63FF" style={{ marginTop: 20 }} />
              ) : (
                filteredModels.map((model, idx) => (
                  <TouchableOpacity
                    key={model.id}
                    style={styles.modelRow}
                    onPress={() => handleModelSelect(model)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modelNumber}>{model.model_number}</Text>
                      {model.model_name && (
                        <Text style={styles.modelName}>{model.model_name}</Text>
                      )}
                    </View>
                    {idx === 0 && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularText}>Popular</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color="#3A4257" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {/* ── Step: Protocol ────────────────────────────────────────── */}
          {step === 'protocol' && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <ProtocolPicker
                selected={selectedProtocol}
                recommended={selectedModelProtocols[0] ?? 'wifi'}
                onSelect={setSelectedProtocol}
                deviceProtocols={selectedModelProtocols.length > 0 ? selectedModelProtocols : undefined}
              />

              <TouchableOpacity style={styles.connectBtn} onPress={handleProtocolNext} activeOpacity={0.8}>
                <Text style={styles.connectBtnText}>
                  {selectedProtocol === 'ir'
                    ? 'Connect via IR →'
                    : `Set Up via ${PROTOCOL_LABELS[selectedProtocol]} →`}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {/* ── Step: BLE Scan ───────────────────────────────────────── */}
          {step === 'ble_scan' && (
            <View style={styles.bleScanWrap}>
              {/* Status bar */}
              <View style={styles.bleScanHeader}>
                {bleScanStatus === 'scanning' ? (
                  <View style={styles.bleScanStatusRow}>
                    <ActivityIndicator size="small" color="#6C63FF" style={{ marginRight: 8 }} />
                    <Text style={styles.bleScanStatusText}>Scanning for devices…</Text>
                  </View>
                ) : bleScanStatus === 'unavailable' ? (
                  <View style={styles.bleScanStatusRow}>
                    <Ionicons name="bluetooth" size={16} color="#FF6B6B" style={{ marginRight: 6 }} />
                    <Text style={[styles.bleScanStatusText, { color: '#FF6B6B' }]}>Bluetooth is off. Enable it in Settings.</Text>
                  </View>
                ) : (
                  <View style={styles.bleScanStatusRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#00C9A7" style={{ marginRight: 6 }} />
                    <Text style={[styles.bleScanStatusText, { color: '#00C9A7' }]}>
                      {bleDevices.length > 0 ? `${bleDevices.length} device${bleDevices.length !== 1 ? 's' : ''} found` : 'No devices found'}
                    </Text>
                    <TouchableOpacity
                      style={styles.bleScanRescanBtn}
                      onPress={startBleScan}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="refresh" size={14} color="#8892A4" />
                      <Text style={styles.bleScanRescanText}>Rescan</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Device list */}
              <ScrollView style={styles.bleScanList} showsVerticalScrollIndicator={false}>
                {bleDevices.length === 0 && bleScanStatus !== 'scanning' && (
                  <View style={styles.bleEmptyWrap}>
                    <Ionicons name="bluetooth" size={48} color="#1E2535" />
                    <Text style={styles.bleEmptyTitle}>No devices found</Text>
                    <Text style={styles.bleEmptySubtitle}>
                      Make sure the device is in pairing mode and within 10 m.
                    </Text>
                    <TouchableOpacity style={styles.bleScanRescanBtnLg} onPress={startBleScan} activeOpacity={0.8}>
                      <Ionicons name="refresh" size={16} color="#6C63FF" style={{ marginRight: 6 }} />
                      <Text style={styles.bleScanRescanTextLg}>Scan again</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {bleDevices.map(device => (
                  <TouchableOpacity
                    key={device.id}
                    style={styles.bleDeviceRow}
                    onPress={() => handleBleDeviceSelect(device)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.bleDeviceIcon}>
                      <Ionicons name="bluetooth" size={18} color="#6C63FF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bleDeviceName}>{device.name}</Text>
                      <Text style={styles.bleDeviceId} numberOfLines={1}>{device.id}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#3A4257" />
                  </TouchableOpacity>
                ))}
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          )}

          {/* ── Step: Address ─────────────────────────────────────────── */}
          {step === 'address' && addrCfg && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionTitle}>CONNECT VIA {selectedProtocol.toUpperCase()}</Text>

              <Text style={styles.fieldLabel}>{addrCfg.label}</Text>
              <View style={styles.searchBar}>
                <Ionicons name={addrCfg.icon} size={18} color="#4A5568" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={addrCfg.placeholder}
                  placeholderTextColor="#4A5568"
                  value={address}
                  onChangeText={setAddress}
                  keyboardType={addrCfg.keyboardType}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                />
                {address.length > 0 && (
                  <TouchableOpacity onPress={() => setAddress('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color="#4A5568" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.hintBox}>
                <Ionicons name="information-circle-outline" size={16} color="#4A5568" />
                <Text style={styles.hintText}>{addrCfg.hint}</Text>
              </View>

              <TouchableOpacity
                style={[styles.connectBtn, !addressIsValid && styles.connectBtnDisabled]}
                onPress={handleAddressNext}
                disabled={!addressIsValid}
                activeOpacity={0.8}
              >
                <Text style={styles.connectBtnText}>Connect →</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {/* ── Step: IR Setup ─────────────────────────────────────────── */}
          {step === 'ir_setup' && (
            <View style={styles.connectingWrap}>
              {irSetupPhase === 'loading' && (
                <>
                  <ActivityIndicator size="large" color="#FFB347" style={{ marginBottom: 24 }} />
                  <Text style={styles.connectingTitle}>Finding IR codes…</Text>
                  <Text style={styles.connectingSubtitle}>
                    Searching the IR database for {selectedBrand} {selectedModel}
                  </Text>
                </>
              )}

              {irSetupPhase === 'testing' && (
                <>
                  <View style={[styles.errorIconWrap, { backgroundColor: '#FFB34722' }]}>
                    <Ionicons name="radio-outline" size={44} color="#FFB347" />
                  </View>
                  <Text style={styles.connectingTitle}>Test Your Remote</Text>
                  <Text style={styles.connectingSubtitle}>
                    Point your phone at the {selectedBrand} device and tap the button below.{'\n'}
                    Code {irCodesetIndex + 1} of {irCodesets.length}
                  </Text>

                  <TouchableOpacity
                    style={[styles.connectBtn, { backgroundColor: '#FFB347', marginTop: 24, width: '80%' }]}
                    onPress={() => void handleIRTest()}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.connectBtnText, { color: '#0A0E1A' }]}>⚡ Send {irTestCommand}</Text>
                  </TouchableOpacity>

                  <Text style={[styles.connectingSubtitle, { marginTop: 24, marginBottom: 8 }]}>
                    Did the device turn on or off?
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      style={[styles.retryBtn, { backgroundColor: '#00C9A7', flex: 1 }]}
                      onPress={handleIRConfirm}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark" size={18} color="#0A0E1A" style={{ marginRight: 6 }} />
                      <Text style={styles.retryBtnText}>Yes, it worked!</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.retryBtn, { backgroundColor: '#2A3147', flex: 1 }]}
                      onPress={() => void handleIRNextCodeset()}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={[styles.retryBtnText, { color: '#FFFFFF' }]}>Try Next</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.cancelLink} onPress={handleIRSkip}>
                    <Text style={styles.cancelLinkText}>Skip — I'll test later</Text>
                  </TouchableOpacity>
                </>
              )}

              {irSetupPhase === 'not_found' && (
                <>
                  <View style={styles.errorIconWrap}>
                    <Ionicons name="help-circle" size={52} color="#FFB347" />
                  </View>
                  <Text style={styles.errorTitle}>No codes found</Text>
                  <Text style={styles.errorMessage}>
                    We couldn't find IR codes for {selectedBrand} {selectedModel} in our database.
                    You can still add the device and try Learn Mode.
                  </Text>
                  <TouchableOpacity style={styles.addAnywayBtn} onPress={handleIRSkip} activeOpacity={0.8}>
                    <Text style={styles.addAnywayBtnText}>Add Anyway</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
                    <Text style={styles.cancelLinkText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}

              {irSetupPhase === 'no_blaster' && (
                <>
                  <View style={styles.errorIconWrap}>
                    <Ionicons name="alert-circle" size={52} color="#FF6B6B" />
                  </View>
                  <Text style={styles.errorTitle}>No IR Blaster Found</Text>
                  <Text style={styles.errorMessage}>
                    This device doesn't have a built-in IR emitter. Connect a Wi-Fi IR hub
                    (e.g. Broadlink RM4) to control devices via IR.
                  </Text>
                  <TouchableOpacity style={styles.addAnywayBtn} onPress={handleIRSkip} activeOpacity={0.8}>
                    <Text style={styles.addAnywayBtnText}>Add Anyway (Hub)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
                    <Text style={styles.cancelLinkText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* ── Step: Connecting ──────────────────────────────────────── */}
          {step === 'connecting' && (
            <View style={styles.connectingWrap}>
              {connectPhase === 'connecting' && (
                <>
                  <ActivityIndicator size="large" color="#4FC3F7" style={{ marginBottom: 24 }} />
                  <Text style={styles.connectingTitle}>Connecting…</Text>
                  <Text style={styles.connectingSubtitle}>
                    {selectedProtocol === 'ir'
                      ? 'Checking IR blaster connection…'
                      : selectedProtocol === 'ble'
                      ? `Pairing with ${pendingResultRef.current?.address ?? 'device'}…`
                      : selectedProtocol === 'homekit'
                      ? 'Pairing with HomeKit…'
                      : selectedProtocol === 'matter'
                      ? 'Commissioning Matter device…'
                      : `Reaching ${pendingResultRef.current?.address ?? address}…`}
                  </Text>
                </>
              )}

              {connectPhase === 'failed' && (
                <>
                  <View style={styles.errorIconWrap}>
                    <Ionicons name="alert-circle" size={52} color="#FF6B6B" />
                  </View>
                  <Text style={styles.errorTitle}>Connection Failed</Text>
                  <Text style={styles.errorMessage}>{connectError}</Text>

                  <TouchableOpacity style={styles.retryBtn} onPress={handleRetryConnect} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={18} color="#0A0E1A" style={{ marginRight: 8 }} />
                    <Text style={styles.retryBtnText}>Try Again</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.addAnywayBtn} onPress={handleAddAnyway} activeOpacity={0.8}>
                    <Text style={styles.addAnywayBtnText}>Add Anyway (offline / IR)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
                    <Text style={styles.cancelLinkText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: '#0D1220',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A3147',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2535',
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1E2535',
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: '#FFFFFF',
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A5568',
    letterSpacing: 1,
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  categoryTile: {
    width: '47%',
    backgroundColor: '#141928',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2535',
    gap: 6,
  },
  categoryTileActive: {
    borderColor: '#4FC3F7',
    backgroundColor: '#4FC3F710',
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8892A4',
  },
  categoryLabelActive: {
    color: '#4FC3F7',
  },
  sectionDivider: {
    textAlign: 'center',
    fontSize: 13,
    color: '#3A4257',
    fontWeight: '600',
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2535',
    gap: 12,
  },
  brandAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1E2535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8892A4',
  },
  brandName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
    marginTop: 20,
  },
  modelCount: {
    fontSize: 13,
    color: '#8892A4',
    marginBottom: 12,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2535',
  },
  modelNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modelName: {
    fontSize: 12,
    color: '#8892A4',
    marginTop: 2,
  },
  popularBadge: {
    backgroundColor: '#4FC3F722',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  popularText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4FC3F7',
  },
  connectBtn: {
    backgroundColor: '#4FC3F7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  connectBtnDisabled: {
    backgroundColor: '#1E2535',
  },
  connectBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0E1A',
  },
  // ── Address step ────────────────────────────────────────────────────────
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8892A4',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#141928',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2535',
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: '#4A5568',
    lineHeight: 19,
  },
  // ── Connecting / failed step ─────────────────────────────────────────────
  connectingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  connectingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  connectingSubtitle: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B6B18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 14,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4FC3F7',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 12,
    width: '100%',
    justifyContent: 'center',
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0E1A',
  },
  addAnywayBtn: {
    backgroundColor: '#1E2535',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  addAnywayBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8892A4',
  },
  cancelLink: {
    paddingVertical: 8,
  },
  cancelLinkText: {
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '600',
  },
  // ── BLE Scan step ────────────────────────────────────────────────────────
  bleScanWrap: {
    flex: 1,
  },
  bleScanHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2535',
  },
  bleScanStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bleScanStatusText: {
    fontSize: 13,
    color: '#8892A4',
    flex: 1,
  },
  bleScanRescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bleScanRescanText: {
    fontSize: 13,
    color: '#8892A4',
    fontWeight: '600',
  },
  bleScanList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bleDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2535',
    gap: 12,
  },
  bleDeviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#6C63FF18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bleDeviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bleDeviceId: {
    fontSize: 11,
    color: '#4A5568',
    marginTop: 2,
  },
  bleEmptyWrap: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  bleEmptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  bleEmptySubtitle: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  bleScanRescanBtnLg: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  bleScanRescanTextLg: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6C63FF',
  },
});

