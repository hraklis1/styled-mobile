import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import { ENTITLEMENT_ID, getSubscriptionInfo, type SubscriptionInfo } from '../../lib/purchases';
import { presentPaywall } from '../../lib/paywall';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useProfile } from '../../hooks/useProfile';
import { SettingsScaffold, Group, NavRow, GroupBlock } from '../../components/profile/SettingsUI';
import { colors, spacing, typography, radii } from '../../theme';
import { planTierLabel } from './membership';

const COST_LABELS: [string, string][] = [
  ['stylist', 'Stylist reply'],
  ['daily_look', "Today's Look"],
  ['cutout', 'Background removal'],
  ['outfit_generate', 'Outfit generation'],
  ['flatlay', 'Flat lay image'],
  ['studio_voice', 'Voice reply'],
];

export function MembershipScreen() {
  const { refetch } = useProfile();
  const { isPremium, planTier, credits, creditsRefillAt, freeUsage, costOf } = useEntitlement();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [busy, setBusy] = useState<'upgrade' | 'restore' | null>(null);

  // RevenueCat is the source of truth for renewal. It's a different clock from
  // creditsRefillAt: annual plans refill credits monthly but renew yearly.
  useEffect(() => {
    if (!isPremium) return;
    getSubscriptionInfo().then(setSubscription).catch(() => {});
  }, [isPremium]);

  const upgrade = async () => {
    setBusy('upgrade');
    try { await presentPaywall(); await refetch(); } finally { setBusy(null); }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const info = await Purchases.restorePurchases();
      const premium = !!info.entitlements.active[ENTITLEMENT_ID];
      Alert.alert(premium ? 'Restored' : 'No subscription found',
        premium ? 'Your subscription has been restored.' : "We couldn't find an active subscription to restore.");
      await refetch();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not restore purchases. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const manage = async () => {
    try { await Purchases.showManageSubscriptions(); } catch {
      Alert.alert('Unavailable', 'Manage your subscription from the App Store app under your account.');
    }
  };

  const fmt = (date: Date | string) => new Date(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const costs = COST_LABELS.map(([meter, label]) => [label, costOf(meter)] as const).filter(([, cost]) => cost > 0);

  return (
    <SettingsScaffold title="Membership">
      <View style={s.card}>
        <Text style={s.eyebrow}>Your plan</Text>
        <Text style={s.plan}>{planTierLabel(planTier)}</Text>
        {isPremium && subscription?.renewsAt && (
          <Text style={s.meta}>{subscription.willRenew ? 'Renews' : 'Ends'} {fmt(subscription.renewsAt)}</Text>
        )}
        {!isPremium && (
          <Pressable style={s.cta} onPress={upgrade} disabled={busy !== null} accessibilityRole="button">
            {busy === 'upgrade'
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={s.ctaText}>Upgrade to Premium</Text>}
          </Pressable>
        )}
      </View>

      {credits && (
        <Group title="Studio credits" footer={creditsRefillAt ? `Included credits refill ${fmt(creditsRefillAt)}. Purchased credits never expire.` : undefined}>
          <GroupBlock>
            <View style={s.totalRow}>
              <Text style={s.total}>{credits.total}</Text>
              <Text style={s.meta}>available</Text>
            </View>
            <View style={s.pills}>
              {([['Included', credits.included], ['Welcome', credits.onboarding], ['Purchased', credits.purchased]] as const).map(([label, value]) => (
                <View key={label} style={s.pill}>
                  <Text style={s.pillValue}>{value}</Text>
                  <Text style={s.pillLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </GroupBlock>
        </Group>
      )}

      {costs.length > 0 && (
        <Group title="What things cost">
          <GroupBlock>
            {costs.map(([label, cost]) => (
              <View key={label} style={s.costRow}>
                <Text style={s.costLabel}>{label}</Text>
                <Text style={s.costValue}>{cost} credit{cost === 1 ? '' : 's'}</Text>
              </View>
            ))}
          </GroupBlock>
        </Group>
      )}

      {!isPremium && freeUsage && (
        <Group title="Free plan" footer={`Up to ${freeUsage.itemsLimit} items and ${freeUsage.eventsLimit} calendar events.`}>
          <GroupBlock>
            <View style={s.costRow}>
              <Text style={s.costLabel}>Stylist messages</Text>
              <Text style={s.costValue}>{freeUsage.stylistMessagesUsed} / {freeUsage.stylistMessagesLimit}</Text>
            </View>
          </GroupBlock>
        </Group>
      )}

      <Group>
        {isPremium && <NavRow label="Manage subscription" onPress={manage} />}
        <NavRow label={busy === 'restore' ? 'Restoring…' : 'Restore purchases'} onPress={restore} />
      </Group>
    </SettingsScaffold>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.xl, gap: spacing.xs, alignItems: 'flex-start' },
  eyebrow: { ...typography.text.caption, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: typography.tracking.label, fontWeight: typography.weight.semibold },
  plan: { ...typography.text.editorialTitle, color: colors.foreground },
  meta: { ...typography.text.caption, color: colors.mutedForeground },
  cta: { marginTop: spacing.md, alignSelf: 'stretch', height: 48, borderRadius: radii.action, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  ctaText: { ...typography.text.bodySmall, color: colors.primaryForeground, fontWeight: typography.weight.semibold },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  total: { ...typography.text.editorialHero, color: colors.foreground },
  pills: { flexDirection: 'row', gap: spacing.sm },
  pill: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radii.panel, backgroundColor: colors.surfaceSubtle },
  pillValue: { ...typography.text.body, color: colors.foreground, fontWeight: typography.weight.semibold },
  pillLabel: { ...typography.text.caption, color: colors.mutedForeground },
  costRow: { flexDirection: 'row', justifyContent: 'space-between' },
  costLabel: { ...typography.text.bodySmall, color: colors.foreground },
  costValue: { ...typography.text.bodySmall, color: colors.mutedForeground },
});
