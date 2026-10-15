import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import * as Haptics from '../../lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { compareAskQuestions, styleAskQuestions, styleName } from '../../lib/shoppingEditorial';
import { displayBudget } from '../../lib/shoppingPriorityEdit';
import { ShoppingStyleVisual } from '../shopping/ShoppingStyleVisual';
import { buildStylistStarters, timeOfDayGreeting } from './stylist-empty-state';
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

  return (
    <View style={[styles.landing, { gap: air }]}>
      <View style={styles.landingHero}>
        <Text style={styles.landingGreeting} accessibilityRole="header">{greeting}</Text>
        <Text style={styles.landingQuestion}>What are we putting together today?</Text>
      </View>

      {/* One row that scrolls edge to edge rather than wrapping into a stagger. */}
      <View style={styles.landingIdeasRow}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.landingIdeas}>
        {ideas.map((idea) => (
          <TouchableOpacity
            key={idea.workflowKind}
            style={styles.landingIdea}
            activeOpacity={0.55}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onWorkflow(idea.workflowKind); }}
            accessibilityRole="button"
            accessibilityLabel={`${idea.title}. ${idea.subtitle}`}
          >
            <Text style={styles.landingIdeaGlyph}>✦</Text>
            <Text style={styles.landingIdeaText}>{idea.title}</Text>
          </TouchableOpacity>
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
      </View>
    </View>
  );
}
