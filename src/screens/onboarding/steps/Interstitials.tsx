import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { colors, radii, spacing, typography } from '../../../theme';
import {
  BODY_TYPE_OPTIONS,
  BUDGET_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  FIT_SILHOUETTE_OPTIONS,
  OCCASION_OPTIONS,
  PALETTE_OPTIONS,
  STYLE_OPTIONS,
  optionLabel,
  optionLabels,
} from '../../../lib/profileOptions';
import type { OnboardingValues } from '../useOnboardingForm';

/** Bundled still-life. Source and licence: assets/onboarding/ATTRIBUTION.md */
const HERO = require('../../../../assets/onboarding/profile-hero.jpg');

/** Decorative only — deliberately kept out of the accessibility tree. */
function Hero({ height = 132 }: { height?: number }) {
  return (
    <View
      style={[s.hero, { height }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        source={HERO}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        transition={220}
        cachePolicy="memory-disk"
      />
    </View>
  );
}

/**
 * The gate between the required questions and the optional ones.
 *
 * Its whole job is to make "I'm done" a legitimate, unpunished answer — the
 * flow is only allowed to keep asking because stopping here is free.
 */
export function DeepDiveGate({ onboardingName }: { onboardingName: string }) {
  return (
    <View style={s.centered}>
      <Hero height={150} />
      <View style={s.medallion}>
        <Ionicons name="checkmark" size={30} color={colors.primary} />
      </View>
      <Text style={s.gateEyebrow}>PROFILE SAVED</Text>
      <Text style={s.gateTitle}>
        {onboardingName ? `You're set, ${onboardingName}.` : "You're all set."}
      </Text>
      <Text style={s.gateBody}>
        That's everything we need to start styling you. Three more questions will sharpen it a lot —
        what you never want to wear, how you shop, and the rest of your sizes.
      </Text>
      <Text style={s.gateAside}>Skip them and you'll find them in your profile whenever you want.</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

/** The last screen: the profile read back, so the answers feel like they landed. */
export function SummaryStep({ values }: { values: OnboardingValues }) {
  const list = (v: string[]) => v.join(', ');

  return (
    <View style={s.step}>
      <Hero />
      <View style={s.card}>
        <Text style={s.cardEyebrow}>STYLE PROFILE</Text>
        <Text style={s.cardTitle}>{values.displayName || 'Your profile'}</Text>

        <View style={s.rows}>
          <SummaryRow label="Cut" value={optionLabel(FIT_PREFERENCE_OPTIONS, values.fitPreference)} />
          <SummaryRow label="Aesthetic" value={list(optionLabels(STYLE_OPTIONS, values.stylePreference))} />
          <SummaryRow label="Dresses for" value={list(optionLabels(OCCASION_OPTIONS, values.occasions))} />
          <SummaryRow label="Palette" value={list(optionLabels(PALETTE_OPTIONS, values.colorPalette))} />
          <SummaryRow label="Budget" value={list(optionLabels(BUDGET_OPTIONS, values.budgetRange))} />
          <SummaryRow label="Proportions" value={list(optionLabels(BODY_TYPE_OPTIONS, values.bodyType))} />
          <SummaryRow label="Fit" value={optionLabel(FIT_SILHOUETTE_OPTIONS, values.fitSilhouette)} />
          <SummaryRow label="Avoids" value={list(values.styleAvoids)} />
          <SummaryRow label="Shops" value={list(values.retailers)} />
          <SummaryRow
            label="Sizes"
            value={[
              values.sizeTop && `Top ${values.sizeTop}`,
              values.sizeBottom && `Waist ${values.sizeBottom}`,
              values.sizeShoe && `Shoe ${values.sizeShoe}`,
              values.sizeDress && `Dress ${values.sizeDress}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
          <SummaryRow label="Home" value={values.location} />
        </View>
      </View>

      <Text style={s.footnote}>
        Everything here is editable from your profile, and your stylist keeps learning from what you
        wear and save.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  step: { gap: spacing.lg },
  centered: { alignItems: 'center', paddingHorizontal: spacing.sm },
  hero: {
    width: '100%',
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  medallion: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSelected,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  gateEyebrow: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    letterSpacing: 1.4,
    marginBottom: spacing.sm,
  },
  gateTitle: {
    fontFamily: typography.family.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  gateBody: {
    fontSize: typography.size.md,
    lineHeight: 23,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 330,
  },
  gateAside: {
    fontSize: typography.size.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceElevated,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primary,
    letterSpacing: 1.1,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: colors.foreground,
    marginBottom: spacing.lg,
  },
  rows: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowLabel: {
    width: 96,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingTop: 2,
  },
  rowValue: {
    flex: 1,
    fontSize: typography.size.sm,
    lineHeight: 19,
    color: colors.foreground,
  },
  footnote: {
    fontSize: typography.size.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
    paddingHorizontal: spacing.xs,
  },
});
