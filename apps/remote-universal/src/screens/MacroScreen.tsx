import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MacroStackParamList } from '../types/navigation';
import { useMacros } from '../hooks/useMacros';
import { StoredMacro } from '../lib/macroStore';
import { MacroRunModal } from '../components/MacroRunModal';

type MacroNav = NativeStackNavigationProp<MacroStackParamList, 'MacroList'>;

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconBg}>
        <Ionicons name="flash-outline" size={36} color="#6C63FF" />
      </View>
      <Text style={styles.emptyTitle}>No Quick Actions Yet</Text>
      <Text style={styles.emptyDesc}>
        Create a macro to control multiple devices with one tap — Movie Night, Good Morning, Sleep Mode and more.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.85}>
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text style={styles.emptyBtnText}>Create First Macro</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Macro Row ────────────────────────────────────────────────────────────────

interface MacroRowProps {
  macro: StoredMacro;
  onEdit: () => void;
  onRun: () => void;
}

function MacroRow({ macro, onEdit, onRun }: MacroRowProps) {
  return (
    <TouchableOpacity style={styles.macroRow} onPress={onEdit} activeOpacity={0.8}>
      <View style={[styles.macroIconBg, { backgroundColor: macro.color + '22' }]}>
        <Ionicons name={macro.iconName as any} size={24} color={macro.color} />
      </View>
      <View style={styles.macroInfo}>
        <Text style={styles.macroName}>{macro.name}</Text>
        <Text style={styles.macroSteps}>
          {macro.steps.length} step{macro.steps.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.runBtn, { backgroundColor: macro.color }]}
        onPress={onRun}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="play" size={12} color="#FFFFFF" />
        <Text style={styles.runBtnText}>Run</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function MacroScreen(): React.ReactElement {
  const navigation = useNavigation<MacroNav>();
  const { macros, isLoading, refresh } = useMacros();
  const [activeMacro, setActiveMacro] = useState<StoredMacro | null>(null);

  const handleRun = (macro: StoredMacro) => {
    if (macro.steps.length === 0) return;
    setActiveMacro(macro);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Quick Actions</Text>
          {macros.length > 0 && (
            <Text style={styles.subtitle}>{macros.length} macro{macros.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('MacroEditor', {})}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#6C63FF" />
        </View>
      ) : macros.length === 0 ? (
        <EmptyState onAdd={() => navigation.navigate('MacroEditor', {})} />
      ) : (
        <FlatList
          data={macros}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <MacroRow
              macro={item}
              onEdit={() => navigation.navigate('MacroEditor', { macroId: item.id, macroName: item.name })}
              onRun={() => handleRun(item)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onRefresh={refresh}
          refreshing={isLoading}
        />
      )}

      {activeMacro && (
        <MacroRunModal
          macro={activeMacro}
          visible={!!activeMacro}
          onClose={() => setActiveMacro(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 56,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#8892A4',
    marginTop: 2,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#6C63FF18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    gap: 7,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Macro list
  list: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 100,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 16,
    padding: 14,
    gap: 14,
  },
  macroIconBg: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroInfo: {
    flex: 1,
  },
  macroName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  macroSteps: {
    fontSize: 12,
    color: '#8892A4',
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  runBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
