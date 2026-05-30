import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateProfile } from '../../hooks/useProfile';
import { colors, spacing, typography, radii } from '../../theme';

// ── Options ───────────────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  { id: 'minimalist', label: 'Minimalist',    desc: 'Clean lines, neutral, less is more' },
  { id: 'streetwear', label: 'Streetwear',    desc: 'Urban, relaxed, logo-forward' },
  { id: 'bohemian',   label: 'Bohemian',      desc: 'Flowy, layered, eclectic' },
  { id: 'preppy',     label: 'Preppy',        desc: 'Tailored, polished, classic staples' },
  { id: 'grunge',     label: 'Grunge / Edgy', desc: 'Dark, raw, statement pieces' },
  { id: 'vintage',    label: 'Vintage',       desc: 'Retro-inspired, timeless finds' },
];

const OCCASION_OPTIONS = [
  { id: 'casual',       label: 'Casual / Everyday' },
  { id: 'smart_casual', label: 'Smart Casual'       },
  { id: 'work',         label: 'Work / Office'      },
  { id: 'nights_out',   label: 'Nights Out'         },
  { id: 'formal',       label: 'Formal Events'      },
  { id: 'active',       label: 'Active / Gym'       },
  { id: 'travel',       label: 'Travel'             },
];

const PALETTE_OPTIONS = [
  { id: 'neutral',    label: 'Neutrals',      swatch: '#C4B5A5' },
  { id: 'earthy',     label: 'Earthy',        swatch: '#92400E' },
  { id: 'monochrome', label: 'Monochrome',    swatch: '#3F3F46' },
  { id: 'pastels',    label: 'Pastels',       swatch: '#FBBF9B' },
  { id: 'jewel',      label: 'Jewel Tones',   swatch: '#166534' },
  { id: 'bright',     label: 'Bright & Bold', swatch: '#EA580C' },
];

const BUDGET_OPTIONS = [
  { id: 'thrift',  label: 'Thrift-friendly' },
  { id: 'mid',     label: 'Mid-range'       },
  { id: 'premium', label: 'Premium'         },
  { id: 'luxury',  label: 'Luxury'          },
];

const BODY_TYPE_OPTIONS = [
  { id: 'broad_shoulders',   label: 'Broad Shoulders',  desc: 'Upper body is the widest point' },
  { id: 'straight',          label: 'Straight Frame',   desc: 'Shoulders and hips roughly aligned' },
  { id: 'wider_lower',       label: 'Wider Lower Body', desc: 'Hips and thighs are the fullest point' },
  { id: 'balanced',          label: 'Balanced',         desc: 'Defined waist, proportionate build' },
  { id: 'fuller_midsection', label: 'Fuller Midsection',desc: 'Weight carried through the torso' },
  { id: 'petite',            label: 'Compact / Petite', desc: 'Shorter stature or smaller overall scale' },
];

const FIT_OPTIONS = [
  { id: 'relaxed', label: 'Relaxed', desc: 'Loose, comfort-first' },
  { id: 'classic', label: 'Classic', desc: 'True to size, clean lines' },
  { id: 'fitted',  label: 'Fitted',  desc: 'Close to the body' },
];

const SIZING_REGION_OPTIONS = [
  { id: 'US', label: 'US' },
  { id: 'UK', label: 'UK' },
  { id: 'EU', label: 'EU' },
];

const SIZE_TOP_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((v) => v !== id) : [...arr, id];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

function SelectPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.pill, selected && s.pillSelected]}
    >
      {selected && (
        <Ionicons name="checkmark" size={12} color={colors.primaryForeground} style={{ marginRight: 4 }} />
      )}
      <Text style={[s.pillText, selected && s.pillTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SelectCard({
  label,
  desc,
  selected,
  onPress,
}: {
  label: string;
  desc?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.card, selected && s.cardSelected]}
    >
      {selected && (
        <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginBottom: 4 }} />
      )}
      <Text style={[s.cardLabel, selected && s.cardLabelSelected]}>{label}</Text>
      {desc ? <Text style={s.cardDesc}>{desc}</Text> : null}
    </TouchableOpacity>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function StepOccasions({
  occasions,
  setOccasions,
}: {
  occasions: string[];
  setOccasions: (v: string[]) => void;
}) {
  return (
    <View style={s.pillWrap}>
      {OCCASION_OPTIONS.map((opt) => (
        <SelectPill
          key={opt.id}
          label={opt.label}
          selected={occasions.includes(opt.id)}
          onPress={() => setOccasions(toggle(occasions, opt.id))}
        />
      ))}
    </View>
  );
}

function StepStyle({
  stylePreferences,
  setStylePreferences,
}: {
  stylePreferences: string[];
  setStylePreferences: (v: string[]) => void;
}) {
  return (
    <View style={s.twoColGrid}>
      {STYLE_OPTIONS.map((opt) => (
        <SelectCard
          key={opt.id}
          label={opt.label}
          desc={opt.desc}
          selected={stylePreferences.includes(opt.id)}
          onPress={() => setStylePreferences(toggle(stylePreferences, opt.id))}
        />
      ))}
    </View>
  );
}

