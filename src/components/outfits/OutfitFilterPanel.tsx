import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal, BottomSheetScrollView, BottomSheetBackdrop,
  BottomSheetFooter, type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import Animated, {
  useAnimatedStyle, withTiming,
  FadeIn, FadeOut,
} from 'react-native-reanimated';
import { colors, spacing, typography, radii } from '../../theme';

// ─── AccordionSection ─────────────────────────────────────────────────────────

interface AccordionSectionProps {
  title: string;
  badge?: number;
  defaultExpanded?: boolean;
  children: ReactNode;
}

function AccordionSection({ title, badge, defaultExpanded = false, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultExpanded);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 200 }) }],
    marginLeft: 'auto' as const,
  }));

  return (
    <>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionLabel}>{title}</Text>
        {badge != null && badge > 0 && (
          <View style={styles.accordionBadge}>
            <Text style={styles.accordionBadgeText}>{badge}</Text>
          </View>
        )}
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
        </Animated.View>
      </TouchableOpacity>
      {open && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={styles.accordionBody}
        >
          {children}
        </Animated.View>
      )}
    </>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OutfitFilterPanelProps {
  onClose: () => void;
  sortOptions: { key: string; label: string }[];
  sortKey: string;
  onSortChange: (key: string) => void;
  showAssigned: boolean;
  onToggleAssigned: () => void;
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  showNeverWorn: boolean;
  onToggleNeverWorn: () => void;
  showFavorites: boolean;
  onToggleFavorites: () => void;
  filteredCount: number;
  activeFilterCount: number;
  onClearAll: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OutfitFilterPanel({
  onClose,
  sortOptions,
  sortKey,
  onSortChange,
  showAssigned,
  onToggleAssigned,
  allTags,
  selectedTags,
  onToggleTag,
  showNeverWorn,
  onToggleNeverWorn,
  showFavorites,
  onToggleFavorites,
  filteredCount,
  activeFilterCount,
  onClearAll,
}: OutfitFilterPanelProps) {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['85%'], []);

  useEffect(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
    ),
    [],
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => bottomSheetRef.current?.dismiss()}
            activeOpacity={0.85}
          >
            <Text style={styles.applyText}>
              Show {filteredCount} {filteredCount === 1 ? 'look' : 'looks'}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetFooter>
    ),
    [insets.bottom, filteredCount],
  );

  const activeSortLabel = sortOptions.find(o => o.key === sortKey)?.label ?? '';

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBackground}
    >
      <BottomSheetScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableFooterMarginAdjustment
        stickyHeaderIndices={[0]}
      >
        {/* ── Sticky header ── */}
        <View style={styles.panelHeader}>
          <TouchableOpacity
            onPress={onClearAll}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ opacity: activeFilterCount > 0 ? 1 : 0 }}
            disabled={activeFilterCount === 0}
          >
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>

          <Text style={styles.panelTitle}>Sort &amp; Filter</Text>

          <TouchableOpacity
            onPress={() => bottomSheetRef.current?.dismiss()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* ── Sort ── */}
        <AccordionSection title={`Sort: ${activeSortLabel}`} defaultExpanded={false}>
          {sortOptions.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={styles.row}
              onPress={() => onSortChange(key)}
              activeOpacity={0.7}
            >
              <View style={[styles.radio, sortKey === key && styles.radioActive]}>
                {sortKey === key && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.rowText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </AccordionSection>

        <AccordionSection
          title="Event Assignment"
          badge={showAssigned ? 1 : undefined}
          defaultExpanded={showAssigned}
        >
          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, showAssigned && styles.chipActive]}
              onPress={onToggleAssigned}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, showAssigned && styles.chipTextActive]}>
                Assigned to event
              </Text>
            </TouchableOpacity>
          </View>
        </AccordionSection>

        {/* ── Favourites ── */}
        <AccordionSection
          title="Favourites"
          badge={showFavorites ? 1 : undefined}
          defaultExpanded={showFavorites}
        >
          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, showFavorites && styles.chipActive]}
              onPress={onToggleFavorites}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, showFavorites && styles.chipTextActive]}>
                Favourites only
              </Text>
            </TouchableOpacity>
          </View>
        </AccordionSection>

        {/* ── Wear status ── */}
        <AccordionSection
          title="Wear Status"
          badge={showNeverWorn ? 1 : undefined}
          defaultExpanded={showNeverWorn}
        >
          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, showNeverWorn && styles.chipActive]}
              onPress={onToggleNeverWorn}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, showNeverWorn && styles.chipTextActive]}>
                Never worn
              </Text>
            </TouchableOpacity>
          </View>
        </AccordionSection>

        {/* ── Tags ── */}
        {allTags.length > 0 && (
          <AccordionSection
            title="Tags"
            badge={selectedTags.length}
            defaultExpanded={selectedTags.length > 0}
          >
            <View style={styles.chips}>
              {allTags.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>
        )}

        <View style={{ height: spacing.xxl }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.background,
  },
  handle: {
    backgroundColor: colors.border,
    width: 36,
  },

  // Header
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  resetText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    minWidth: 48,
  },
  panelTitle: {
    flex: 1,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
    letterSpacing: 0,
    textAlign: 'center',
  },

  scroll: {
    flex: 1,
  },

  // Accordion
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  accordionBadge: {
    marginLeft: spacing.sm,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionBadgeText: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.primaryForeground,
  },
  accordionBody: {
    paddingBottom: spacing.md,
  },

  // Rows (sort)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    gap: spacing.md,
  },
  rowText: {
    fontSize: typography.size.md,
    color: colors.foreground,
  },

  // Radio
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  // Chips
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: typography.size.sm,
    color: colors.foreground,
  },
  chipTextActive: {
    color: colors.primaryForeground,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  applyText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primaryForeground,
  },
});
