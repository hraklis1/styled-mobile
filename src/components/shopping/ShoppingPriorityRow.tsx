import { StyleSheet, Text, View } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import { Ionicons } from '@expo/vector-icons';
import {
  priorityAnchorPieces,
  withoutOutfitCount,
  isGenericOutfitClaim,
} from '../../lib/shopClarity';
import { shoppingPriorityGapNarrative } from '../../lib/shoppingPriorityEdit';
import { shoppingGarmentTitle, legacyPriorityRationale } from '../../lib/shoppingEditorial';
import { shoppingFeedbackOptions, type ShoppingFeedbackReason } from '../../lib/shoppingFeedback';
import { PressableScale } from '../primitives/PressableScale';
import { WardrobeThumbnail } from './WardrobeThumbnail';
import { colors, shoppingSurfaces, spacing, typography } from '../../theme';
import type { ShoppingBriefPriority } from '../../lib/shopDecisionWorkspace';
import type { Item } from '../../types/item';
export const sentenceCase = shoppingGarmentTitle;
export const PRIORITY_RAIL_WIDTH = 26;
type Props = {
  index: number;
  priority: ShoppingBriefPriority;
  compact?: boolean;
  onPress?: () => void;
  onSkip?: (reason: ShoppingFeedbackReason) => void;
  skipping?: boolean;
  isLast?: boolean;
  wardrobe?: ReadonlyMap<number, Item>;
};
export function ShoppingPriorityRow({
  index,
  priority,
  compact,
  onPress,
  onSkip,
  skipping,
  isLast,
  wardrobe,
}: Props) {
  const label = sentenceCase(priority.label);
  const narrative = shoppingPriorityGapNarrative(priority.label, priority.context ?? '', {
    impactScore: priority.impactScore,
  });
  const narrativeCopy = legacyPriorityRationale(
    withoutOutfitCount(narrative.voice, priority.impactScore),
  );
  const repeatedLabel = priority.label.trim().toLowerCase();
  const rationale = narrativeCopy.toLowerCase().startsWith(`${repeatedLabel} `)
    ? narrativeCopy.slice(repeatedLabel.length).trim()
    : narrativeCopy;
  const anchors = priorityAnchorPieces(priority, wardrobe).slice(0, 3);
  const body = (
    <>
      <Text style={styles.numeral} accessibilityElementsHidden>
        {String(index).padStart(2, '0')}
      </Text>
      <View style={styles.body}>
        {priority.eventTitle ? <Text style={styles.meta}>{priority.eventTitle}</Text> : null}
        <Text style={styles.title}>{label}</Text>
        {!compact && rationale && !isGenericOutfitClaim(rationale) ? (
          <Text style={styles.copy}>{rationale}</Text>
        ) : null}
        {anchors.length ? (
          <View style={styles.anchors}>
            <Text style={styles.meta}>With your</Text>
            <View style={styles.images}>
              {anchors.map((item) => (
                <View key={item.id} style={styles.tile}>
                  <WardrobeThumbnail item={item} style={styles.image} />
                  <Text style={styles.caption}>{item.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {onPress ? <Text style={styles.action}>View guide →</Text> : null}
      </View>
    </>
  );
  return (
    <View style={[styles.card, !isLast && styles.rule]}>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          haptic={false}
          contentStyle={styles.row}
          pressedContentStyle={styles.pressed}
          accessibilityRole="button"
          accessibilityLabel={[
            label,
            rationale,
            anchors.length ? `With your ${anchors.map((item) => item.name).join(', ')}` : null,
          ]
            .filter(Boolean)
            .join('. ')}
          accessibilityHint="Opens this shopping guide"
        >
          {body}
        </PressableScale>
      ) : (
        <View style={styles.row}>{body}</View>
      )}
      {onSkip && !compact ? (
        <MenuView
          title={`About ${label}`}
          style={styles.menu}
          actions={shoppingFeedbackOptions.map((option) => ({
            ...option,
            attributes: { disabled: !!skipping },
          }))}
          onPressAction={({ nativeEvent }) => {
            const option = shoppingFeedbackOptions.find((entry) => entry.id === nativeEvent.event);
            if (option && !skipping) onSkip(option.id);
          }}
        >
          <View
            style={styles.more}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`More options for ${label}`}
            accessibilityState={{ disabled: !!skipping, busy: !!skipping }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.inkSubtle} />
          </View>
        </MenuView>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { paddingVertical: spacing.xl },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  row: { flexDirection: 'row', gap: spacing.md },
  pressed: { backgroundColor: colors.surfaceSelected },
  numeral: {
    width: PRIORITY_RAIL_WIDTH,
    ...typography.text.priorityNumeral,
    color: shoppingSurfaces.olive.accent,
    paddingTop: spacing.xs,
  },
  body: { flex: 1, gap: spacing.sm },
  title: { ...typography.text.editorialCompact, color: colors.foreground },
  copy: { ...typography.text.body, color: colors.inkSubtle },
  meta: { ...typography.text.bodySmall, color: colors.inkSubtle },
  anchors: { gap: spacing.sm, marginTop: spacing.xs },
  images: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  tile: { width: 72, gap: spacing.xs },
  image: { width: 48, aspectRatio: 0.8 },
  caption: { ...typography.text.bodySmall, color: colors.inkSubtle },
  action: {
    ...typography.text.label,
    color: shoppingSurfaces.olive.accent,
    paddingVertical: spacing.md,
    paddingRight: 48,
  },
  menu: { alignSelf: 'flex-end', marginTop: -44 },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
