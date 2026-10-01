import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions, usePreventRemove } from '@react-navigation/native';

import { PressableScale } from '../../components/primitives/PressableScale';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { ShoppingPriorityTargetCard } from '../../components/shopping/ShoppingPriorityTargetCard';
import { useItems } from '../../hooks/useItems';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { addOutfitToWishlist, useWishlist } from '../../hooks/useWishlist';
import { wearableWardrobe, withoutOutfitCount } from '../../lib/shopClarity';
import { shoppingGarmentTitle, styleFollowupQuestions } from '../../lib/shoppingEditorial';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { track } from '../../lib/analytics';
import { shoppingPriorityTargetDisplayTitle, withoutInlineImages } from '../../lib/shoppingPriorityEdit';
import { shoppingSurfaces, colors, radii, spacing, typography } from '../../theme';
import type { ShopOutfit } from '../../types/shop';
import type { ShoppingPriorityEditScreenProps } from '../../navigation/types';

export function ShoppingPriorityEditScreen({ navigation, route }: ShoppingPriorityEditScreenProps) {
  const insets = useSafeAreaInsets();
  const { priority, source, origin, briefGeneratedAt } = route.params;
  const edit = useShoppingPriorityEdit(priority, { origin, briefGeneratedAt });
  const { data: items = [] } = useItems();
  const { data: wishlist = [] } = useWishlist();
  const startedAt = useRef(Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const openingKey = useRef<string | null>(null);
  const { openStylist } = useGlobalAIStylist();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [savedLocally, setSavedLocally] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const reduceMotion = useReducedMotion();
  const wearable = useMemo(() => wearableWardrobe(items), [items]);
  const savedFromWishlist = useMemo(() => {
    if (!edit.data || edit.data.status !== 'ready') return false;
    return wishlist.some(
      (entry) => entry.outfit.shoppingBrief?.generatedAt === edit.data?.generatedAt,
    );
  }, [edit.data, wishlist]);
  const isSaved = savedLocally || savedFromWishlist;

  useEffect(() => {
    track('shopping_brief_edit_opened', {
      category: priority.category,
      reason: priority.reason,
      rank: priority.priority,
      source: source ?? 'shopping_brief',
    });
  }, [priority.category, priority.priority, priority.reason, source]);

  useEffect(() => {
    if (edit.isError)
      track('shopping_brief_edit_generation_failed', {
        category: priority.category,
        reason: priority.reason,
        rank: priority.priority,
        source: source ?? 'shopping_brief',
        latencyMs: Date.now() - startedAt.current,
      });
    if (edit.data)
      track('shopping_brief_edit_loaded', {
        category: priority.category,
        reason: priority.reason,
        rank: priority.priority,
        source: source ?? 'shopping_brief',
        outcome: edit.data.status,
        targetCount: edit.data.targets.length,
        latencyMs: Date.now() - startedAt.current,
      });
  }, [edit.data, edit.isError, priority, source]);

  const guideIdentity = `${priority.recommendationKey ?? priority.label}:${edit.data?.generatedAt ?? ''}`;
  const lastGuideIdentity = useRef('');
  useEffect(() => {
    if (!edit.data || lastGuideIdentity.current === guideIdentity) return;
    lastGuideIdentity.current = guideIdentity;
    setSavedLocally(false);
    setExpandedKey(edit.data.targets.length === 1 ? edit.data.targets[0].key : null);
  }, [guideIdentity, edit.data]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Opened from Home's Today's Look: backing or swiping out should land on Home,
  // not on whatever the Shop stack happens to hold beneath this screen.
  const returnsHome = source === 'home_daily_look';
  const [returningHome, setReturningHome] = useState(false);
  usePreventRemove(returnsHome && !returningHome, () => {
    setReturningHome(true);
  });
  useEffect(() => {
    if (!returningHome) return;
    const timeout = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: 'ShopMain' }] });
      navigation.dispatch(CommonActions.navigate({ name: 'Home' }));
    }, 0);
    return () => clearTimeout(timeout);
  }, [navigation, returningHome]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('ShoppingBriefDetail');
  }, [navigation]);

  const guideEyebrow = 'YOUR SHOPPING GUIDE';

  const showSavedToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setShowSaveToast(true);
    toastTimer.current = setTimeout(() => {
      setShowSaveToast(false);
      toastTimer.current = null;
    }, 2200);
  }, []);

  const saveEdit = useCallback(async () => {
    if (
      !edit.data ||
      edit.data.status !== 'ready' ||
      edit.data.targets.length < 1 ||
      edit.data.targets.length > 5 ||
      isSaved ||
      saving
    )
      return;
    const outfit: ShopOutfit = {
      recommendationType: 'list',
      source: 'shopping_brief',
      shoppingBrief: withoutInlineImages(edit.data),
      intro: shoppingGarmentTitle(priority.label),
      city: '',
      items: [],
      totalBudget: edit.data.targets.map((target) => target.priceRange).join(' · '),
      audioSummary: edit.data.summary,
    };
    try {
      setSaving(true);
      await addOutfitToWishlist(outfit, null, priority.recommendationKey);
      setSavedLocally(true);
      showSavedToast();
      track('shopping_brief_edit_saved', {
        category: priority.category,
        reason: priority.reason,
        rank: priority.priority,
        source: source ?? 'shopping_brief',
        targetCount: edit.data.targets.length,
      });
    } catch {
      track('shopping_brief_edit_save_failed', { category: priority.category });
      Alert.alert("Couldn't save this guide", 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
  }, [edit.data, isSaved, priority, saving, showSavedToast, source]);

  if (edit.isLoading) {
    return (
      <StateScreen onBack={goBack} eyebrow={guideEyebrow} title="Building your guide">
        <ActivityIndicator color={colors.primary} />
        <Text selectable style={styles.loadingText}>
          Curating your options…
        </Text>
      </StateScreen>
    );
  }

  if (!edit.data) {
    return (
      <StateScreen onBack={goBack} eyebrow={guideEyebrow} title="Your guide is unavailable">
        <Ionicons name="cloud-offline-outline" size={28} color={colors.primary} />
        <Text selectable style={styles.stateTitle}>
          Try again when you’re connected
        </Text>
        <Text selectable style={styles.stateCopy}>
          We couldn’t build the options just now. Your Shopping Brief is unchanged.
        </Text>
        <PressableScale
          contentStyle={styles.primaryButton}
          onPress={() => {
            track('shopping_brief_edit_retry', { category: priority.category });
            void edit.refetch();
          }}
          accessibilityRole="button"
          accessibilityLabel="Retry building this guide"
        >
          <Text style={styles.primaryButtonText}>Try again</Text>
        </PressableScale>
      </StateScreen>
    );
  }

  const data = edit.data;
  const displayHeadline = shoppingGarmentTitle(priority.label);
  if (data.status === 'no_buy' && data.briefUpdated && data.updatedBrief) {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.stateContent,
            { paddingBottom: insets.bottom + spacing.xxxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ShopSubpageHeader
            eyebrow={guideEyebrow}
            editorialSize
            backLabel="Back to Shopping Brief"
            title="Your brief was updated"
            subtitle={data.summary}
            onBack={goBack}
            style={styles.fullBleedHeader}
          />
          <View style={styles.noBuyCard} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle-outline" size={30} color={colors.primary} />
            <Text selectable style={styles.noBuyTitle}>
              This priority is already covered
            </Text>
            <Text selectable style={styles.body}>
              {data.noBuyReason}
            </Text>
            <PressableScale
              contentStyle={styles.primaryButton}
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="View updated Shopping Brief"
            >
              <Text style={styles.primaryButtonText}>View updated brief</Text>
              <Ionicons name="arrow-forward" size={15} color={shoppingSurfaces.olive.accent} />
            </PressableScale>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (data.status === 'no_buy') {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.stateContent,
            { paddingBottom: insets.bottom + spacing.xxxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ShopSubpageHeader
            eyebrow={guideEyebrow}
            editorialSize
            backLabel="Back to Shopping Brief"
            title={displayHeadline}
            subtitle={data.summary}
            onBack={goBack}
            style={styles.fullBleedHeader}
          />
          <View style={styles.noBuyCard}>
            <Ionicons name="checkmark-circle-outline" size={30} color={colors.primary} />
            <Text selectable style={styles.noBuyTitle}>
              You can wait
            </Text>
            <Text selectable style={styles.body}>
              {data.noBuyReason}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const directionCount = data.targets.length;
  const intro = withoutOutfitCount(data.summary || priority.context, priority.impactScore);
  const askStylist = (initialQuery?: string) =>
    openStylist({
      source: 'shop',
      initialMode: 'advice',
      initialQuery,
      context: { kind: 'shopping_brief_edit', priority, targets: data.targets },
    });

  return (
    <View style={styles.screen}>
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: spacing.page,
          backgroundColor: shoppingSurfaces.canvas,
        }}
      >
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Shopping Brief"
          style={{ minHeight: 44, minWidth: 44, alignSelf: 'flex-start', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={23} color={colors.foreground} />
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}>
          <Text style={styles.eyebrow}>{guideEyebrow}</Text>
          <Text
            accessibilityRole="header"
            style={{ ...typography.text.editorialTitle, color: colors.foreground }}
          >
            {displayHeadline}
          </Text>
          <Text selectable style={styles.body}>
            {intro}
          </Text>
          {edit.isError ? (
            <Text style={styles.body}>
              You’re reading your saved guide. We couldn’t refresh it just now.
            </Text>
          ) : null}
        </View>
        <Text accessibilityRole="header" style={styles.guideIntro}>
          {directionCount === 1 ? 'A style to consider' : 'Styles to consider'}
        </Text>
        {data.targets.map((target, index) => (
          <View
            key={target.key}
            onLayout={(event) => {
              if (openingKey.current !== target.key) return;
              openingKey.current = null;
              const top = event.nativeEvent.layout.y;
              if (top < scrollY.current)
                scrollRef.current?.scrollTo({ y: top, animated: !reduceMotion });
            }}
          >
            <ShoppingPriorityTargetCard
              target={target}
              index={index + 1}
              wardrobe={wearable}
              displayTitle={shoppingPriorityTargetDisplayTitle(target.title, priority.label)}
              isLast={index === directionCount - 1}
              expanded={expandedKey === target.key}
              onToggle={() => {
                openingKey.current = expandedKey === target.key ? null : target.key;
                setExpandedKey(expandedKey === target.key ? null : target.key);
              }}
              onSaveFind={() => {
                track('shopping_brief_save_find_tapped', {
                  category: priority.category,
                  targetKey: target.key,
                });
                navigation.navigate('ShoppingCamera');
              }}
            />
          </View>
        ))}
        <View
          style={{
            gap: spacing.sm,
            paddingVertical: spacing.xl,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.hairline,
          }}
        >
          <Pressable
            onPress={() => askStylist()}
            accessibilityRole="button"
            accessibilityLabel="Ask your stylist"
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ ...typography.text.label, color: shoppingSurfaces.olive.accent }}>
              Ask your stylist →
            </Text>
          </Pressable>
          {styleFollowupQuestions(data.targets).map((question) => (
            <Pressable
              key={question}
              onPress={() => askStylist(question)}
              accessibilityRole="button"
              accessibilityLabel={question}
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={styles.body}>{question}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.saveBand}>
          <SaveEditAction saving={saving} isSaved={isSaved} onPress={saveEdit} />
        </View>
      </ScrollView>
      {showSaveToast ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.duration(160)}
          exiting={reduceMotion ? undefined : FadeOutDown.duration(120)}
          style={[styles.saveToast, { bottom: insets.bottom + spacing.lg }]}
          accessibilityLiveRegion="polite"
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.saveToastText}>Added to Saved recommendations</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function SaveEditAction({
  saving,
  isSaved,
  onPress,
}: {
  saving: boolean;
  isSaved: boolean;
  onPress: () => Promise<void>;
}) {
  const label = saving ? 'Saving…' : isSaved ? 'Saved' : 'Save this guide';

  return (
    <PressableScale
      motion="crisp"
      scaleTo={0.985}
      style={styles.saveButton}
      contentStyle={[styles.saveAction, isSaved && styles.saveActionSaved]}
      onPress={() => void onPress()}
      disabled={saving || isSaved}
      haptic={!isSaved}
      accessibilityRole="button"
      accessibilityLabel={
        saving ? 'Saving guide' : isSaved ? 'In Saved recommendations' : 'Save this guide'
      }
      accessibilityHint={isSaved ? undefined : 'Adds this guide to Saved recommendations'}
      accessibilityState={{ selected: isSaved, busy: saving, disabled: saving || isSaved }}
    >
      {saving ? (
        <ActivityIndicator size="small" color={shoppingSurfaces.olive.accent} />
      ) : (
        <Ionicons
          name={isSaved ? 'checkmark' : 'bookmark-outline'}
          size={18}
          color={shoppingSurfaces.olive.accent}
        />
      )}
      <Text style={[styles.saveActionText, { color: shoppingSurfaces.olive.accent }]}>{label}</Text>
    </PressableScale>
  );
}

function StateScreen({
  children,
  onBack,
  eyebrow,
  title,
}: {
  children: ReactNode;
  onBack: () => void;
  eyebrow: string;
  title: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.stateContent,
          { paddingBottom: insets.bottom + spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ShopSubpageHeader
          editorialSize
          backLabel="Back to Shopping Brief"
          compact
          eyebrow={eyebrow}
          title={title}
          onBack={onBack}
          style={styles.fullBleedHeader}
        />
        <View style={styles.stateCard}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...typography.text.eyebrowLarge, color: shoppingSurfaces.olive.accent },
  guideIntro: { ...typography.text.label, color: colors.inkSubtle },
  screen: { flex: 1, backgroundColor: shoppingSurfaces.canvas },
  content: { paddingHorizontal: spacing.page },
  fullBleedHeader: {
    marginHorizontal: -spacing.page,
    paddingHorizontal: spacing.page,
    backgroundColor: shoppingSurfaces.canvas,
  },
  stateContent: { flexGrow: 1, paddingHorizontal: spacing.page, gap: spacing.xl },
  stateCard: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingText: { ...typography.text.body, color: colors.mutedForeground },
  stateTitle: { ...typography.text.sectionTitle, color: colors.foreground },
  stateCopy: { ...typography.text.body, textAlign: 'center', color: colors.mutedForeground },
  body: { ...typography.text.body, color: colors.mutedForeground },
  saveBand: {
    paddingVertical: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  noBuyCard: { paddingVertical: spacing.lg, gap: spacing.sm },
  noBuyTitle: { ...typography.text.sectionTitle, color: colors.foreground },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.foreground,
  },
  primaryButtonText: { ...typography.text.label, color: colors.primaryForeground },
  saveButton: { alignSelf: 'flex-start' },
  saveAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  saveActionSaved: { opacity: 0.7 },
  saveActionText: { ...typography.text.label, color: shoppingSurfaces.olive.accent },
  saveToast: {
    position: 'absolute',
    left: spacing.page,
    right: spacing.page,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  saveToastText: { flex: 1, ...typography.text.bodySmall, color: colors.foreground },
});
