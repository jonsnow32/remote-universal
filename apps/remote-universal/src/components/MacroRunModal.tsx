import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  StoredMacro,
  MacroStepResult,
  MacroRunResult,
  MacroStepStatus,
  runMacro,
} from '../lib/macroStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  macro: StoredMacro;
  visible: boolean;
  onClose: () => void;
}

type Phase = 'preview' | 'running' | 'done';

// ─── Step Status Row ─────────────────────────────────────────────────────────

interface StepRowProps {
  stepIndex: number;
  macro: StoredMacro;
  result: MacroStepResult;
}

function StepRow({ stepIndex, macro, result }: StepRowProps) {
  const step = macro.steps[stepIndex];
  const { status, durationMs, error } = result;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'running') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulseAnim]);

  const statusIcon = () => {
    switch (status) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={22} color="#00C9A7" />;
      case 'failed':
        return <Ionicons name="close-circle" size={22} color="#FF6B6B" />;
      case 'skipped':
        return <Ionicons name="remove-circle-outline" size={22} color="#4A5568" />;
      case 'running':
        return <ActivityIndicator size="small" color="#6C63FF" />;
      default: // pending
        return (
          <View style={styles.pendingCircle}>
            <Text style={styles.pendingNum}>{stepIndex + 1}</Text>
          </View>
        );
    }
  };

  const rowBg = status === 'running' ? '#1C1E2D' : 'transparent';
  const nameColor = status === 'pending' ? '#4A5568' : status === 'skipped' ? '#4A5568' : '#FFFFFF';
  const subColor = status === 'pending' || status === 'skipped' ? '#333B52' : '#8892A4';

  return (
    <Animated.View style={[styles.stepRow, { backgroundColor: rowBg, opacity: status === 'pending' ? 0.5 : 1 }]}>
      <View style={styles.stepIcon}>{statusIcon()}</View>
      <View style={styles.stepInfo}>
        <Text style={[styles.stepName, { color: nameColor }]}>{step.actionLabel}</Text>
        <Text style={[styles.stepSub, { color: subColor }]}>
          {step.deviceNickname}
          {status === 'success' && durationMs > 0 && ` · ${durationMs}ms`}
        </Text>
        {status === 'failed' && error && (
          <Text style={styles.stepError}>{error}</Text>
        )}
      </View>
      {status === 'running' && (
        <Animated.View style={[styles.stepRunIndicator, { opacity: pulseAnim }]} />
      )}
      {step.delayAfterMs > 0 && stepIndex < macro.steps.length - 1 && (
        status !== 'pending' && status !== 'running'
          ? <View style={styles.delayBadge}>
              <Text style={styles.delayBadgeText}>{step.delayAfterMs}ms</Text>
            </View>
          : null
      )}
    </Animated.View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MacroRunModal({ macro, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('preview');
  const [stepResults, setStepResults] = useState<MacroStepResult[]>(() =>
    macro.steps.map((_, i) => ({ stepIndex: i, status: 'pending' as MacroStepStatus, durationMs: 0 })),
  );
  const [runResult, setRunResult] = useState<MacroRunResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPhase('preview');
      setRunResult(null);
      setStepResults(
        macro.steps.map((_, i) => ({ stepIndex: i, status: 'pending', durationMs: 0 })),
      );
    }
  }, [visible, macro.steps]);

  const handleRun = useCallback(async () => {
    setPhase('running');
    abortRef.current = new AbortController();

    const result = await runMacro(macro, {
      signal: abortRef.current.signal,
      onStepUpdate: (index, stepResult) => {
        setStepResults(prev => {
          const next = [...prev];
          next[index] = stepResult;
          return next;
        });
        // Auto-scroll to running step
        if (stepResult.status === 'running') {
          setTimeout(() => scrollRef.current?.scrollTo({ y: index * 72, animated: true }), 100);
        }
      },
    });

    setRunResult(result);
    setPhase('done');
    abortRef.current = null;
  }, [macro]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    onClose();
  }, [onClose]);

  const handleRetry = useCallback(() => {
    setPhase('preview');
    setRunResult(null);
    setStepResults(macro.steps.map((_, i) => ({ stepIndex: i, status: 'pending', durationMs: 0 })));
  }, [macro.steps]);

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const renderPreview = () => (
    <>
      <View style={styles.previewHeader}>
        <View style={[styles.macroIconBg, { backgroundColor: macro.color + '22' }]}>
          <Ionicons name={macro.iconName as any} size={28} color={macro.color} />
        </View>
        <Text style={styles.macroTitle}>{macro.name}</Text>
        <Text style={styles.macroSubtitle}>
          {macro.steps.length} step{macro.steps.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView style={styles.stepList} showsVerticalScrollIndicator={false}>
        {macro.steps.map((step, i) => (
          <View key={step.id} style={styles.previewRow}>
            <View style={styles.previewBullet}>
              <Text style={styles.previewBulletText}>{i + 1}</Text>
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewAction}>{step.actionLabel}</Text>
              <Text style={styles.previewDevice}>{step.deviceNickname}</Text>
            </View>
            {step.delayAfterMs > 0 && i < macro.steps.length - 1 && (
              <View style={styles.delayBadge}>
                <Text style={styles.delayBadgeText}>+{step.delayAfterMs}ms</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.runBtn} onPress={handleRun} activeOpacity={0.85}>
          <Ionicons name="play" size={16} color="#FFFFFF" />
          <Text style={styles.runBtnText}>Run Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.75}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderRunning = () => (
    <>
      <View style={styles.runningHeader}>
        <ActivityIndicator size="small" color="#6C63FF" style={{ marginRight: 8 }} />
        <Text style={styles.runningTitle}>Running "{macro.name}"…</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.stepList} showsVerticalScrollIndicator={false}>
        {stepResults.map((result, i) => (
          <StepRow key={macro.steps[i].id} stepIndex={i} macro={macro} result={result} />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.abortBtn} onPress={handleAbort} activeOpacity={0.75}>
          <Ionicons name="stop-circle-outline" size={16} color="#FF6B6B" />
          <Text style={styles.abortBtnText}>Stop</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderDone = () => {
    if (!runResult) return null;
    const allOk = runResult.failCount === 0 && !runResult.aborted;

    return (
      <>
        <View style={styles.doneHeader}>
          {allOk ? (
            <Ionicons name="checkmark-circle" size={48} color="#00C9A7" />
          ) : (
            <Ionicons name="alert-circle" size={48} color={runResult.aborted ? '#F5A623' : '#FF6B6B'} />
          )}
          <Text style={styles.doneTitle}>
            {runResult.aborted
              ? 'Stopped'
              : allOk
              ? 'All Done!'
              : `${runResult.failCount} step${runResult.failCount !== 1 ? 's' : ''} failed`}
          </Text>
          <Text style={styles.doneSub}>
            {runResult.successCount}/{macro.steps.length} steps succeeded
            {' · '}{(runResult.totalDurationMs / 1000).toFixed(1)}s
          </Text>
        </View>

        <ScrollView style={styles.stepList} showsVerticalScrollIndicator={false}>
          {stepResults.map((result, i) => (
            <StepRow key={macro.steps[i].id} stepIndex={i} macro={macro} result={result} />
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {(runResult.failCount > 0 || runResult.aborted) && (
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Run Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.cancelBtn, allOk && styles.doneCloseBtn]}
            onPress={handleClose}
            activeOpacity={0.75}
          >
            <Text style={[styles.cancelBtnText, allOk && styles.doneCloseBtnText]}>Close</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { maxHeight: '85%' }]}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color="#8892A4" />
          </TouchableOpacity>

          {phase === 'preview' && renderPreview()}
          {phase === 'running' && renderRunning()}
          {phase === 'done' && renderDone()}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F1320',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E2535',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Preview phase
  previewHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  macroIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  macroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  macroSubtitle: {
    fontSize: 13,
    color: '#8892A4',
  },

  // Step list shared
  stepList: {
    paddingHorizontal: 16,
    maxHeight: 320,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2035',
    gap: 12,
  },
  previewBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E2535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBulletText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8892A4',
  },
  previewInfo: { flex: 1 },
  previewAction: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  previewDevice: { fontSize: 12, color: '#8892A4', marginTop: 2 },

  // Running step row
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
    gap: 12,
  },
  stepIcon: { width: 28, alignItems: 'center' },
  stepInfo: { flex: 1 },
  stepName: { fontSize: 14, fontWeight: '600' },
  stepSub: { fontSize: 12, marginTop: 2 },
  stepError: { fontSize: 11, color: '#FF6B6B', marginTop: 2 },
  stepRunIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6C63FF',
  },

  pendingCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#2A3147',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingNum: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4A5568',
  },

  delayBadge: {
    backgroundColor: '#1A2035',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  delayBadgeText: {
    fontSize: 10,
    color: '#4A5568',
    fontWeight: '600',
  },

  // Running phase header
  runningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  runningTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Done phase
  doneHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  doneSub: {
    fontSize: 13,
    color: '#8892A4',
  },

  // Footer buttons
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1A2035',
    marginTop: 8,
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  runBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelBtnText: {
    color: '#8892A4',
    fontSize: 14,
    fontWeight: '600',
  },
  abortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B1A',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B40',
  },
  abortBtnText: {
    color: '#FF6B6B',
    fontSize: 15,
    fontWeight: '700',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  doneCloseBtn: {
    backgroundColor: '#141928',
    borderRadius: 14,
    paddingVertical: 14,
  },
  doneCloseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
