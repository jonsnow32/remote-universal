import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import type { SetupCompleteScreenProps } from '../../types/navigation';

const FOUND_DEVICES = [
  { id: '1', name: 'Samsung QLED TV', icon: '📺' },
  { id: '2', name: 'Daikin AC', icon: '❄️' },
];

export function SetupCompleteScreen({ navigation }: SetupCompleteScreenProps) {
  const checkScale = useRef(new Animated.Value(0)).current;
  const listFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(listFade, { toValue: 1, duration: 500, useNativeDriver: true, delay: 200 }),
    ]).start();
  }, [checkScale, listFade]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.content}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
          <Text style={styles.checkIcon}>✓</Text>
        </Animated.View>

        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>
          UniRemote is scanning your{'\n'}network for devices...
        </Text>

        <View style={styles.dotsRow}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>

        <Animated.View style={[styles.deviceList, { opacity: listFade }]}>
          {FOUND_DEVICES.map(d => (
            <View key={d.id} style={styles.deviceRow}>
              <Text style={styles.deviceCheck}>✓</Text>
              <Text style={styles.deviceIcon}>{d.icon}</Text>
              <Text style={styles.deviceName}>{d.name}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate('MainTabs')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>Go to Home</Text>
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
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#00C896',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  checkIcon: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 36,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A3147',
  },
  dotActive: {
    backgroundColor: '#00C896',
  },
  deviceList: {
    width: '100%',
    gap: 10,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderWidth: 1,
    borderColor: '#00C896',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  deviceCheck: {
    color: '#00C896',
    fontSize: 16,
    fontWeight: '700',
  },
  deviceIcon: {
    fontSize: 20,
  },
  deviceName: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  footer: {
    paddingBottom: 48,
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
  btnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
