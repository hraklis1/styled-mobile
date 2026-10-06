import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SettingsScaffold, Group, GroupBlock } from '../../components/profile/SettingsUI';
import { api } from '../../lib/api';
import { productFeedbackOptions } from '../../lib/productFeedback';
import { colors, spacing, typography, radii } from '../../theme';

type HiddenProduct = { productKey: string; title: string; imageUrl: string | null; brand: string | null; merchant: string; price: number | null; currency: string; reason: string | null; createdAt: string };
type Page = { items: HiddenProduct[]; nextBefore: string | null };

const HIDDEN_KEY = ['shop', 'product-feedback'] as const;
const reasonLabel = (reason: string | null) => productFeedbackOptions.find((option) => option.id === reason)?.title ?? 'No reason given';

/**
 * Listings the user marked "Not for me". Paged from the server (never the whole
 * history); restoring one also reverses what Styled learned from it.
 */
export function HiddenProductsScreen() {
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: HIDDEN_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.get<Page>('/api/shop/product-feedback', { params: pageParam ? { before: pageParam } : {} }).then((r) => r.data),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
  const restore = useMutation({
    mutationFn: (productKey: string) => api.delete(`/api/shop/product-feedback/${productKey}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: HIDDEN_KEY }),
    onError: () => Alert.alert('Error', "Couldn't restore. Please try again."),
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SettingsScaffold title="Not for Me" lede="Listings you marked “Not for me”. Styled uses them to tune your shopping guides. Restore any to see it again.">
      {query.isLoading ? <ActivityIndicator color={colors.primary} /> : (
        <Group>
          <GroupBlock>
            {!items.length ? <Text style={s.empty}>Nothing marked yet.</Text> : items.map((item) => (
              <View key={item.productKey} style={s.row}>
                <View style={s.thumb}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}</View>
                <View style={s.copy}>
                  <Text style={s.title} numberOfLines={2}>{item.title}</Text>
                  <Text style={s.meta} numberOfLines={1}>{[item.brand || item.merchant, reasonLabel(item.reason)].join(' · ')}</Text>
                </View>
                <Pressable onPress={() => restore.mutate(item.productKey)} disabled={restore.isPending} accessibilityRole="button" accessibilityLabel={`Restore ${item.title}`} style={s.restore}>
                  <Text style={s.link}>Restore</Text>
                </Pressable>
              </View>
            ))}
            {query.hasNextPage ? (
              <Pressable onPress={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} accessibilityRole="button" style={s.restore}>
                <Text style={s.link}>{query.isFetchingNextPage ? 'Loading…' : 'Show more'}</Text>
              </Pressable>
            ) : null}
          </GroupBlock>
        </Group>
      )}
    </SettingsScaffold>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  thumb: { width: 48, height: 60, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surfaceSubtle },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.text.bodySmall, color: colors.foreground },
  meta: { ...typography.text.caption, color: colors.mutedForeground },
  restore: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  link: { ...typography.text.bodySmall, color: colors.foreground, textDecorationLine: 'underline' },
  empty: { ...typography.text.bodySmall, color: colors.mutedForeground },
});
