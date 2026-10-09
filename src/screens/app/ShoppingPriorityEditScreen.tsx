import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions, usePreventRemove } from '@react-navigation/native';

import { useShoppingChapters } from '../../components/shopping/ShoppingChapterContents';
import { SectionKicker, SpecList, StylistAsk } from '../../components/shopping/ShoppingEditorialParts';
import { ShoppingStyleSwatches } from '../../components/shopping/ShoppingStyleSwatches';
import { ShoppingStyleVisual } from '../../components/shopping/ShoppingStyleVisual';
import { PressableScale } from '../../components/primitives/PressableScale';
import { ShopSubpageHeader } from '../../components/shopping/ShopSubpageHeader';
import { ShoppingPriorityTargetCard } from '../../components/shopping/ShoppingPriorityTargetCard';
import { useItems } from '../../hooks/useItems';
import { useShoppingPriorityEdit } from '../../hooks/useShoppingPriorityEdit';
import { addOutfitToWishlist, useRemoveFromWishlist, useWishlist } from '../../hooks/useWishlist';
import { wearableWardrobe, withoutOutfitCount } from '../../lib/shopClarity';
import { compareAskQuestions, isGuideListingQuestion, shoppingGarmentTitle } from '../../lib/shoppingEditorial';
import { useGlobalAIStylist } from '../../contexts/GlobalAIStylistContext';
import { track } from '../../lib/analytics';
import { displayBudget, targetShoppingNotes, withoutInlineImages, type ShoppingPriorityTarget } from '../../lib/shoppingPriorityEdit';
import { shoppingSurfaces, colors, radii, spacing, typography } from '../../theme';
import type { ShopOutfit } from '../../types/shop';
import type { ShoppingPriorityEditScreenProps } from '../../navigation/types';

/** The sticky tab for the closing questions, alongside one per style. */
const ASK_TAB = '__ask';

