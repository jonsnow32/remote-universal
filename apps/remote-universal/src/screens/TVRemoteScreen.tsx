import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { CommandDispatcher, DeviceRegistry } from '@remote/core';
import { SamsungQLED } from '@remote/device-sdk';
import type { TVRemoteScreenProps } from '../types/navigation';

const registry = new DeviceRegistry();
registry.register(SamsungQLED);
const dispatcher = new CommandDispatcher(registry);

interface RemoteBtnProps {
  label: string;
  onPress: () => void;
  color?: string;
  flex?: number;
}

function RemoteBtn({ label, onPress, color, flex }: RemoteBtnProps) {
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: color ?? '#1A2035', flex: flex ?? 1 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.btnText, color ? { color: '#FFF' } : {}]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function TVRemoteScreen({ route, navigation }: TVRemoteScreenProps) {
  const { deviceName, location, deviceId } = route.params;

  const send = useCallback(
    (action: string) => {
      dispatcher.dispatch(deviceId, action).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Command Error', msg);
      });
    },
    [deviceId]
  );

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
          <View style={styles.connectedBadge}>
            <View style={styles.connDot} />
            <Text style={styles.connText}>{location} • Connected</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuBtn}>
          <Text style={styles.menuIcon}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Top control row */}
      <View style={styles.row}>
        <RemoteBtn label="⏻ Power" onPress={() => send('power')} color="#E53E3E" />
        <RemoteBtn label="⤸ Source" onPress={() => send('source')} color="#2D4A6B" />
        <RemoteBtn label="🔇 Mute" onPress={() => send('mute')} color="#2D4A6B" />
      </View>

      {/* Vol / Ch / Menu */}
      <View style={styles.row}>
        <RemoteBtn label="Vol +" onPress={() => send('volume_up')} />
        <RemoteBtn label="Ch +" onPress={() => send('channel_up')} />
        <RemoteBtn label="Menu" onPress={() => send('menu')} />
      </View>

      {/* D-Pad */}
      <View style={styles.dpadContainer}>
        <View style={styles.dpadOuter}>
          {/* Up */}
          <TouchableOpacity style={[styles.dpadBtn, styles.dpadUp]} onPress={() => send('up')} activeOpacity={0.7}>
            <Text style={styles.dpadArrow}>▲</Text>
          </TouchableOpacity>
          {/* Left */}
          <TouchableOpacity style={[styles.dpadBtn, styles.dpadLeft]} onPress={() => send('left')} activeOpacity={0.7}>
            <Text style={styles.dpadArrow}>◀</Text>
          </TouchableOpacity>
          {/* Center / OK */}
          <TouchableOpacity style={styles.okBtn} onPress={() => send('ok')} activeOpacity={0.8}>
            <Text style={styles.okText}>OK</Text>
          </TouchableOpacity>
          {/* Right */}
          <TouchableOpacity style={[styles.dpadBtn, styles.dpadRight]} onPress={() => send('right')} activeOpacity={0.7}>
            <Text style={styles.dpadArrow}>▶</Text>
          </TouchableOpacity>
          {/* Down */}
          <TouchableOpacity style={[styles.dpadBtn, styles.dpadDown]} onPress={() => send('down')} activeOpacity={0.7}>
            <Text style={styles.dpadArrow}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Streaming shortcuts */}
      <View style={styles.streamRow}>
        {['Netflix', 'YouTube', 'Prime', 'Disney+'].map(app => (
          <TouchableOpacity key={app} style={styles.streamBtn} onPress={() => send(app.toLowerCase())} activeOpacity={0.7}>
            <Text style={styles.streamText}>{app}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom row */}
      <View style={styles.row}>
        <RemoteBtn label="Vol −" onPress={() => send('volume_down')} />
        <RemoteBtn label="Ch −" onPress={() => send('channel_down')} />
        <RemoteBtn label="← Back" onPress={() => send('back')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  connDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#00C896',
  },
  connText: {
    fontSize: 12,
    color: '#8892A4',
  },
  menuBtn: {
    padding: 8,
  },
  menuIcon: {
    color: '#8892A4',
    fontSize: 20,
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  btnText: {
    color: '#C0C8D8',
    fontSize: 14,
    fontWeight: '600',
  },
  dpadContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dpadOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#141928',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadBtn: {
    position: 'absolute',
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#1A2035',
  },
  dpadUp: { top: 8, left: 64 },
  dpadDown: { bottom: 8, left: 64 },
  dpadLeft: { left: 8, top: 64 },
  dpadRight: { right: 8, top: 64 },
  dpadArrow: {
    color: '#C0C8D8',
    fontSize: 16,
  },
  okBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  okText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  streamRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  streamBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#141928',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  streamText: {
    color: '#C0C8D8',
    fontSize: 11,
    fontWeight: '600',
  },
});
