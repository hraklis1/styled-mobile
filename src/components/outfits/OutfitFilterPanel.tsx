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
} from 'react-native-reanimated';
import { colors, spacing, typography, radii } from '../../theme';

// ─── AccordionSection ─────────────────────────────────────────────────────────

interface AccordionSectionProps {
  title: string;
  badge?: number;
  summary?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

function AccordionSection({ title, badge, summary, defaultExpanded = false, children }: AccordionSectionProps) {
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
        accessibilityRole="button" accessibilityLabel={`${title}${summary ? `, ${summary}` : ''}`} accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.sectionLabel, { flexShrink: 1 }]} numberOfLines={1}>{title}{!open && summary ? ` · ${summary}` : ''}</Text>
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
  canReset?: boolean;
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
  canReset = activeFilterCount > 0,
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
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TouchableOpacity
            style={styles.applyBtn}
            accessibilityRole="button"
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
      accessible={false}
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
        <View style={styles.stickyHeader}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Sort &amp; Filter</Text>
          <TouchableOpacity
            onPress={onClearAll}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ minHeight: 44, justifyContent: 'center', opacity: canReset ? 1 : 0.4 }}
            disabled={!canReset}
            accessibilityRole="button" accessibilityLabel="Reset filters and sort" accessibilityState={{ disabled: !canReset }}
          >
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => bottomSheetRef.current?.dismiss()}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
            accessibilityRole="button" accessibilityLabel="Close filters"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        </View>

        {/* ── Sort ── */}
        <AccordionSection title={`Sort: ${activeSortLabel}`} defaultExpanded={false}>
          {sortOptions.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={styles.row}
              accessibilityRole="radio" accessibilityState={{ checked: sortKey === key }}
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
          summary={showAssigned ? 'Assigned to event' : undefined}
          badge={showAssigned ? 1 : undefined}
          defaultExpanded={false}
        >
          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, showAssigned && styles.chipActive]}
              accessibilityRole="checkbox"
              accessibilityLabel="Assigned to event"
              accessibilityState={{ checked: showAssigned }}
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
          summary={showFavorites ? 'Favourites only' : undefined}
          badge={showFavorites ? 1 : undefined}
          defaultExpanded={false}
        >
          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, showFavorites && styles.chipActive]}
              accessibilityRole="checkbox"
              accessibilityLabel="Favourites only"
              accessibilityState={{ checked: showFavorites }}
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
          summary={showNeverWorn ? 'Never worn' : undefined}
          badge={showNeverWorn ? 1 : undefined}
          defaultExpanded={false}
        >
          <View style={styles.chips}>
            <TouchableOpacity
              style={[styles.chip, showNeverWorn && styles.chipActive]}
              accessibilityRole="checkbox"
              accessibilityLabel="Never worn"
              accessibilityState={{ checked: showNeverWorn }}
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
            summary={`${selectedTags.slice(0, 2).join(', ')}${selectedTags.length > 2 ? ` +${selectedTags.length - 2}` : ''}`}
            badge={selectedTags.length}
            defaultExpanded={false}
          >
            <View style={styles.chips}>
              {allTags.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="checkbox"
              accessibilityLabel={tag}
              accessibilityState={{ checked: active }}
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
    backgroundColor: colors.background, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet,
  },
  handle: {
    backgroundColor: colors.border,
    width: 36,
  },

  // Header
  // ScrollView transfers the sticky child's styles to its own wrapper.
  // Keep row layout on an inner view so controls remain on one line.
  stickyHeader: { backgroundColor: colors.background },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  resetText: {
    fontSize: typography.text.bodySmall.fontSize,
    fontWeight: typography.weight.medium,
    color: colors.mutedForeground,
    minWidth: 48,
  },
  panelTitle: {
    flex: 1, ...typography.text.editorialSheet, color: colors.foreground, textAlign: 'left',
  },

  scroll: {
    flex: 1,
  },

  // Accordion
  accordionHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.sm,
  },
  sectionLabel: {
    ...typography.text.eyebrow, color: colors.mutedForeground,
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
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.bold,
    color: colors.primaryForeground,
  },
  accordionBody: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },

  // Rows (sort)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.page,
    paddingVertical: 11,
    gap: spacing.md,
  },
  rowText: {
    fontSize: typography.text.body.fontSize,
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
    paddingHorizontal: spacing.page,
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.text.bodySmall, flexShrink: 1, color: colors.foreground,
  },
  chipTextActive: {
    color: colors.primaryForeground,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  applyBtn: {
    minHeight: 52, backgroundColor: colors.primary, borderRadius: radii.action, paddingHorizontal: spacing.page, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  applyText: {
    ...typography.text.label, color: colors.primaryForeground,
  },
});
