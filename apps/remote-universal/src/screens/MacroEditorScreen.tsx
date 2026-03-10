import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  StatusBar,
  TextInput,
} from 'react-native';
import type { MacroEditorProps } from '../types/navigation';

interface MacroStep {
  id: string;
  label: string;
  device: string;
  color: string;
}

const DEFAULT_STEPS: MacroStep[] = [
  { id: '1', label: 'TV Power ON', device: 'Samsung QLED', color: '#F5A623' },
  { id: '2', label: 'Set HDMI 2', device: 'Samsung QLED', color: '#F5A623' },
  { id: '3', label: 'AC Cool 22°C', device: 'Daikin Emura', color: '#00C9A7' },
];

export function MacroEditorScreen({ route, navigation }: MacroEditorProps) {
  const { macroName } = route.params ?? {};
  const [steps, setSteps] = useState<MacroStep[]>(DEFAULT_STEPS);

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{macroName ?? 'New Macro'}</Text>
        <Text style={styles.subtitle}>Edit Macro</Text>
      </View>

      <FlatList
        data={steps}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: item.color }]}>
              <Text style={styles.stepNumText}>{index + 1}</Text>
            </View>
            <View style={styles.stepInfo}>
              <Text style={styles.stepLabel}>{item.label}</Text>
              <Text style={styles.stepDevice}>{item.device}</Text>
            </View>
            <TouchableOpacity onPress={() => removeStep(item.id)} style={styles.removeBtn}>
              <Text style={styles.removeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.delayNote}>
              <Text style={styles.delayText}>· 100ms delay between steps</Text>
            </View>
            <TouchableOpacity style={styles.addStepBtn}>
              <Text style={styles.addStepText}>+ Add Step</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Save button */}
      <View style={styles.saveArea}>
        <TouchableOpacity style={styles.saveBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>Save Macro</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 52,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141928',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#8892A4',
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 14,
    padding: 14,
    gap: 14,
  },
  stepNum: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  stepInfo: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepDevice: {
    fontSize: 12,
    color: '#8892A4',
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  removeIcon: {
    color: '#8892A4',
    fontSize: 14,
  },
  footer: {
    marginTop: 12,
    gap: 12,
  },
  delayNote: {
    borderWidth: 1,
    borderColor: '#2A3147',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
  },
  delayText: {
    color: '#8892A4',
    fontSize: 13,
    textAlign: 'center',
  },
  addStepBtn: {
    backgroundColor: '#141928',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3147',
    borderStyle: 'dashed',
  },
  addStepText: {
    color: '#6C63FF',
    fontSize: 15,
    fontWeight: '600',
  },
  saveArea: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
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
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
