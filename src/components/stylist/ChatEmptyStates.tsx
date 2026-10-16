import { Pressable, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import * as Haptics from '../../lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { compareAskQuestions, styleAskQuestions, styleName } from '../../lib/shoppingEditorial';
import { displayBudget } from '../../lib/shoppingPriorityEdit';
import { ShoppingStyleVisual } from '../shopping/ShoppingStyleVisual';
import { buildStylistStarters, landingDateline, timeOfDayGreeting } from './stylist-empty-state';
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
// The landing, set entirely in type: a serif greeting and a few quiet ways in. No garment imagery — whitespace and
// scale do the work. The header carries name, place and weather; the composer
// carries the open question.

export function EmptyState({
  displayName,
  wardrobeCount,
  onWorkflow,
}: {
  displayName?: string | null;
  wardrobeCount: number;
  onWorkflow: (kind: StylistWorkflow['kind']) => void;
}) {
  const { height } = useWindowDimensions();
  const firstName = displayName?.trim().split(/\s+/)[0];
  const greeting = `${timeOfDayGreeting()}${firstName ? `, ${firstName}` : ''}.`;
  const ideas = buildStylistStarters(wardrobeCount).slice(0, 3);
  // Let the air scale with the screen: roomy on tall phones, never sparse on an SE.
  const air = Math.round(Math.min(Math.max(height * 0.07, spacing.xl), spacing.xxxl * 1.5));
  // Sit the block a touch below centre, nearer the composer it leads into.
  const settle = Math.round(height * 0.06);

  return (
    <View style={[styles.landing, { gap: air, paddingTop: settle }]}>
      <View style={styles.landingHero}>
        <Animated.Text entering={landingEnter(0)} style={styles.landingDateline}>{landingDateline()}</Animated.Text>
        <Animated.Text entering={landingEnter(70)} style={styles.landingGreeting} accessibilityRole="header">{greeting}</Animated.Text>
        <Animated.View entering={landingEnter(140)}>
          {/* Dim the inner view: the entering animation owns the wrapper's opacity. */}
          <View style={styles.landingRule} />
        </Animated.View>
        <Animated.Text entering={landingEnter(210)} style={styles.landingQuestion}>What are we putting together today?</Animated.Text>
      </View>

      {/* One row that scrolls edge to edge rather than wrapping into a stagger. */}
      <Animated.View entering={landingEnter(300)} style={styles.landingIdeasRow}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.landingIdeas}>
        {ideas.map((idea) => (
          <Pressable
            key={idea.workflowKind}
            style={({ pressed }) => [styles.landingIdea, pressed && styles.landingIdeaPressed]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onWorkflow(idea.workflowKind); }}
            accessibilityRole="button"
            accessibilityLabel={`${idea.title}. ${idea.subtitle}`}
          >
            <Text style={styles.landingIdeaGlyph}>✦</Text>
            <Text style={styles.landingIdeaText}>{idea.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {/* Chips dissolve into the canvas at the right edge instead of meeting the bezel. */}
      <LinearGradient
        colors={[`${colors.background}00`, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.landingIdeasFade}
        pointerEvents="none"
      />
      </Animated.View>
    </View>
  );
}

// A slow, staggered rise: each line arrives a beat after the last. Reduce Motion
// (system or the app's own setting, via ReducedMotionConfig) skips it.
function landingEnter(delay: number) {
  return FadeInDown.delay(delay)
    .duration(520)
    .easing(Easing.bezier(0.22, 1, 0.36, 1))
    .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })
    .reduceMotion(ReduceMotion.System);
}
