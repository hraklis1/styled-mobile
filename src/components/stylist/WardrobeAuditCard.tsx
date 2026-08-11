import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { StylistWardrobeAuditData } from '../../features/stylist/types';
import type { Item } from '../../types/item';
import { itemImageContentFit, itemImageUri } from '../../lib/itemImage';
import { colors, radii, spacing, typography } from '../../theme';
import { GapCard } from './GapCard';

type Props = {
  audit: StylistWardrobeAuditData;
  items: Item[];
  onStyleItem: (itemId: number) => void;
  onNavigateToShop?: () => void;
};

function ItemThumb({ item }: { item: Item }) {
  const uri = itemImageUri(item);
  return (
    <View style={styles.thumb}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={itemImageContentFit(item)} />
      ) : (
        <Ionicons name="shirt-outline" size={18} color={colors.mutedForeground} />
      )}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function WardrobeAuditCard({ audit, items, onStyleItem, onNavigateToShop }: Props) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="sparkles" size={13} color={colors.primary} />
          <Text style={styles.eyebrow}>WARDROBE EDIT</Text>
        </View>
        <Text style={styles.title}>A thoughtful closet edit</Text>
        <Text style={styles.summary}>{audit.summary}</Text>
      </View>

      {audit.strengths.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle>What already works</SectionTitle>
          <View style={styles.bulletList}>
            {audit.strengths.map((strength, index) => (
              <View key={`${strength}_${index}`} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{strength}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle>Your workhorses</SectionTitle>
        {audit.wearDataStatus === 'none' ? (
          <Text style={styles.emptyText}>There isn’t enough wear history yet to name reliable favourites. Logging a few worn looks will make this section evidence-based.</Text>
        ) : (
          <>
            {audit.wearDataStatus === 'limited' ? (
              <Text style={styles.emptyText}>Early signal only — these are the pieces with recorded wears so far.</Text>
            ) : null}
            <View style={styles.itemList}>
              {audit.workhorses.map((entry) => {
                const item = byId.get(entry.itemId);
                if (!item) return null;
                return (
                  <View key={entry.itemId} style={styles.itemRow}>
                    <ItemThumb item={item} />
                    <View style={styles.itemCopy}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>{entry.wearCount} recorded wear{entry.wearCount === 1 ? '' : 's'}</Text>
                    </View>
                    <TouchableOpacity style={styles.styleButton} onPress={() => onStyleItem(item.id)} accessibilityLabel={`Style ${item.name}`}>
                      <Text style={styles.styleButtonText}>Style it</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      {audit.underused.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle>Underused & needs attention</SectionTitle>
          <View style={styles.itemList}>
            {audit.underused.map((entry) => {
              const item = byId.get(entry.itemId);
              if (!item) return null;
              const action = entry.action === 'let_go' ? 'LET GO' : entry.action.toUpperCase();
              return (
                <View key={entry.itemId} style={styles.attentionRow}>
                  <View style={styles.attentionTop}>
                    <ItemThumb item={item} />
                    <View style={styles.itemCopy}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.actionLabel}>{action}</Text>
                    </View>
                    {entry.action === 'remix' ? (
                      <TouchableOpacity style={styles.styleButton} onPress={() => onStyleItem(item.id)} accessibilityLabel={`Style ${item.name}`}>
                        <Text style={styles.styleButtonText}>Style it</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={styles.reason}>{entry.reason}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {audit.investments.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle>Gaps & investments</SectionTitle>
          <View style={styles.gapList}>
            {[...audit.investments]
              .sort((a, b) => a.priority - b.priority)
              .map((investment, index) => (
                <GapCard key={`${investment.label}_${index}`} item={investment} onPress={onNavigateToShop} />
              ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, borderCurve: 'continuous', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  header: { padding: spacing.lg, gap: spacing.sm },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: { fontSize: 11, letterSpacing: 1.4, fontWeight: typography.weight.semibold, color: colors.primary },
  title: { fontFamily: typography.family.display, fontSize: typography.size.xxl, lineHeight: 34, color: colors.foreground },
  summary: { fontSize: typography.size.md, lineHeight: 22, color: colors.inkSubtle },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.md },
  sectionTitle: { fontSize: 12, letterSpacing: 1.2, fontWeight: typography.weight.semibold, color: colors.primary, textTransform: 'uppercase' },
  bulletList: { gap: spacing.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
  bulletText: { flex: 1, fontSize: typography.size.sm, lineHeight: 20, color: colors.foreground },
  emptyText: { fontSize: typography.size.sm, lineHeight: 20, color: colors.mutedForeground },
  itemList: { gap: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  attentionRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  attentionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 48, height: 48, borderRadius: radii.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, gap: spacing.xs },
  itemName: { fontSize: typography.size.md, fontWeight: typography.weight.medium, color: colors.foreground },
  itemMeta: { fontSize: typography.size.xs, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  actionLabel: { fontSize: 10, letterSpacing: 1.1, fontWeight: typography.weight.semibold, color: colors.primary },
  reason: { paddingLeft: 60, fontSize: typography.size.sm, lineHeight: 19, color: colors.inkSubtle },
  styleButton: { minHeight: 34, justifyContent: 'center', borderRadius: 17, backgroundColor: colors.muted, paddingHorizontal: spacing.md },
  styleButtonText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primary },
  gapList: { gap: spacing.sm },
});
