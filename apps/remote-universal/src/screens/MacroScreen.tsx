import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MacroStackParamList } from '../types/navigation';

type MacroNav = NativeStackNavigationProp<MacroStackParamList, 'MacroList'>;

interface Macro {
  id: string;
  name: string;
  steps: number;
  icon: string;
  color: string;
}

const MACROS: Macro[] = [
  { id: '1', name: 'Movie Night', steps: 3, icon: '🎬', color: '#6C63FF' },
  { id: '2', name: 'Good Morning', steps: 4, icon: '☀️', color: '#F5A623' },
  { id: '3', name: 'Sleep Mode', steps: 2, icon: '🌙', color: '#4A6BCC' },
  { id: '4', name: 'Party Mode', steps: 5, icon: '🎉', color: '#FF4F9A' },
];

export function MacroScreen(): React.ReactElement {
  const navigation = useNavigation<MacroNav>();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <Text style={styles.title}>Macros</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('MacroEditor', {})}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={MACROS}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.macroRow}
            onPress={() => navigation.navigate('MacroEditor', { macroId: item.id, macroName: item.name })}
            activeOpacity={0.8}
          >
            <View style={[styles.macroIcon, { backgroundColor: item.color + '22' }]}>
              <Text style={{ fontSize: 24 }}>{item.icon}</Text>
            </View>
            <View style={styles.macroInfo}>
              <Text style={styles.macroName}>{item.name}</Text>
              <Text style={styles.macroSteps}>{item.steps} steps</Text>
            </View>
            <TouchableOpacity
              style={[styles.runBtn, { backgroundColor: item.color }]}
              onPress={() => { /* run macro */ }}
              activeOpacity={0.8}
            >
              <Text style={styles.runBtnText}>Run</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 26,
  },
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
    padding: 16,
    gap: 14,
  },
  macroIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroInfo: {
    flex: 1,
  },
  macroName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  macroSteps: {
    fontSize: 13,
    color: '#8892A4',
  },
  runBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
  },
  runBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