function StepColorBudget({
  colorPalette,
  setColorPalette,
  budgetRange,
  setBudgetRange,
}: {
  colorPalette: string;
  setColorPalette: (v: string) => void;
  budgetRange: string;
  setBudgetRange: (v: string) => void;
}) {
  return (
    <View style={{ gap: spacing.xl }}>
      <View>
        <SectionLabel>Color palette</SectionLabel>
        <View style={s.twoColGrid}>
          {PALETTE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setColorPalette(opt.id)}
              activeOpacity={0.7}
              style={[s.paletteCard, colorPalette === opt.id && s.cardSelected]}
            >
              <View style={[s.swatch, { backgroundColor: opt.swatch }]} />
              <Text style={[s.cardLabel, colorPalette === opt.id && s.cardLabelSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View>
        <SectionLabel>Budget range</SectionLabel>
        <View style={s.twoColGrid}>
          {BUDGET_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setBudgetRange(opt.id)}
              activeOpacity={0.7}
              style={[s.card, budgetRange === opt.id && s.cardSelected]}
            >
              <Text style={[s.cardLabel, budgetRange === opt.id && s.cardLabelSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function StepBodyFit({
  bodyType,
  setBodyType,
  fitPreference,
  setFitPreference,
}: {
  bodyType: string;
  setBodyType: (v: string) => void;
  fitPreference: string;
  setFitPreference: (v: string) => void;
}) {
  return (
    <View style={{ gap: spacing.xl }}>
      <View>
        <SectionLabel>Body type</SectionLabel>
        <View style={s.twoColGrid}>
          {BODY_TYPE_OPTIONS.map((opt) => (
            <SelectCard
              key={opt.id}
              label={opt.label}
              desc={opt.desc}
              selected={bodyType === opt.id}
              onPress={() => setBodyType(opt.id)}
            />
          ))}
        </View>
      </View>

      <View>
        <SectionLabel>Fit preference</SectionLabel>
        <View style={s.threeColGrid}>
          {FIT_OPTIONS.map((opt) => (
            <SelectCard
              key={opt.id}
              label={opt.label}
              desc={opt.desc}
              selected={fitPreference === opt.id}
              onPress={() => setFitPreference(opt.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function StepLocationSizing({
  location,
  setLocation,
  sizingRegion,
  setSizingRegion,
  sizeTop,
  setSizeTop,
}: {
  location: string;
  setLocation: (v: string) => void;
  sizingRegion: string;
  setSizingRegion: (v: string) => void;
  sizeTop: string;
  setSizeTop: (v: string) => void;
}) {
  return (
    <View style={{ gap: spacing.xl }}>
      <View>
        <SectionLabel>Your location</SectionLabel>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="e.g. London, UK"
          placeholderTextColor={colors.mutedForeground}
          style={s.textInput}
          returnKeyType="done"
        />
        <Text style={s.hint}>Used for weather context and nearby store suggestions</Text>
      </View>

      <View>
        <SectionLabel>Sizing region</SectionLabel>
        <View style={s.regionRow}>
          {SIZING_REGION_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setSizingRegion(opt.id)}
              activeOpacity={0.7}
              style={[s.regionBtn, sizingRegion === opt.id && s.cardSelected]}
            >
              <Text style={[s.regionBtnText, sizingRegion === opt.id && s.cardLabelSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View>
        <SectionLabel>
          Top size{'  '}
          <Text style={{ color: colors.mutedForeground, fontWeight: '400' }}>(optional)</Text>
        </SectionLabel>
        <View style={s.sizeRow}>
          {SIZE_TOP_OPTIONS.map((size) => (
            <TouchableOpacity
              key={size}
              onPress={() => setSizeTop(sizeTop === size ? '' : size)}
              activeOpacity={0.7}
              style={[s.sizeBtn, sizeTop === size && s.cardSelected]}
            >
              <Text style={[s.sizeBtnText, sizeTop === size && s.cardLabelSelected]}>{size}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const STEPS = [
  { title: "What do you dress for?",   desc: "Select all that apply — this shapes every outfit we suggest." },
  { title: "What's your aesthetic?",   desc: "Pick everything that resonates — most people are a mix."     },
  { title: "Colors & budget",          desc: "Two quick picks."                                             },
  { title: "Body & fit",               desc: "Helps us nail the silhouette and cut every time."             },
  { title: "Location & sizing",        desc: "Helps us find items near you in the right size."              },
];

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const updateProfile = useUpdateProfile();

  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [occasions,        setOccasions]        = useState<string[]>([]);
  const [stylePreferences, setStylePreferences] = useState<string[]>([]);
  const [colorPalette,     setColorPalette]     = useState('');
  const [budgetRange,      setBudgetRange]      = useState('');
  const [bodyType,         setBodyType]         = useState('');
  const [fitPreference,    setFitPreference]    = useState('');
  const [location,         setLocation]         = useState('');
  const [sizingRegion,     setSizingRegion]     = useState('');
  const [sizeTop,          setSizeTop]          = useState('');

  const isStepValid = (s: number): boolean => {
    switch (s) {
      case 0: return occasions.length > 0;
      case 1: return stylePreferences.length > 0;
      case 2: return colorPalette !== '' && budgetRange !== '';
      case 3: return bodyType !== '' && fitPreference !== '';
      case 4: return sizingRegion !== '';
      default: return true;
    }
  };

  const animateStep = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const handleSkip = () => {
    updateProfile.mutate({ onboardingComplete: true });
  };

  const handleFinish = () => {
    updateProfile.mutate({
      occasions:       occasions.length > 0        ? occasions        : null,
      stylePreference: stylePreferences.length > 0 ? stylePreferences : null,
      colorPalette:    colorPalette                ? [colorPalette]   : null,
      budgetRange:     budgetRange                 || null,
      bodyType:        bodyType                    || null,
      fitPreference:   fitPreference               || null,
      location:        location.trim()             || null,
      sizingRegion:    sizingRegion                || null,
      sizeTop:         sizeTop                     || null,
      onboardingComplete: true,
    });
  };

  const isLast    = step === STEPS.length - 1;
  const isPending = updateProfile.isPending;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[s.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>

        {/* Header row */}
        <View style={s.headerRow}>
          <View style={s.sparkleWrap}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
          </View>
          <TouchableOpacity
            onPress={handleSkip}
            disabled={isPending}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={s.skipBtn}
          >
            <Text style={s.skipText}>{isPending ? 'Saving…' : 'Skip for now'}</Text>
            <Ionicons name="close" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Title + desc */}
        <Text style={s.title}>{STEPS[step].title}</Text>
        <Text style={s.desc}>{STEPS[step].desc}</Text>

        {/* Progress bar */}
        <View style={s.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[s.progressSegment, i <= step && s.progressSegmentActive]}
            />
          ))}
        </View>

        {/* Step content */}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 0 && (
              <StepOccasions occasions={occasions} setOccasions={setOccasions} />
            )}
            {step === 1 && (
              <StepStyle stylePreferences={stylePreferences} setStylePreferences={setStylePreferences} />
            )}
            {step === 2 && (
              <StepColorBudget
                colorPalette={colorPalette}
                setColorPalette={setColorPalette}
                budgetRange={budgetRange}
                setBudgetRange={setBudgetRange}
              />
            )}
            {step === 3 && (
              <StepBodyFit
                bodyType={bodyType}
                setBodyType={setBodyType}
                fitPreference={fitPreference}
                setFitPreference={setFitPreference}
              />
            )}
            {step === 4 && (
              <StepLocationSizing
                location={location}
                setLocation={setLocation}
                sizingRegion={sizingRegion}
                setSizingRegion={setSizingRegion}
                sizeTop={sizeTop}
                setSizeTop={setSizeTop}
              />
            )}
          </ScrollView>
        </Animated.View>

        {/* Footer buttons */}
        <View style={s.footer}>
          <TouchableOpacity
            onPress={() => animateStep(Math.max(0, step - 1))}
            disabled={step === 0}
            style={[s.footerBtn, s.footerBtnGhost, step === 0 && { opacity: 0 }]}
          >
            <Ionicons name="arrow-back" size={16} color={colors.foreground} />
            <Text style={s.footerBtnGhostText}>Back</Text>
          </TouchableOpacity>

          {!isLast ? (
            <TouchableOpacity
              onPress={() => animateStep(step + 1)}
              disabled={!isStepValid(step)}
              style={[s.footerBtn, s.footerBtnPrimary, !isStepValid(step) && s.footerBtnDisabled]}
            >
              <Text style={s.footerBtnPrimaryText}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleFinish}
              disabled={isPending || !isStepValid(step)}
              style={[s.footerBtn, s.footerBtnPrimary, (isPending || !isStepValid(step)) && s.footerBtnDisabled]}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Text style={s.footerBtnPrimaryText}>Finish</Text>
                  <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sparkleWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skipText: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },
  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  desc: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.secondary,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    minHeight: 44,
  },
  footerBtnGhost: {
    backgroundColor: 'transparent',
  },
  footerBtnGhostText: {
    fontSize: typography.size.md,
    color: colors.foreground,
    fontWeight: typography.weight.medium,
  },
  footerBtnPrimary: {
    backgroundColor: colors.primary,
  },
  footerBtnPrimaryText: {
    fontSize: typography.size.md,
    color: colors.primaryForeground,
    fontWeight: typography.weight.semibold,
  },
  footerBtnDisabled: {
    opacity: 0.4,
  },
  // Pills
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    minHeight: 44,
  },
  pillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  pillTextSelected: {
    color: colors.primaryForeground,
  },
  // Cards (2-col grid)
  twoColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  threeColGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    minHeight: 80,
    justifyContent: 'flex-end',
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  cardLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  cardLabelSelected: {
    color: colors.primary,
  },
  cardDesc: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: 2,
    lineHeight: typography.size.xs * typography.lineHeight.normal,
  },
  // Palette card
  paletteCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  // Section label
  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  // Location
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.white,
    minHeight: 48,
  },
  hint: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  regionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  regionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    minHeight: 48,
    justifyContent: 'center',
  },
  regionBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sizeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    minWidth: 48,
    minHeight: 44,
  },
  sizeBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
});