export function ShoppingPriorityEditScreen({ navigation, route }: ShoppingPriorityEditScreenProps) {
  const insets = useSafeAreaInsets();
  const { priority, source, origin, briefGeneratedAt } = route.params;
  const edit = useShoppingPriorityEdit(priority, { origin, briefGeneratedAt });
  const { data: items = [] } = useItems();
  const { data: wishlist = [] } = useWishlist();
  const startedAt = useRef(Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openStylist } = useGlobalAIStylist();
  const [savedId, setSavedId] = useState<string | null>(null);
  const removeFromWishlist = useRemoveFromWishlist();
  const [saving, setSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const reduceMotion = useReducedMotion();
  const wearable = useMemo(() => wearableWardrobe(items), [items]);
  const savedFromWishlist = useMemo(() => {
    if (!edit.data || edit.data.status !== 'ready') return undefined;
    return wishlist.find(
      (entry) => entry.outfit.shoppingBrief?.generatedAt === edit.data?.generatedAt,
    );
  }, [edit.data, wishlist]);
  const selectedSavedId = savedId ?? savedFromWishlist?.id;
  const isSaved = Boolean(selectedSavedId);

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

  const { width, fontScale } = useWindowDimensions();
  const chapterNav = useShoppingChapters(`${priority.recommendationKey ?? priority.label}:${edit.data?.generatedAt ?? ''}:${width}:${fontScale}`);
  const [tabsVisible, setTabsVisible] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [tabsHeight, setTabsHeight] = useState(52);
  const chapterTops = useRef(new Map<string, number>());
  const comparisonBottom = useRef(Number.POSITIVE_INFINITY);
  const closingTop = useRef(Number.POSITIVE_INFINITY);
  const onGuideScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    setTabsVisible(y > comparisonBottom.current - tabsHeight);
    let current: string | null = null;
    for (const [key, top] of [...chapterTops.current].sort((a, b) => a[1] - b[1])) if (top <= y + tabsHeight + 1) current = key;
    // The closing questions count as reached once they're well into view,
    // since the page often can't scroll them all the way up to the tabs.
    const { layoutMeasurement, contentSize } = event.nativeEvent;
    if (closingTop.current <= y + tabsHeight + 1 || (!!contentSize && closingTop.current < contentSize.height && y + (layoutMeasurement?.height ?? 0) >= contentSize.height - 1)) current = ASK_TAB;
    setActiveKey(current);
  }, [tabsHeight]);
  const guideIdentity = `${priority.recommendationKey ?? priority.label}:${edit.data?.generatedAt ?? ''}`;
  const lastGuideIdentity = useRef('');
  useEffect(() => {
    if (!edit.data || lastGuideIdentity.current === guideIdentity) return;
    lastGuideIdentity.current = guideIdentity;
    setSavedId(null);
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
      saving
    )
      return;
    if (selectedSavedId) {
      // Tapping "Saved" again undoes the save. The removal is optimistic, so
      // the bookmark clears immediately and comes back if the server refuses.
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = null;
      setShowSaveToast(false);
      setSavedId(null);
      removeFromWishlist.mutate(selectedSavedId);
      track('shopping_brief_edit_unsaved', { category: priority.category, source: source ?? 'shopping_brief' });
      return;
    }
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
      const entry = await addOutfitToWishlist(outfit, null, priority.recommendationKey);
      setSavedId(entry.id);
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
  }, [edit.data, priority, removeFromWishlist, saving, selectedSavedId, showSavedToast, source]);

  if (edit.isLoading) {
    // The guide is one generation, so nothing real can stream in early — but
    // the title and the brief's own context are known now, so the page opens
    // as itself and only the parts still being written are placeholders.
    const loadingIntro = withoutOutfitCount(priority.context, priority.impactScore);
    return (
      <GuideSurface>
        <View style={[styles.fixedBar, { paddingTop: insets.top + spacing.sm, paddingLeft: spacing.page + insets.left, paddingRight: spacing.page + insets.right }]}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={source === 'home_daily_look' ? 'Back to Home' : 'Back'} style={({ pressed }) => [styles.backControl, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={colors.foreground} /></Pressable>
          <Text style={styles.barTitle}>Shopping guide</Text>
        </View>
        <ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingLeft: spacing.page + insets.left, paddingRight: spacing.page + insets.right, paddingBottom: insets.bottom + spacing.xxxl }]}>
          <View style={styles.guideOpening}>
            <Text accessibilityRole="header" style={styles.guideTitle}>{shoppingGarmentTitle(priority.label)}</Text>
            {loadingIntro ? <Text style={styles.lede}>{loadingIntro}</Text> : null}
          </View>
          <View style={styles.skeleton} accessibilityLabel="Curating your options" accessibilityState={{ busy: true }} accessibilityLiveRegion="polite">
            <View style={styles.loadingRow}><ActivityIndicator size="small" color={shoppingSurfaces.olive.accent} /><Text style={styles.loadingText}>Curating styles for your wardrobe…</Text></View>
            <View style={styles.skeletonSwatches}>{[0, 1, 2].map(key => <View key={key} style={styles.skeletonTile}><View style={styles.skeletonSwatch} /><View style={[styles.skeletonLine, { width: '80%' }]} /><View style={[styles.skeletonLine, { width: '50%' }]} /></View>)}</View>
            <View style={styles.skeletonChapter}>
              <View style={[styles.skeletonLine, { width: '45%', height: 22 }]} />
              <View style={styles.skeletonRail}><View style={styles.skeletonHero} /><View style={styles.skeletonHero} /></View>
              <View style={[styles.skeletonLine, { width: '92%' }]} />
              <View style={[styles.skeletonLine, { width: '76%' }]} />
            </View>
          </View>
        </ScrollView>
      </GuideSurface>
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
      <GuideSurface>
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
            backLabel={source === 'home_daily_look' ? 'Back to Home' : 'Back'}
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
      </GuideSurface>
    );
  }

  if (data.status === 'no_buy') {
    return (
      <GuideSurface>
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
            backLabel={source === 'home_daily_look' ? 'Back to Home' : 'Back'}
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
      </GuideSurface>
    );
  }

  const directionCount = data.targets.length;
  const intro = withoutOutfitCount(data.summary || priority.context, priority.impactScore);
  const budgets = data.targets.map((target: ShoppingPriorityTarget) => displayBudget(target.priceRange));
  const sharedBudget = budgets.length && budgets.every(budget => budget && budget === budgets[0]) ? budgets[0] : null;
  const noteSets = data.targets.map(targetShoppingNotes);
  const sharedNotes = directionCount > 1 && noteSets[0].length && noteSets.every(notes => notes.join('|').toLowerCase() === noteSets[0].join('|').toLowerCase()) ? noteSets[0] : null;
  // Chapters land with their heading just below the style tabs, which are
  // showing by the time the scroll settles; the chapter's top padding tucks under them.
  const jumpTo = (key: string) => key === ASK_TAB
    ? chapterNav.scroll.current?.scrollTo({ y: Math.max(0, closingTop.current - tabsHeight), animated: !reduceMotion })
    : chapterNav.jump(key, directionCount > 1 ? tabsHeight + spacing.lg - spacing.chapter : 0, chapterTops.current.get(key));
  const askStylist = (initialQuery?: string, focusTargetKey?: string) =>
    openStylist({
      source: 'shop',
      // Listing questions ("a cheaper take…") go unmoded so the server routes
      // them to a shop list; styling questions stay advice.
      ...(initialQuery && isGuideListingQuestion(initialQuery) ? {} : { initialMode: 'advice' as const }),
      initialQuery,
      context: { kind: 'shopping_brief_edit', priority, targets: data.targets, ...(focusTargetKey ? { focusTargetKey } : {}) },
    });

  return (
    <GuideSurface>
      <View style={[styles.fixedBar, { paddingTop: insets.top + spacing.sm, paddingLeft: spacing.page + insets.left, paddingRight: spacing.page + insets.right }]}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={source === 'home_daily_look' ? 'Back to Home' : 'Back'} style={({ pressed }) => [styles.backControl, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={colors.foreground} /></Pressable>
        <Text style={styles.barTitle}>Shopping guide</Text>
        <SaveEditAction saving={saving} isSaved={isSaved} onPress={saveEdit} />
      </View>
      <View style={styles.scrollArea}>
      <ScrollView ref={chapterNav.scroll} contentInsetAdjustmentBehavior="never" onScroll={onGuideScroll} scrollEventThrottle={32}
        contentContainerStyle={[styles.content, { paddingLeft: spacing.page + insets.left, paddingRight: spacing.page + insets.right, paddingBottom: insets.bottom + spacing.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View ref={chapterNav.content} collapsable={false}>
        <View style={styles.guideOpening}>
          <Text accessibilityRole="header" style={styles.guideTitle}>{displayHeadline}</Text>
          {intro ? <Text style={styles.lede}>{intro}</Text> : null}
          {sharedBudget ? <Text style={styles.meta}>Suggested budget · {sharedBudget}{directionCount > 1 ? ' for each style' : ''}</Text> : null}
        </View>
        {edit.isError ? <Text style={styles.body}>You’re reading your saved guide. We couldn’t refresh it just now.</Text> : null}
        {directionCount > 1 ? <View style={styles.contents} onLayout={event => { const { y, height } = event.nativeEvent.layout; comparisonBottom.current = y + height; }}>
          <SectionKicker title={`${directionCount} styles to compare`} />
          <ShoppingStyleSwatches targets={data.targets} wardrobe={wearable} onSelect={jumpTo}
            budgets={sharedBudget ? undefined : Object.fromEntries(data.targets.map((target, index) => [target.key, budgets[index] || undefined]))} />
        </View> : null}
        {sharedNotes ? <View style={styles.contents}>
          <SectionKicker title="What to look for" />
          <SpecList notes={sharedNotes} />
        </View> : null}
        {data.targets.map((target, index) => (
          <View
            key={target.key}
            collapsable={false}
            onLayout={event => { chapterTops.current.set(target.key, event.nativeEvent.layout.y); }}
            ref={node => { if (node) chapterNav.chapters.current.set(target.key, node); else chapterNav.chapters.current.delete(target.key); }}
          >
            <ShoppingPriorityTargetCard editorial
              headingRef={node => { if (node) chapterNav.headings.current.set(target.key, node); else chapterNav.headings.current.delete(target.key); }}
              target={target}
              offerContext={{ reference: data.commerceReference, targetKey: target.key, surface: 'shopping_guide' }}
              onRetryOffers={() => void edit.refreshOffers()}
              index={index + 1}
              wardrobe={wearable}
              isLast={index === directionCount - 1}
              hideCriteria={!!sharedNotes}
              showBudget={!sharedBudget}
              onAsk={question => askStylist(question, target.key)}
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
        {directionCount > 1 ? <View style={styles.closing} onLayout={event => { closingTop.current = event.nativeEvent.layout.y; }}>
          <StylistAsk title="Still deciding?" questions={compareAskQuestions(data.targets)} openLabel="Ask about this guide" onAsk={question => askStylist(question)} />
        </View> : null}
        </View>
      </ScrollView>
      {tabsVisible && directionCount > 1 ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(160)}
          exiting={reduceMotion ? undefined : FadeOut.duration(120)}
          style={styles.tabs}
          onLayout={event => setTabsHeight(event.nativeEvent.layout.height)}
        >
          <View accessibilityRole="tablist" style={[styles.tabsRow, { paddingLeft: spacing.page + insets.left, paddingRight: spacing.page + insets.right }]}>
            {[...data.targets.map((target, index) => ({ key: target.key, label: String(index + 1).padStart(2, '0'), title: target.title, target })), { key: ASK_TAB, label: 'Ask', title: 'Compare styles with your stylist', target: null }].map(tab => {
              const selected = activeKey === tab.key;
              return <Pressable key={tab.key} onPress={() => jumpTo(tab.key)}
                accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={tab.title}
                style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.tabPressed]}>
                <View style={[styles.tabThumb, selected && styles.tabThumbSelected]}>
                  {tab.target ? <ShoppingStyleVisual plain fill target={tab.target} /> : <Ionicons name="chatbubble-outline" size={15} color={colors.mutedForeground} />}
                </View>
                <Text style={[styles.tabNumber, selected && styles.tabTextSelected]} numberOfLines={1}>{tab.label}</Text>
              </Pressable>;
            })}
          </View>
        </Animated.View>
      ) : null}
      </View>
      {showSaveToast ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.duration(160)}
          exiting={reduceMotion ? undefined : FadeOutDown.duration(120)}
          style={[styles.saveToast, { bottom: insets.bottom + spacing.lg }]}
          accessibilityLiveRegion="polite"
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.saveToastText}>Saved to your wishlist</Text>
          {selectedSavedId ? <PressableScale accessibilityRole="button" accessibilityLabel="View wishlist list" contentStyle={styles.toastAction} onPress={() => navigation.navigate('Wishlist', { section: 'lists', selectedId: selectedSavedId })}>
            <Text style={styles.link}>View</Text>
          </PressableScale> : null}
        </Animated.View>
      ) : null}
    </GuideSurface>
  );
}

