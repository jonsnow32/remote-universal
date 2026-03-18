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
import { Ionicons } from '@expo/vector-icons';
import { useAllBrands, useModelsByBrand } from '../hooks/useCatalog';
import type { CatalogModel } from '../hooks/useCatalog';
import { ProtocolPicker } from './ProtocolPicker';
import type { ConnectionProtocol, DeviceCategory } from '../types/navigation';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORIES: { id: DeviceCategory; label: string; icon: IoniconName }[] = [
  { id: 'tv', label: 'TV', icon: 'tv-outline' },
  { id: 'ac', label: 'AC', icon: 'snow-outline' },
  { id: 'speaker', label: 'Speaker', icon: 'volume-high-outline' },
  { id: 'light', label: 'Light', icon: 'bulb-outline' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AddDeviceResult {
  brand: string;
  model: string;
  category: DeviceCategory;
  protocol: ConnectionProtocol;
  modelId?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: AddDeviceResult) => void;
}

type Step = 'search' | 'models' | 'protocol';

// ─── Component ───────────────────────────────────────────────────────────────

export function AddDeviceSheet({ visible, onClose, onSelect }: Props): React.ReactElement | null {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedBrandSlug, setSelectedBrandSlug] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<ConnectionProtocol>('wifi');

  const { data: brands, isLoading: brandsLoading } = useAllBrands();
  const { data: models, isLoading: modelsLoading } = useModelsByBrand(selectedBrandSlug);

  useEffect(() => {
    if (visible) {
      resetState();
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, slideAnim, backdropAnim]);

  const resetState = () => {
    setStep('search');
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedBrand('');
    setSelectedBrandSlug(null);
    setSelectedModel('');
    setSelectedModelId(null);
    setSelectedProtocol('wifi');
  };

  const handleBrandSelect = (name: string, slug: string | null) => {
    setSelectedBrand(name);
    setSelectedBrandSlug(slug);
    setStep('models');
  };

  const handleModelSelect = (model: CatalogModel) => {
    setSelectedModel(model.model_number);
    setSelectedModelId(model.id);
    if (model.protocols?.length) {
      setSelectedProtocol(model.protocols[0] as ConnectionProtocol);
    }
    if (model.category) {
      setSelectedCategory(model.category as DeviceCategory);
    }
    setStep('protocol');
  };

  const handleConnect = () => {
    onSelect({
      brand: selectedBrand,
      model: selectedModel,
      category: selectedCategory ?? 'tv',
      protocol: selectedProtocol,
      modelId: selectedModelId ?? undefined,
    });
    onClose();
  };

  if (!visible) return null;

  const filteredBrands = brands?.filter(b => {
    if (!searchQuery) return true;
    return b.name.toLowerCase().includes(searchQuery.toLowerCase());
  }) ?? [];

  const filteredModels = models?.filter(m => {
    if (!searchQuery && step === 'models') return true;
    const q = searchQuery.toLowerCase();
    return m.model_number.toLowerCase().includes(q) || (m.model_name?.toLowerCase().includes(q) ?? false);
  }) ?? [];

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
            {step !== 'search' && (
              <TouchableOpacity
                onPress={() => setStep(step === 'protocol' ? 'models' : 'search')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>
              {step === 'search' ? 'Add Device' : step === 'models' ? `${selectedBrand} · ${selectedCategory?.toUpperCase() ?? 'TV'}` : `${selectedBrand} ${selectedModel}`}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color="#8892A4" />
            </TouchableOpacity>
          </View>

          {/* Step: Search + Browse */}
          {step === 'search' && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Search bar */}
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
              </View>

              {/* Browse by Category */}
              {!searchQuery && (
                <>
                  <Text style={styles.sectionTitle}>BROWSE BY CATEGORY</Text>
                  <View style={styles.categoryGrid}>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryTile, selectedCategory === cat.id && styles.categoryTileActive]}
                        onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={cat.icon} size={22} color={selectedCategory === cat.id ? '#4FC3F7' : '#8892A4'} />
                        <Text style={[styles.categoryLabel, selectedCategory === cat.id && styles.categoryLabelActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.sectionDivider}>OR</Text>
                </>
              )}

              {/* Popular Brands / Search Results */}
              <Text style={styles.sectionTitle}>
                {searchQuery ? 'SEARCH RESULTS' : 'POPULAR BRANDS'}
              </Text>

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
              {!brandsLoading && filteredBrands.length === 0 && (
                <Text style={styles.emptyText}>No brands found for "{searchQuery}"</Text>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {/* Step: Models */}
          {step === 'models' && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modelCount}>
                {modelsLoading ? 'Loading models...' : `${filteredModels.length} models`}
              </Text>

              {/* Model search */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#4A5568" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search model..."
                  placeholderTextColor="#4A5568"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
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

          {/* Step: Protocol */}
          {step === 'protocol' && (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              <ProtocolPicker
                selected={selectedProtocol}
                recommended="wifi"
                onSelect={setSelectedProtocol}
              />

              <TouchableOpacity style={styles.connectBtn} onPress={handleConnect} activeOpacity={0.8}>
                <Text style={styles.connectBtnText}>
                  Connect with {selectedProtocol === 'wifi' ? 'Wi-Fi' : selectedProtocol === 'ble' ? 'Bluetooth' : selectedProtocol === 'ir' ? 'IR' : selectedProtocol === 'homekit' ? 'HomeKit' : 'Matter'} →
                </Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
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
  connectBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0E1A',
  },
});
