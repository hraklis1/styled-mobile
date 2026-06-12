import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '../../theme';
import type { GenerateOutfitResult } from '../../hooks/useOutfits';
import type { Item } from '../../types/item';

export function OutfitGeneratedSheet({
  result,
  allItems,
  onDone,
  onAccept,
  onTryAnother,
  isAccepting,
  isRegenerating,
  hasCurrentOutfit,
}: {
  result: GenerateOutfitResult | null;
  allItems: Item[];
  onDone: () => void;
  onAccept: () => void;
  onTryAnother: () => void;
  isAccepting: boolean;
  isRegenerating: boolean;
  hasCurrentOutfit: boolean;
}) {
  const insets = useSafeAreaInsets();
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(600)).current;
  // Keep the last result mounted while the close animation runs
  const [shown, setShown] = useState<GenerateOutfitResult | null>(null);
  const pendingAction = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (result) {
      setShown(result);
      backdropAnim.setValue(0);
      sheetAnim.setValue(600);
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(sheetAnim, { toValue: 0, damping: 22, stiffness: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [result, backdropAnim, sheetAnim]);

  const close = (after?: () => void) => {
    pendingAction.current = after ?? null;
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(sheetAnim, { toValue: 600, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setShown(null);
      const action = pendingAction.current;
      pendingAction.current = null;
      onDone();
      action?.();
    });
  };

  if (!shown) return null;

  const items = shown.itemIds
    .map((id) => allItems.find((i) => i.id === id))
    .filter(Boolean) as Item[];

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close()}>
      <View style={s.overlay}>
        <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: sheetAnim }] }}>
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={s.handle} />

            <View style={s.header}>
              <View style={s.iconBadge}>
                <Ionicons name="sparkles" size={22} color={colors.primary} />
              </View>
              <Text style={s.eyebrow}>Your outfit plan</Text>
              <Text style={s.outfitName}>{shown.outfitName}</Text>
            </View>

            {items.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.itemsRow}
              >
                {items.map((item) => (
                  <View key={item.id} style={s.itemThumb}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={s.itemImg} />
                    ) : (
                      <View style={s.itemFallback}>
                        <Text style={s.itemInitials}>{item.name.slice(0, 2).toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            {shown.stylistNotes ? (
              <ScrollView style={s.notesScroll} showsVerticalScrollIndicator={false}>
                <View style={s.notesCard}>
                  <Text style={s.notesText}>{shown.stylistNotes}</Text>
                </View>
              </ScrollView>
            ) : null}

            {shown.missingEssentials.length > 0 ? (
              <View style={s.missingCard}>
                <Text style={s.missingTitle}>Wardrobe note</Text>
                <Text style={s.missingText}>
                  {shown.missingEssentials.map((item) => `${item.label}: ${item.context}`).join(' · ')}
                </Text>
              </View>
            ) : null}

            <View style={s.actions}>
              <TouchableOpacity
                style={[s.primaryBtn, isAccepting && s.disabledBtn]}
                onPress={onAccept}
                disabled={isAccepting || isRegenerating}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                <Text style={s.primaryBtnText}>{isAccepting ? 'Saving…' : 'Use this outfit'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.secondaryBtn, isRegenerating && s.disabledBtn]}
                onPress={onTryAnother}
                disabled={isAccepting || isRegenerating}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                <Text style={s.secondaryBtnText}>{isRegenerating ? 'Planning…' : 'Try another'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dismissBtn} onPress={() => close()} disabled={isAccepting} activeOpacity={0.8}>
                <Text style={s.dismissBtnText}>{hasCurrentOutfit ? 'Keep current outfit' : 'Not now'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg + 4,
    borderTopRightRadius: radii.lg + 4,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  eyebrow: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  outfitName: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  itemsRow: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  itemThumb: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  itemImg: { width: '100%', height: '100%' },
  itemFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInitials: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.mutedForeground,
  },
  notesScroll: { maxHeight: 180, marginBottom: spacing.lg },
  notesCard: {
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  notesText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
    lineHeight: typography.size.sm * 1.5,
  },
  missingCard: {
    backgroundColor: `${colors.primary}10`,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 3,
  },
  missingTitle: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primary },
  missingText: { fontSize: typography.size.xs, color: colors.mutedForeground, lineHeight: typography.size.xs * 1.5 },
  actions: { gap: spacing.sm },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  primaryBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  disabledBtn: { opacity: 0.55 },
  dismissBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  dismissBtnText: { fontSize: typography.size.sm, color: colors.mutedForeground },
  secondaryBtn: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
});
