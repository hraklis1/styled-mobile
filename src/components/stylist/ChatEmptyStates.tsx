import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from '../../lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { CurrentWeather } from '../../hooks/useWeather';
import { compareAskQuestions, styleAskQuestions, styleName } from '../../lib/shoppingEditorial';
import { displayBudget } from '../../lib/shoppingPriorityEdit';
import { ShoppingStyleVisual } from '../shopping/ShoppingStyleVisual';
import { buildStylistStarters, buildTodayPrompt, type StylistStarter } from './stylist-empty-state';
import { colors, spacing } from '../../theme';
import type { StylistWorkflow } from '../../features/stylist/types';
import { GuideContext, guideFocus } from './ChatModel';
import { styles } from './ChatStyles';

// ── GuideEmptyState ──────────────────────────────────────────────────────────
// Opened from a shopping guide: say what is being asked about before anything is sent.

export function guidePlaceholder(context: GuideContext) {
  const focus = guideFocus(context);
  return focus ? `Ask about the ${styleName(focus)}…` : 'Ask about this shopping guide…';
}

// The style (or whole guide) a guide-launched chat is about. Shown in the empty
// state and kept pinned above the thread once messages exist, so a chip tapped
// on the guide still reads as being about that style.
export function GuideContextCard({ context }: { context: GuideContext }) {
  const focus = guideFocus(context);
  const shown = focus ? [focus] : context.targets;
  const budget = focus ? displayBudget(focus.priceRange) : null;
  return (
    <View style={styles.guideCard} accessible accessibilityLabel={`Asking about ${focus ? focus.title : context.priority.label}`}>
      <View style={styles.guideThumbs}>
        {shown.slice(0, 3).map(target => (
          <View key={target.key} style={styles.guideThumb}><ShoppingStyleVisual plain fill target={target} /></View>
        ))}
      </View>
      <View style={styles.guideCopy}>
        <Text style={styles.guideTitle} numberOfLines={2}>{focus ? focus.title : context.priority.label}</Text>
        <Text style={styles.guideMeta} numberOfLines={1}>
          {focus ? ['From your shopping guide', budget].filter(Boolean).join(' · ') : `${context.targets.length} styles in your shopping guide`}
        </Text>
      </View>
    </View>
  );
}