function GuideSurface({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={styles.screen}>{children}<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.safeAreaScrim, { height: insets.top }]} /></View>;
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
  return (
    <PressableScale
      motion="crisp"
      scaleTo={0.94}
      contentStyle={styles.saveIcon}
      onPress={() => void onPress()}
      disabled={saving}
      haptic
      accessibilityRole="button"
      accessibilityLabel={saving ? 'Saving list' : isSaved ? 'List saved in wishlist' : 'Save list'}
      accessibilityHint={isSaved ? 'Removes this guide from your wishlist' : 'Adds this guide to your wishlist'}
      accessibilityState={{ selected: isSaved, busy: saving, disabled: saving }}
    >
      {saving ? (
        <ActivityIndicator size="small" color={shoppingSurfaces.olive.accent} />
      ) : (
        <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={shoppingSurfaces.olive.accent} />
      )}
      <Text style={styles.saveLabel}>{isSaved ? 'Saved' : 'Save guide'}</Text>
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
    <GuideSurface>
      <ScrollView
        contentContainerStyle={[
          styles.stateContent,
          { paddingBottom: insets.bottom + spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ShopSubpageHeader
          editorialSize
          backLabel="Back"
          compact
          eyebrow={eyebrow}
          title={title}
          onBack={onBack}
          style={styles.fullBleedHeader}
        />
        <View style={styles.stateCard}>{children}</View>
      </ScrollView>
    </GuideSurface>
  );
}

const styles = StyleSheet.create({
  safeAreaScrim: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, backgroundColor: colors.background },
  fixedBar: { backgroundColor: colors.background, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backControl: { width: 44, height: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  barTitle: { ...typography.text.label, color: colors.foreground, flex: 1 },
  pressed: { backgroundColor: colors.surfaceSelected },
  guideOpening: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  guideTitle: { ...typography.text.editorialHero, color: colors.foreground },
  lede: { ...typography.text.editorialBody, color: colors.foreground },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
  contents: { gap: spacing.md, paddingBottom: spacing.subsection },
  closing: { gap: spacing.md, paddingTop: spacing.chapter },
  link: { ...typography.text.label, color: shoppingSurfaces.olive.accent },
  toastAction: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  saveIcon: { minWidth: 44, height: 44, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  saveLabel: { ...typography.text.label, color: shoppingSurfaces.olive.accent },
  skeleton: { gap: spacing.lg },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skeletonTile: { flex: 1, gap: spacing.sm },
  skeletonChapter: { gap: spacing.md, paddingTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  skeletonRail: { flexDirection: 'row', gap: spacing.md, overflow: 'hidden' },
  skeletonHero: { width: '72%', aspectRatio: 0.8, backgroundColor: colors.surfaceSubtle, borderRadius: radii.photo },
  scrollArea: { flex: 1 },
  tabs: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: shoppingSurfaces.canvas, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tabsRow: { flexDirection: 'row' },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabSelected: { borderBottomColor: colors.foreground },
  tabPressed: { opacity: 0.6 },
  tabThumb: { width: 28, height: 35, borderRadius: radii.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tabThumbSelected: { borderWidth: 1.5, borderColor: colors.foreground },
  tabNumber: { ...typography.text.meta, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  tabTextSelected: { color: colors.foreground },
  skeletonLine: { height: 14, backgroundColor: colors.surfaceSubtle, borderRadius: radii.sm },
  skeletonSwatches: { flexDirection: 'row', gap: spacing.sm },
  skeletonSwatch: { aspectRatio: 0.8, backgroundColor: colors.surfaceSubtle, borderRadius: radii.photo },
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
