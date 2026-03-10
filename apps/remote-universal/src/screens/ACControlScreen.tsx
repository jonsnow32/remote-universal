import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import type { ACControlScreenProps } from '../types/navigation';

type ACMode = 'Cool' | 'Heat' | 'Fan' | 'Dry' | 'Auto';
type FanSpeed = 'Auto' | 'Low' | 'Med' | 'High';

const MODE_COLORS: Record<ACMode, string> = {
  Cool: '#00C9A7',
  Heat: '#FF6B35',
  Fan: '#6C63FF',
  Dry: '#F5A623',
  Auto: '#00BFFF',
};

export function ACControlScreen({ route, navigation }: ACControlScreenProps) {
  const { deviceName, location } = route.params;
  const [isPowered, setIsPowered] = useState(true);
  const [temperature, setTemperature] = useState(24);
  const [mode, setMode] = useState<ACMode>('Cool');
  const [fanSpeed, setFanSpeed] = useState<FanSpeed>('Auto');
  const [swingOn, setSwingOn] = useState(true);

  const modeColor = MODE_COLORS[mode];

  const adjustTemp = (delta: number) => {
    setTemperature(prev => Math.min(32, Math.max(16, prev + delta)));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.deviceName}>{deviceName}</Text>
          <Text style={styles.deviceSub}>{location} • {mode} {temperature}°C</Text>
        </View>
        <TouchableOpacity
          style={[styles.powerBtn, { borderColor: isPowered ? modeColor : '#2A3147' }]}
          onPress={() => setIsPowered(p => !p)}
          activeOpacity={0.8}
        >
          <Text style={[styles.powerIcon, { color: isPowered ? modeColor : '#8892A4' }]}>⏻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Power glow indicator */}
        <View style={styles.powerGlowArea}>
          <View style={[styles.powerGlow, { shadowColor: modeColor, borderColor: isPowered ? modeColor : '#2A3147', opacity: isPowered ? 1 : 0.4 }]}>
            <Text style={{ fontSize: 36 }}>❄️</Text>
          </View>
        </View>

        {/* Temperature Control */}
        <View style={styles.tempControl}>
          <TouchableOpacity style={styles.tempBtn} onPress={() => adjustTemp(-1)} activeOpacity={0.7}>
            <Text style={styles.tempBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.tempDisplay}>
            <Text style={[styles.tempValue, { color: modeColor }]}>{temperature}°C</Text>
            <Text style={styles.tempLabel}>Target Temperature</Text>
          </View>
          <TouchableOpacity style={styles.tempBtn} onPress={() => adjustTemp(1)} activeOpacity={0.7}>
            <Text style={styles.tempBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Mode pills */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {(['Cool', 'Heat', 'Fan', 'Dry', 'Auto'] as ACMode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.pill, mode === m && { backgroundColor: MODE_COLORS[m] }]}
                onPress={() => setMode(m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, mode === m && { color: '#FFFFFF' }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Fan Speed */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Fan Speed</Text>
          <View style={styles.fanRow}>
            {(['Auto', 'Low', 'Med', 'High'] as FanSpeed[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.fanBtn, fanSpeed === f && { backgroundColor: modeColor }]}
                onPress={() => setFanSpeed(f)}
                activeOpacity={0.8}
              >
                <Text style={[styles.fanBtnText, fanSpeed === f && { color: '#FFF' }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Swing + Schedule */}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, swingOn && { borderColor: '#00C9A7' }]}
            onPress={() => setSwingOn(s => !s)}
            activeOpacity={0.8}
          >
            <View style={[styles.swingDot, { backgroundColor: swingOn ? '#00C9A7' : '#2A3147' }]} />
            <Text style={[styles.toggleBtnText, { color: swingOn ? '#00C9A7' : '#8892A4' }]}>
              Swing: {swingOn ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.scheduleBtn} activeOpacity={0.8}>
            <Text style={styles.scheduleBtnText}>📅 Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
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
  backIcon: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  headerInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deviceSub: {
    fontSize: 12,
    color: '#8892A4',
    marginTop: 2,
  },
  powerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerIcon: {
    fontSize: 18,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  powerGlowArea: {
    alignItems: 'center',
    marginVertical: 20,
  },
  powerGlow: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    backgroundColor: '#141928',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },
  tempControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 28,
  },
  tempBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#141928',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  tempBtnText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  tempDisplay: {
    alignItems: 'center',
  },
  tempValue: {
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 60,
  },
  tempLabel: {
    fontSize: 12,
    color: '#8892A4',
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#8892A4',
    marginBottom: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  pillRow: {
    gap: 8,
    paddingRight: 8,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#141928',
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  pillText: {
    color: '#8892A4',
    fontSize: 14,
    fontWeight: '600',
  },
  fanRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fanBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#141928',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  fanBtnText: {
    color: '#8892A4',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#141928',
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  swingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#141928',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  scheduleBtnText: {
    color: '#F5A623',
    fontSize: 13,
    fontWeight: '600',
  },
});
