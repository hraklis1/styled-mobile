import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, curatedProducts, spacing, typography } from '../../theme';
import type { ShopOutfit } from '../../types/shop';
import { useProductOffers } from '../../hooks/useProductOffers';
import { CuratedItemRail } from '../shopping/CuratedItemRail';
import { openShoppingLink } from '../shopping/ShoppingRetailerLinks';

type Props = { outfit: ShopOutfit; onRemove?: () => void; onSave?: () => Promise<void>; onSaved?: () => void; onViewSaved?: () => void; onSaveToBoard?: () => void; saveLabel?: string; wishlistId?: string };
export function ShopOutfitCard({ outfit, onRemove, onSave, onSaved, onViewSaved, onSaveToBoard, saveLabel, wishlistId }: Props) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const query = useProductOffers({ reference: outfit.commerceReference, conversationId: outfit.commerceConversationId, wishlistId, surface: 'stylist' });
  async function save() {
    if (!onSave || saved || saving) return;
    setSaving(true); setSaveError(false);
    try { await onSave(); setSaved(true); onSaved?.(); } catch { setSaveError(true); } finally { setSaving(false); }
  }
  return <View style={styles.root}>
    <Text style={styles.intro}>{outfit.intro}</Text>
    {outfit.items.map((item, index) => {
      const key = item.key ?? `stylist-${index}`;
      const state = query.data?.[key] ?? item.offerState;
      const hasReference = !!(outfit.commerceReference || wishlistId);
      return <View key={key} style={styles.direction}>
        <Text style={styles.title}>{item.name}</Text>
        {!!item.whyItFitsYou && <Text style={styles.copy}>{item.whyItFitsYou}</Text>}
        {!!item.priceRange && <Text style={styles.copy}>Suggested budget {item.priceRange}</Text>}
        {hasReference || item.offers?.length ? <CuratedItemRail browserTitle={item.name} reason={item.whyItFitsYou} offers={state?.offers ?? item.offers ?? []} status={query.isError || query.fetchStatus === 'paused' ? 'unavailable' : state?.status ?? 'pending'} context={{ reference: outfit.commerceReference, conversationId: outfit.commerceConversationId, wishlistId, targetKey: key, surface: 'stylist' }} onRetry={() => void query.refetch()} /> : <Pressable onPress={() => void openShoppingLink(`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${item.brand} ${item.name}`)}`)} accessibilityRole="link" accessibilityLabel={`Search Google Shopping for ${item.name}`} style={styles.action}><Text style={styles.link}>Search for similar pieces ↗</Text></Pressable>}
      </View>;
    })}
    {!!outfit.totalBudget && <Text style={styles.copy}>Suggested total budget {outfit.totalBudget}</Text>}
    {onSave ? <Pressable onPress={() => void save()} disabled={saved || saving} accessibilityRole="button" accessibilityState={{ disabled: saved || saving, busy: saving }} style={styles.action}><Text style={styles.link}>{saved ? 'Saved' : saving ? 'Saving…' : saveLabel ?? `Save this ${outfit.recommendationType ?? 'look'}`}</Text></Pressable> : null}
    {saved && (onViewSaved || onSaveToBoard) ? <View style={styles.savedActions}>
      {onViewSaved ? <Pressable onPress={onViewSaved} accessibilityRole="button" style={styles.action}><Text style={styles.link}>View saved</Text></Pressable> : null}
      {onSaveToBoard ? <Pressable onPress={onSaveToBoard} accessibilityRole="button" style={styles.action}><Text style={styles.link}>Add to board</Text></Pressable> : null}
    </View> : null}
    {saveError ? <Text accessibilityRole="alert" style={styles.copy}>Couldn’t save. Try again.</Text> : null}
    {onRemove ? <Pressable onPress={onRemove} accessibilityRole="button" style={styles.action}><Text style={styles.copy}>Remove</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: spacing.lg }, intro: { ...typography.text.body, color: colors.inkSubtle },
  direction: { gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  title: { ...typography.text.editorialCompact, color: colors.foreground }, copy: { ...typography.text.bodySmall, color: colors.mutedForeground },
  savedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  action: { minHeight: 48, justifyContent: 'center' }, link: { ...typography.text.label, color: curatedProducts.accent },
});
