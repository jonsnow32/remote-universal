import React, { useState } from 'react';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePro } from '../hooks/usePro';
import { PRODUCT_IDS } from '../lib/purchases';

// ─── Data ─────────────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  { emoji: '📱', title: 'Unlimited Devices', desc: 'Add as many TVs, ACs & devices as you need' },
  { emoji: '☁️', title: 'Cloud Backup & Sync', desc: 'Restore your devices on any phone instantly' },
  { emoji: '⚡', title: 'Macros & Automation', desc: '"Movie Night" — one tap to control everything' },
  { emoji: '🎨', title: 'Custom Layouts', desc: 'Rearrange buttons exactly how you want' },
  { emoji: '🏠', title: 'Multi-Room Groups', desc: 'Control all rooms at once' },
  { emoji: '⏰', title: 'Scheduled Actions', desc: 'Set timers — AC off after 2 hours' },
];

type PlanKey = 'monthly' | 'annual' | 'lifetime';

interface Plan {
  key: PlanKey;
  label: string;
  price: string;
  period: string;
  badge?: string;
  perMonth?: string;
}

const PLANS: Plan[] = [
  {
    key: 'annual',
    label: 'Annual',
    price: '$19.99',
    period: '/year',
    badge: 'BEST VALUE',
    perMonth: '$1.67/mo',
  },
  {
    key: 'monthly',
    label: 'Monthly',
    price: '$2.99',
    period: '/month',
  },
  {
    key: 'lifetime',
    label: 'Lifetime',
    price: '$39.99',
    period: 'once',
    badge: 'LIMITED',
    perMonth: 'Pay once, keep forever',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaywallScreenProps {
  onClose: () => void;
  /** Optional context message shown at top, e.g. "You've reached the 3-device limit" */
  reason?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaywallScreen({ onClose, reason }: PaywallScreenProps): React.ReactElement {
  const { offering, purchase, restore, isPro } = usePro();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const insets = useSafeAreaInsets();

  // If user already has Pro (e.g. restored), close automatically
  React.useEffect(() => {
    if (isPro) onClose();
  }, [isPro, onClose]);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const productId = PRODUCT_IDS[selectedPlan];
      const success = await purchase(productId);
      if (success) {
        onClose();
      }
    } catch {
      Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const success = await restore();
      if (success) {
        Alert.alert('Restored ✓', 'Your Pro subscription has been restored.');
        onClose();
      } else {
        Alert.alert('Nothing to Restore', 'No active Pro subscription found for this Apple/Google account.');
      }
    } catch {
      Alert.alert('Restore Failed', 'Please check your internet connection and try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={16} color="#8892A4" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.proBadge}>
            <Ionicons name="flash" size={12} color="#FFFFFF" />
            <Text style={styles.proBadgeText}> PRO</Text>
          </View>
          <Text style={styles.heroTitle}>Upgrade to Pro</Text>
          <Text style={styles.heroSub}>
            {reason ?? 'Unlock the full UniRemote experience'}
          </Text>
        </View>

        {/* Feature list */}
        <View style={styles.featureList}>
          {PRO_FEATURES.map(f => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Text style={{ fontSize: 20 }}>{f.emoji}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color="#6C63FF" />
            </View>
          ))}
        </View>

        {/* Plan selector */}
        <View style={styles.planSection}>
          <Text style={styles.planSectionLabel}>CHOOSE YOUR PLAN</Text>
          <View style={styles.planList}>
            {PLANS.map(plan => {
              const selected = selectedPlan === plan.key;
              return (
                <TouchableOpacity
                  key={plan.key}
                  style={[styles.planCard, selected && styles.planCardSelected]}
                  onPress={() => setSelectedPlan(plan.key)}
                  activeOpacity={0.8}
                >
                  {plan.badge && (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{plan.badge}</Text>
                    </View>
                  )}
                  <View style={styles.planCardInner}>
                    <View style={[styles.planRadio, selected && styles.planRadioSelected]}>
                      {selected && <View style={styles.planRadioDot} />}
                    </View>
                    <View style={styles.planInfo}>
                      <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>
                        {plan.label}
                      </Text>
                      {plan.perMonth && (
                        <Text style={styles.planPerMonth}>{plan.perMonth}</Text>
                      )}
                    </View>
                    <View style={styles.planPriceBlock}>
                      <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>
                        {plan.price}
                      </Text>
                      <Text style={styles.planPeriod}>{plan.period}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CTA button */}
        <TouchableOpacity
          style={[styles.ctaBtn, purchasing && styles.ctaBtnDisabled]}
          onPress={handlePurchase}
          disabled={purchasing || restoring}
          activeOpacity={0.85}
        >
          {purchasing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.ctaBtnText}>
                {selectedPlan === 'lifetime' ? 'Get Lifetime Access' : 'Start Free Trial'}
              </Text>
              {selectedPlan !== 'lifetime' && (
                <Text style={styles.ctaBtnSub}>7 days free, then {PLANS.find(p => p.key === selectedPlan)?.price}{PLANS.find(p => p.key === selectedPlan)?.period}</Text>
              )}
            </>
          )}
        </TouchableOpacity>

        {/* Restore + legal */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={restoring || purchasing}
          activeOpacity={0.7}
        >
          {restoring
            ? <ActivityIndicator color="#8892A4" size="small" />
            : <Text style={styles.restoreBtnText}>Restore Purchases</Text>}
        </TouchableOpacity>

        <Text style={styles.legal}>
          {Platform.OS === 'ios'
            ? 'Payment charged to iTunes account at confirmation. Subscription renews automatically unless cancelled at least 24h before end of current period. Manage in App Store Settings.'
            : 'Payment charged to Google Play account at confirmation. Subscription renews automatically unless cancelled before renewal.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2535',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#8892A4',
    fontSize: 13,
    fontWeight: '700',
  },
  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C63FF',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  proBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 15,
    color: '#8892A4',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Features
  featureList: {
    marginHorizontal: 20,
    backgroundColor: '#141928',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2535',
    gap: 12,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#6C63FF18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDesc: {
    color: '#8892A4',
    fontSize: 12,
    lineHeight: 16,
  },
  checkmark: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '800',
  },
  // Plans
  planSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  planSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8892A4',
    letterSpacing: 1,
    marginBottom: 10,
  },
  planList: {
    gap: 8,
  },
  planCard: {
    backgroundColor: '#141928',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E2535',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: '#6C63FF',
    backgroundColor: '#6C63FF0F',
  },
  planBadge: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderBottomRightRadius: 8,
  },
  planBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  planCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3A4257',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioSelected: {
    borderColor: '#6C63FF',
  },
  planRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6C63FF',
  },
  planInfo: {
    flex: 1,
  },
  planLabel: {
    color: '#8892A4',
    fontSize: 15,
    fontWeight: '600',
  },
  planLabelSelected: {
    color: '#FFFFFF',
  },
  planPerMonth: {
    color: '#6C63FF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  planPriceBlock: {
    alignItems: 'flex-end',
  },
  planPrice: {
    color: '#8892A4',
    fontSize: 18,
    fontWeight: '800',
  },
  planPriceSelected: {
    color: '#FFFFFF',
  },
  planPeriod: {
    color: '#4A5568',
    fontSize: 11,
  },
  // CTA
  ctaBtn: {
    marginHorizontal: 20,
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 12,
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  ctaBtnSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 3,
  },
  // Restore + legal
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  restoreBtnText: {
    color: '#8892A4',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  legal: {
    color: '#3A4257',
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginHorizontal: 28,
  },
});