export function GuideEmptyState({ context, onPrompt }: { context: GuideContext; onPrompt: (q: string) => void }) {
  const focus = guideFocus(context);
  const questions = focus ? styleAskQuestions(focus) : compareAskQuestions(context.targets);
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyHero}>
        <Text style={styles.promptSectionLabel}>ASKING ABOUT</Text>
        <GuideContextCard context={context} />
      </View>
      {questions.length ? (
        <View style={styles.promptList}>
          <Text style={styles.promptSectionLabel}>TRY ASKING</Text>
          <View style={styles.starterRows}>
            {questions.map(question => (
              <TouchableOpacity key={question} style={styles.starterRow} activeOpacity={0.65} onPress={() => onPrompt(question)} accessibilityRole="button" accessibilityLabel={question}>
                <Text style={[styles.starterTitle, styles.guideQuestion]}>{question}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

export function EmptyState({
  weather,
  tempUnit,
  displayName,
  wardrobeCount,
  onPrompt,
  onWorkflow,
}: {
  weather: CurrentWeather | undefined;
  tempUnit: 'C' | 'F';
  displayName?: string | null;
  wardrobeCount: number;
  onPrompt: (q: string) => void;
  onWorkflow: (kind: StylistWorkflow['kind']) => void;
}) {
  const insets = useSafeAreaInsets();
  const [moreIdeasMounted, setMoreIdeasMounted] = useState(false);
  const moreIdeasSheetProgress = useSharedValue(0);
  const moreIdeasBackdropProgress = useSharedValue(0);
  const moreIdeasDragY = useSharedValue(0);
  const moreIdeasCompletionRef = useRef<(() => void) | undefined>(undefined);
  const firstName = displayName?.trim().split(/\s+/)[0];
  const todayPrompt = buildTodayPrompt(weather, tempUnit);
  const services = buildStylistStarters(wardrobeCount);
  const visibleStarters: Array<StylistStarter | { title: string; subtitle: string; prompt: string }> = [
    { title: 'Style me today', subtitle: todayPrompt, prompt: todayPrompt },
    ...services.slice(0, 2),
  ];
  const secondaryStarters = services.slice(2);

  const completeMoreIdeasDismiss = useCallback(() => {
    setMoreIdeasMounted(false);
    moreIdeasSheetProgress.value = 0;
    moreIdeasBackdropProgress.value = 0;
    moreIdeasDragY.value = 0;
    const afterClose = moreIdeasCompletionRef.current;
    moreIdeasCompletionRef.current = undefined;
    afterClose?.();
  }, [moreIdeasBackdropProgress, moreIdeasDragY, moreIdeasSheetProgress]);

  const dismissMoreIdeas = useCallback((afterClose?: () => void) => {
    moreIdeasCompletionRef.current = afterClose;
    moreIdeasSheetProgress.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) runOnJS(completeMoreIdeasDismiss)();
    });
    moreIdeasBackdropProgress.value = withTiming(0, { duration: 180 });
    moreIdeasDragY.value = withTiming(0, { duration: 180 });
  }, [completeMoreIdeasDismiss, moreIdeasBackdropProgress, moreIdeasDragY, moreIdeasSheetProgress]);

  const dismissMoreIdeasByDrag = useCallback(() => {
    moreIdeasCompletionRef.current = undefined;
    moreIdeasDragY.value = withTiming(440, { duration: 220 }, (finished) => {
      if (finished) runOnJS(completeMoreIdeasDismiss)();
    });
    moreIdeasBackdropProgress.value = withTiming(0, { duration: 180 });
  }, [completeMoreIdeasDismiss, moreIdeasBackdropProgress, moreIdeasDragY]);

  const chooseStarter = (starter: StylistStarter | { title: string; subtitle: string; prompt: string }) => {
    Haptics.selectionAsync().catch(() => {});
    const run = () => {
      if ('prompt' in starter) onPrompt(starter.prompt);
      else onWorkflow(starter.workflowKind);
    };
    if (moreIdeasMounted) dismissMoreIdeas(run);
    else run();
  };

  useEffect(() => {
    if (!moreIdeasMounted) return;
    moreIdeasSheetProgress.value = 0;
    moreIdeasBackdropProgress.value = 0;
    moreIdeasDragY.value = 0;
    moreIdeasSheetProgress.value = withTiming(1, { duration: 260 });
    moreIdeasBackdropProgress.value = withTiming(1, { duration: 260 });
  }, [moreIdeasBackdropProgress, moreIdeasDragY, moreIdeasMounted, moreIdeasSheetProgress]);

  const moreIdeasSheetStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(moreIdeasSheetProgress.value, [0, 1], [420, 0]) + moreIdeasDragY.value,
    }],
  }));
  const moreIdeasBackdropStyle = useAnimatedStyle(() => ({ opacity: moreIdeasBackdropProgress.value }));

  const moreIdeasPanGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetY(8)
      .failOffsetX([-24, 24])
      .onUpdate((event) => {
        moreIdeasDragY.value = Math.max(0, event.translationY);
      })
      .onEnd((event) => {
        if (event.translationY > 72 || event.velocityY > 700) {
          runOnJS(dismissMoreIdeasByDrag)();
        } else {
          moreIdeasDragY.value = withSpring(0, { damping: 18, stiffness: 180 });
        }
      }),
    [dismissMoreIdeasByDrag, moreIdeasDragY],
  );

  return (
    <>
      <View style={styles.emptyState}>
        <View style={styles.emptyHero}>
          <Text style={styles.emptyTitle}>
            {firstName ? `What are we dressing for, ${firstName}?` : 'What are we dressing for?'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Personal styling, grounded in your wardrobe and your day.
          </Text>
        </View>

        <View style={styles.promptList}>
          <Text style={styles.promptSectionLabel}>START WITH AN IDEA</Text>
          <View style={styles.starterRows}>
            {visibleStarters.map((starter) => (
              <StarterRow key={starter.title} starter={starter} onPress={() => chooseStarter(starter)} />
            ))}
          </View>
          <TouchableOpacity
            style={styles.moreIdeasButton}
            onPress={() => setMoreIdeasMounted(true)}
            accessibilityRole="button"
            accessibilityLabel="More styling ideas"
          >
            <Text style={styles.moreIdeasText}>More ideas</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={moreIdeasMounted} transparent animationType="none" onRequestClose={() => dismissMoreIdeas()}>
        <GestureHandlerRootView style={StyleSheet.absoluteFill}>
          <View style={styles.moreIdeasModal}>
          <Reanimated.View
            style={[styles.moreIdeasBackdrop, moreIdeasBackdropStyle]}
            pointerEvents="box-none"
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => dismissMoreIdeas()} />
          </Reanimated.View>
          <Reanimated.View
            style={[styles.moreIdeasSheet, { paddingBottom: insets.bottom + spacing.xl }, moreIdeasSheetStyle]}
            accessibilityViewIsModal
          >
            <GestureDetector gesture={moreIdeasPanGesture}>
              <Reanimated.View
                style={styles.moreIdeasDragRegion}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Drag down to close More Ideas"
              >
                <View style={styles.sheetGrabber} />
              </Reanimated.View>
            </GestureDetector>
            <Text style={styles.moreIdeasTitle}>More ways to style</Text>
            <Text style={styles.moreIdeasSubtitle}>Start with a broader wardrobe project.</Text>
            <View style={styles.moreIdeasRows}>
              {secondaryStarters.map((starter) => (
                <StarterRow key={starter.title} starter={starter} onPress={() => chooseStarter(starter)} />
              ))}
            </View>
          </Reanimated.View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

function StarterRow({ starter, onPress }: { starter: Pick<StylistStarter, 'title' | 'subtitle'>; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.starterRow}
      activeOpacity={0.65}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${starter.title}. ${starter.subtitle}`}
    >
      <View style={styles.starterCopy}>
        <Text style={styles.starterTitle}>{starter.title}</Text>
        <Text style={styles.starterSubtitle}>{starter.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}
