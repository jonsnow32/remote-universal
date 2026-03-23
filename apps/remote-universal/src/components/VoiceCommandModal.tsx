import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceCommandModalProps {
  visible: boolean;
  /**
   * 'stream' — press-and-hold, audio streamed to TV (ms.remote.voice).
   * 'stt'    — tap once, phone recognises speech and sends text to TV.
   * Defaults to 'stream'.
   */
  mode?: 'stream' | 'stt';
  /** STT lifecycle state (only used in 'stt' mode). */
  sttState?: 'idle' | 'listening' | 'recognized' | 'sending';
  /** Recognised transcript text (shown in 'recognized'/'sending' states). */
  transcript?: string;
  /**
   * Called when the user presses the mic button.
   * stream mode: host starts audio streaming.
   * stt mode:    host starts speech recognition.
   */
  onMicStart: () => void;
  /**
   * Called when the user releases the mic button (stream mode only).
   * Host should: stop MicStreamModule, close the TV voice session.
   */
  onMicStop: () => void;
  onClose: () => void;
}

// ─── Pulsing rings (visual feedback while holding) ───────────────────────────

function PulseRings({ active }: { active: boolean }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      ring1.setValue(0);
      ring2.setValue(0);
      return;
    }
    const loop1 = Animated.loop(
      Animated.timing(ring1, { toValue: 1, duration: 1200, useNativeDriver: true }),
    );
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(ring2, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop1.start();
    loop2.start();
    return () => { loop1.stop(); loop2.stop(); };
  }, [active, ring1, ring2]);

  if (!active) return null;

  return (
    <>
      {[ring1, ring2].map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            {
              opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] }),
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
            },
          ]}
        />
      ))}
    </>
  );
}

// ─── Waveform bars ────────────────────────────────────────────────────────────

function WaveformBars({ active }: { active: boolean }) {
  const BARS = 7;
  const anims = useRef(
    Array.from({ length: BARS }, () => new Animated.Value(0.25)),
  ).current;

  useEffect(() => {
    if (!active) {
      anims.forEach(a => Animated.timing(a, { toValue: 0.25, duration: 200, useNativeDriver: true }).start());
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 60),
          Animated.timing(a, { toValue: 1, duration: 280 + i * 40, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.2, duration: 280 + i * 40, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [active, anims]);

  return (
    <View style={styles.waveform}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[styles.bar, { transform: [{ scaleY: anim }] }]}
        />
      ))}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * VoiceCommandModal — remote mic button.
 *
 * Supports two modes:
 *   'stream' (default) — press-and-hold streams raw PCM to the TV via
 *                        ms.remote.voice (like a physical Samsung remote).
 *   'stt'              — tap once; phone does Speech-to-Text, result is sent
 *                        to the TV as a text search query.  Used when the TV
 *                        does not support ms.remote.voice.
 */
export function VoiceCommandModal({
  visible,
  mode = 'stream',
  sttState = 'idle',
  transcript,
  onMicStart,
  onMicStop,
  onClose,
}: VoiceCommandModalProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [holding, setHolding] = useState(false);
  const micScale = useRef(new Animated.Value(1)).current;

  // Reset when modal closes
  useEffect(() => {
    if (!visible) setHolding(false);
  }, [visible]);

  // ── Stream mode handlers (press & hold) ──────────────────────────────────
  const handlePressIn = () => {
    setHolding(true);
    onMicStart();
    Animated.spring(micScale, { toValue: 0.88, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
  };

  const handlePressOut = () => {
    setHolding(false);
    onMicStop();
    Animated.spring(micScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  };

  // ── STT mode handler (tap once) ───────────────────────────────────────────
  const handleSttTap = () => {
    if (sttState === 'idle') {
      onMicStart();
      Animated.spring(micScale, { toValue: 0.88, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
    }
  };

  const isSttActive = mode === 'stt' && (sttState === 'listening' || sttState === 'sending');

  // ── Body copy ─────────────────────────────────────────────────────────────
  const renderBody = () => {
    if (mode === 'stt') {
      if (sttState === 'listening') {
        return (
          <>
            <WaveformBars active />
            <Text style={styles.listeningText}>Listening…</Text>
            <Text style={styles.subText}>Speak now — stops automatically</Text>
          </>
        );
      }
      if (sttState === 'recognized' || sttState === 'sending') {
        return (
          <>
            <Ionicons name="checkmark-circle" size={32} color="#38A169" style={{ marginBottom: 8 }} />
            <Text style={[styles.headingText, { color: '#38A169' }]}>
              {sttState === 'sending' ? 'Sending to TV…' : 'Recognised'}
            </Text>
            {!!transcript && (
              <Text style={[styles.subText, { color: '#CBD5E0', marginTop: 6, fontSize: 15 }]}>
                "{transcript}"
              </Text>
            )}
          </>
        );
      }
      // idle
      return (
        <>
          <Ionicons name="tv-outline" size={32} color="#3A4A66" style={{ marginBottom: 12 }} />
          <Text style={styles.headingText}>Tap to speak</Text>
          <Text style={styles.subText}>
            Tap the mic button and speak.{'\n'}
            The TV will search for what you said.
          </Text>
        </>
      );
    }

    // stream mode
    return holding ? (
      <>
        <WaveformBars active />
        <Text style={styles.listeningText}>Listening…</Text>
        <Text style={styles.subText}>Release to send to TV</Text>
      </>
    ) : (
      <>
        <Ionicons name="tv-outline" size={32} color="#3A4A66" style={{ marginBottom: 12 }} />
        <Text style={styles.headingText}>Hold to speak</Text>
        <Text style={styles.subText}>
          Press and hold the mic button.{'\n'}
          The TV will hear and respond directly.
        </Text>
      </>
    );
  };

  const micActive = mode === 'stt' ? isSttActive : holding;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={!micActive ? onClose : undefined}
      >
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={micActive}>
            <Ionicons name="close" size={22} color={micActive ? '#2A3347' : '#8892A4'} />
          </TouchableOpacity>

          {/* Status text */}
          <View style={styles.body}>{renderBody()}</View>

          {/* Mic button with pulse rings */}
          <View style={styles.micArea}>
            <PulseRings active={micActive} />
            <Animated.View style={{ transform: [{ scale: micScale }] }}>
              {mode === 'stt' ? (
                <TouchableOpacity
                  style={[styles.micBtn, micActive && styles.micBtnActive]}
                  onPress={handleSttTap}
                  activeOpacity={0.8}
                  disabled={sttState !== 'idle'}
                >
                  <Ionicons
                    name={micActive ? 'mic' : 'mic-outline'}
                    size={36}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.micBtn, holding && styles.micBtnActive]}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  activeOpacity={1}
                  delayPressIn={0}
                >
                  <Ionicons
                    name={holding ? 'mic' : 'mic-outline'}
                    size={36}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const RING_SIZE = 88;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0D1220',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    minHeight: 300,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A3347',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    padding: 6,
  },
  body: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
    minHeight: 90,
  },
  headingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subText: {
    fontSize: 13,
    color: '#6B7590',
    textAlign: 'center',
    lineHeight: 19,
  },
  listeningText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E53E3E',
    marginTop: 10,
    marginBottom: 4,
  },
  micArea: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: '#E53E3E',
  },
  micBtn: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  micBtnActive: {
    backgroundColor: '#C0392B',
    shadowOpacity: 0.85,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 48,
    marginBottom: 6,
  },
  bar: {
    width: 5,
    height: 40,
    borderRadius: 3,
    backgroundColor: '#E53E3E',
  },
});
