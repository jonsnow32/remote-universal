import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MacroEditorProps } from '../types/navigation';
import { useMacros } from '../hooks/useMacros';
import {
  StoredMacroStep,
  MACRO_COLORS,
  MACRO_ICONS,
  CATEGORY_COMMANDS,
} from '../lib/macroStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeviceSummary {
  id: string;
  nickname: string;
  category: string;
  color: string;
}

const DEVICE_STORAGE_KEY = '@remote/user_devices';
const DEFAULT_ICON = 'flash-outline';
const DEFAULT_COLOR = MACRO_COLORS[0];
const DEFAULT_DELAY = 500;

// ─── Step Picker Modal ────────────────────────────────────────────────────────

interface StepPickerProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (step: Omit<StoredMacroStep, 'id'>) => void;
}

function StepPickerModal({ visible, onClose, onAdd }: StepPickerProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<'device' | 'command'>('device');
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhase('device');
      setSelectedDevice(null);
      setLoading(true);
      AsyncStorage.getItem(DEVICE_STORAGE_KEY)
        .then(raw => {
          if (!raw) return;
          const all = JSON.parse(raw) as Array<{
            id: string; nickname: string; category: string; color: string;
          }>;
          setDevices(all.map(d => ({ id: d.id, nickname: d.nickname, category: d.category, color: d.color })));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const handleDevicePick = (device: DeviceSummary) => {
    setSelectedDevice(device);
    setPhase('command');
  };

  const handleCommandPick = (action: string, actionLabel: string) => {
    if (!selectedDevice) return;
    onAdd({
      deviceId: selectedDevice.id,
      deviceNickname: selectedDevice.nickname,
      deviceCategory: selectedDevice.category,
      deviceColor: selectedDevice.color,
      action,
      actionLabel,
      delayAfterMs: DEFAULT_DELAY,
    });
    onClose();
  };

  const commands = selectedDevice
    ? (CATEGORY_COMMANDS[selectedDevice.category] ?? CATEGORY_COMMANDS['other'])
    : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={[pickerStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={pickerStyles.handle} />
          <View style={pickerStyles.header}>
            {phase === 'command' && (
              <TouchableOpacity onPress={() => setPhase('device')} style={pickerStyles.backBtn}>
                <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <Text style={pickerStyles.title}>
              {phase === 'device' ? 'Pick Device' : selectedDevice?.nickname ?? ''}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color="#8892A4" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#6C63FF" style={{ marginVertical: 40 }} />
          ) : phase === 'device' ? (
            devices.length === 0 ? (
              <View style={pickerStyles.empty}>
                <Text style={pickerStyles.emptyText}>No devices added yet.</Text>
                <Text style={pickerStyles.emptyHint}>Go to the Home tab and add a device first.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {devices.map(d => (
                  <TouchableOpacity key={d.id} style={pickerStyles.row} onPress={() => handleDevicePick(d)} activeOpacity={0.75}>
                    <View style={[pickerStyles.deviceDot, { backgroundColor: d.color + '33' }]}>
                      <Ionicons name="hardware-chip-outline" size={16} color={d.color} />
                    </View>
                    <View style={pickerStyles.rowInfo}>
                      <Text style={pickerStyles.rowName}>{d.nickname}</Text>
                      <Text style={pickerStyles.rowSub}>{d.category}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#4A5568" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {commands.map(cmd => (
                <TouchableOpacity key={cmd.action} style={pickerStyles.row} onPress={() => handleCommandPick(cmd.action, cmd.label)} activeOpacity={0.75}>
                  <Text style={pickerStyles.cmdLabel}>{cmd.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F1320',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#2A3147',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2035',
  },
  backBtn: {
    marginRight: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    gap: 12,
  },
  deviceDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  rowSub: { fontSize: 12, color: '#8892A4', marginTop: 1 },
  cmdLabel: { flex: 1, fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptyHint: { color: '#8892A4', fontSize: 13, textAlign: 'center' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export function MacroEditorScreen({ route, navigation }: MacroEditorProps) {
  const { macroId } = route.params ?? {};
  const { macros, create, update, remove } = useMacros();
  const insets = useSafeAreaInsets();

  const isEdit = !!macroId;
  const existing = macros.find(m => m.id === macroId);

  const [name, setName] = useState(existing?.name ?? '');
  const [iconName, setIconName] = useState(existing?.iconName ?? DEFAULT_ICON);
  const [color, setColor] = useState(existing?.color ?? DEFAULT_COLOR);
  const [steps, setSteps] = useState<StoredMacroStep[]>(existing?.steps ?? []);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Sync when navigating to edit mode and macros finish loading
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setIconName(existing.iconName);
      setColor(existing.color);
      setSteps(existing.steps);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macroId]);

  const handleAddStep = useCallback((partial: Omit<StoredMacroStep, 'id'>) => {
    const step: StoredMacroStep = {
      ...partial,
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    };
    setSteps(prev => [...prev, step]);
  }, []);

  const handleRemoveStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setSteps(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setSteps(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleDelayChange = useCallback((id: string, value: string) => {
    const ms = parseInt(value, 10);
    if (isNaN(ms) || ms < 0) return;
    setSteps(prev => prev.map(s => s.id === id ? { ...s, delayAfterMs: ms } : s));
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please give your macro a name.');
      return;
    }
    setSaving(true);
    try {
      const draft = { name: name.trim(), iconName, color, steps };
      if (isEdit && macroId) {
        await update(macroId, draft);
      } else {
        await create(draft);
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Macro',
      `Delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (macroId) {
              await remove(macroId);
              navigation.goBack();
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Edit Macro' : 'New Macro'}</Text>
        {isEdit && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Name input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NAME</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="E.g. Movie Night"
            placeholderTextColor="#3A4257"
            maxLength={40}
            autoCorrect={false}
          />
        </View>

        {/* Icon picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ICON</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
            {MACRO_ICONS.map(ic => (
              <TouchableOpacity
                key={ic.name}
                style={[styles.iconOption, iconName === ic.name && { borderColor: color, borderWidth: 2 }]}
                onPress={() => setIconName(ic.name)}
                activeOpacity={0.75}
              >
                <Ionicons name={ic.name as any} size={22} color={iconName === ic.name ? color : '#8892A4'} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Color picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COLOUR</Text>
          <View style={styles.colorRow}>
            {MACRO_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchSelected]}
                onPress={() => setColor(c)}
                activeOpacity={0.75}
              >
                {color === c && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Steps list */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STEPS ({steps.length})</Text>

          {steps.length === 0 ? (
            <View style={styles.noSteps}>
              <Text style={styles.noStepsText}>No steps yet. Add your first step below.</Text>
            </View>
          ) : (
            steps.map((step, idx) => (
              <View key={step.id} style={styles.stepCard}>
                <View style={styles.stepCardLeft}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.stepCardInfo}>
                    <Text style={styles.stepAction}>{step.actionLabel}</Text>
                    <Text style={styles.stepDevice}>{step.deviceNickname}</Text>
                  </View>
                </View>
                <View style={styles.stepCardRight}>
                  <TouchableOpacity style={styles.stepMoveBtn} onPress={() => handleMoveUp(idx)} disabled={idx === 0}>
                    <Ionicons name="chevron-up" size={14} color={idx === 0 ? '#2A3147' : '#8892A4'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stepMoveBtn} onPress={() => handleMoveDown(idx)} disabled={idx === steps.length - 1}>
                    <Ionicons name="chevron-down" size={14} color={idx === steps.length - 1 ? '#2A3147' : '#8892A4'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stepDelBtn} onPress={() => handleRemoveStep(step.id)}>
                    <Ionicons name="close-circle" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
                {/* Delay row */}
                {idx < steps.length - 1 && (
                  <View style={styles.delayRow}>
                    <Ionicons name="timer-outline" size={12} color="#4A5568" />
                    <Text style={styles.delayLabel}>Wait</Text>
                    <TextInput
                      style={styles.delayInput}
                      value={String(step.delayAfterMs)}
                      onChangeText={v => handleDelayChange(step.id, v)}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                    <Text style={styles.delayLabel}>ms before next step</Text>
                  </View>
                )}
              </View>
            ))
          )}

          <TouchableOpacity style={styles.addStepBtn} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color="#6C63FF" />
            <Text style={styles.addStepText}>Add Step</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Save button */}
      <View style={[styles.saveArea, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Create Macro'}</Text>}
        </TouchableOpacity>
      </View>

      <StepPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onAdd={handleAddStep}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 52,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141928',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B6B18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 26,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8892A4',
    letterSpacing: 1,
    marginBottom: 10,
  },
  nameInput: {
    backgroundColor: '#141928',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  iconRow: {
    gap: 8,
    paddingBottom: 4,
  },
  iconOption: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#141928',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  // Steps
  noSteps: {
    backgroundColor: '#141928',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  noStepsText: {
    color: '#8892A4',
    fontSize: 14,
  },
  stepCard: {
    backgroundColor: '#141928',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E2535',
  },
  stepCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E2535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8892A4',
  },
  stepCardInfo: { flex: 1 },
  stepAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepDevice: {
    fontSize: 12,
    color: '#8892A4',
    marginTop: 2,
  },
  stepCardRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepMoveBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#1E2535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDelBtn: { marginLeft: 4, padding: 4 },
  delayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1A2035',
    marginTop: 4,
  },
  delayLabel: { fontSize: 11, color: '#4A5568' },
  delayInput: {
    backgroundColor: '#1E2535',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'center',
  },
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141928',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A3147',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addStepText: {
    color: '#6C63FF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Save
  saveArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#0A0E1A',
    borderTopWidth: 1,
    borderTopColor: '#1A2035',
  },
  saveBtn: {
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
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
