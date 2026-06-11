import { useState, useEffect, useRef, useMemo, useCallback, memo, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
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
  FadeIn, FadeOut, LinearTransition,
} from 'react-native-reanimated';
import { colors, spacing, typography, radii } from '../../theme';
import {
  CATEGORY_ORDER, CATEGORY_LABELS,
  OCCASION_OPTIONS, OCCASION_LABELS,
  LAUNDRY_STATUS_OPTIONS, LAUNDRY_STATUS_LABELS,
  SLEEVE_LENGTH_OPTIONS, SLEEVE_LENGTH_LABELS,
} from '../../types/item';
import {
  COLOR_HEX_MAP, getSwatchColor, isColorLight, parseMaterialString,
} from '../../lib/colorUtils';
export { parseMaterialString };

// ─── Season label ─────────────────────────────────────────────────────────────

function formatSeasonLabel(season: string): string {
  const overrides: Record<string, string> = {
    spring_summer: 'Spring/Summer',
    fall_winter:   'Fall/Winter',
    all_season:    'All Season',
    all_seasons:   'All Seasons',
  };
  return overrides[season] ?? season.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── ColorSwatch ──────────────────────────────────────────────────────────────

const SWATCH_SIZE = 30;
const SWATCH_RING_SIZE = SWATCH_SIZE + 6;

interface ColorSwatchProps {
  colorName: string;
  selected: boolean;
  onPress: () => void;
}

const ColorSwatch = memo(({ colorName, selected, onPress }: ColorSwatchProps) => {
  const { primary, secondary } = getSwatchColor(colorName);
  const light = isColorLight(primary);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.swatchRing, selected && styles.swatchRingSelected]}>
        <View style={styles.swatchCircle}>
          {secondary != null ? (
            <>
              <View style={[styles.swatchHalf, { left: 0, backgroundColor: primary }]} />
              <View style={[styles.swatchHalf, { right: 0, backgroundColor: secondary }]} />
            </>
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: primary }]} />
          )}
          {selected && (
            <Ionicons name="checkmark" size={12} color={light ? '#28231F' : '#FFFFFF'} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── AccordionSection ─────────────────────────────────────────────────────────

interface AccordionSectionProps {
  title: string;
  badge?: number;
  defaultExpanded?: boolean;
  children: ReactNode;
}

function AccordionSection({ title, badge, defaultExpanded = false, children }: AccordionSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(expanded ? '180deg' : '0deg', { duration: 200 }) }],
    marginLeft: 'auto' as const,
  }));

  const toggle = useCallback(() => setExpanded(v => !v), []);

  return (
    <>
      <TouchableOpacity style={styles.accordionHeader} onPress={toggle} activeOpacity={0.7}>
        <Text style={styles.sectionLabelInline}>{title}</Text>
        {badge != null && badge > 0 && (
          <View style={styles.accordionBadge}>
            <Text style={styles.accordionBadgeText}>{badge}</Text>
          </View>
        )}
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
        </Animated.View>
      </TouchableOpacity>
      {expanded && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          layout={LinearTransition}
          style={styles.accordionBody}
        >
          {children}
        </Animated.View>
      )}
    </>
  );
}

// ─── FilterPanel ──────────────────────────────────────────────────────────────

export interface FilterPanelProps {
  visible?: boolean;
  onClose: () => void;
  sortOptions: { key: string; label: string }[];
  sortKey: string;
  onSortChange: (key: string) => void;
  allColors: string[];
  selectedColors: string[];
  onToggleColor: (color: string) => void;
  allBrands: string[];
  selectedBrands: string[];
  onToggleBrand: (brand: string) => void;
  allSeasons: string[];
  selectedSeasons: string[];
  onToggleSeason: (season: string) => void;
  allTags?: string[];
  selectedTags?: string[];
  onToggleTag?: (tag: string) => void;
  selectedCategories?: string[];
  onToggleCategory?: (cat: string) => void;
  selectedOccasions?: string[];
  onToggleOccasion?: (occ: string) => void;
  selectedStatuses?: string[];
  onToggleStatus?: (s: string) => void;
  allMaterials?: string[];
  selectedMaterials?: string[];
  onToggleMaterial?: (m: string) => void;
  allSleeveLengths?: string[];
  selectedSleeveLengths?: string[];
  onToggleSleeveLength?: (s: string) => void;
  selectedConditions?: string[];
  onToggleCondition?: (condition: string) => void;
  selectedWarmth?: number[];
  onToggleWarmth?: (level: number) => void;
  filteredCount: number;
  activeFilterCount: number;
  onClearAll: () => void;
}

const CONDITION_OPTIONS_FILTER = [
  { value: 'new',          label: 'New' },
  { value: 'good',         label: 'Good' },
  { value: 'worn',         label: 'Worn' },
  { value: 'needs_repair', label: 'Needs Repair' },
  { value: 'donate',       label: 'Donate' },
];

const WARMTH_OPTIONS_FILTER = [
  { value: 1, label: 'Very Light' },
  { value: 2, label: 'Light' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Warm' },
  { value: 5, label: 'Very Warm' },
];

export function FilterPanel({
  onClose,
  sortOptions,
  sortKey,
  onSortChange,
  allColors,
  selectedColors,
  onToggleColor,
  allBrands,
  selectedBrands,
  onToggleBrand,
  allSeasons,
  selectedSeasons,
  onToggleSeason,
  allTags,
  selectedTags,
  onToggleTag,
  selectedCategories,
  onToggleCategory,
  selectedOccasions,
  onToggleOccasion,
  selectedStatuses,
  onToggleStatus,
  allMaterials,
  selectedMaterials,
  onToggleMaterial,
  allSleeveLengths,
  selectedSleeveLengths,
  onToggleSleeveLength,
  selectedConditions,
  onToggleCondition,
  selectedWarmth,
  onToggleWarmth,
  filteredCount,
  activeFilterCount,
  onClearAll,
}: FilterPanelProps) {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['90%'], []);

  const [brandSearch, setBrandSearch] = useState('');

  useEffect(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const filteredBrands = useMemo(
    () => allBrands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase())),
    [allBrands, brandSearch],
  );

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />,
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
              Show {filteredCount} {filteredCount === 1 ? 'piece' : 'pieces'}
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
        enableFooterMarginAdjustment={true}
        stickyHeaderIndices={[0]}
      >
        {/* ── Sticky Header ── */}
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

        {/* ── Category ── */}
        {onToggleCategory && (
          <AccordionSection
            title="Category"
            badge={(selectedCategories ?? []).length}
            defaultExpanded={true}
          >
            <View style={styles.chips}>
              {CATEGORY_ORDER.map(cat => {
                const active = (selectedCategories ?? []).includes(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>
        )}

        {/* ── Occasion ── */}
        {onToggleOccasion && (
          <AccordionSection
            title="Occasion"
            badge={(selectedOccasions ?? []).length}
            defaultExpanded={true}
          >
            <View style={styles.chips}>
              {OCCASION_OPTIONS.map(occ => {
                const active = (selectedOccasions ?? []).includes(occ);
                return (
                  <TouchableOpacity
                    key={occ}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleOccasion(occ)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {OCCASION_LABELS[occ]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>
        )}

        {/* ── Material ── */}
        {allMaterials && allMaterials.length > 0 && (
          <AccordionSection
            title="Material"
            badge={(selectedMaterials ?? []).length}
            defaultExpanded={false}
          >
            <View style={styles.chips}>
              {allMaterials.map(mat => {
                const active = (selectedMaterials ?? []).includes(mat);
                return (
                  <TouchableOpacity
                    key={mat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleMaterial?.(mat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{mat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>
        )}

        {/* ── Sleeve Length ── */}
        {allSleeveLengths && allSleeveLengths.length > 0 && (
          <AccordionSection
            title="Sleeve Length"
            badge={(selectedSleeveLengths ?? []).length}
            defaultExpanded={false}
          >
            <View style={styles.chips}>
              {SLEEVE_LENGTH_OPTIONS.map(sl => {
                const active = (selectedSleeveLengths ?? []).includes(sl);
                return (
                  <TouchableOpacity
                    key={sl}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleSleeveLength?.(sl)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {SLEEVE_LENGTH_LABELS[sl]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>
        )}

        {/* ── Status ── */}
        {onToggleStatus && (
          <AccordionSection
            title="Status"
            badge={(selectedStatuses ?? []).length}
            defaultExpanded={false}
          >
            <View style={styles.chips}>
              {LAUNDRY_STATUS_OPTIONS.map(status => {
                const active = (selectedStatuses ?? []).includes(status);
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleStatus(status)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {LAUNDRY_STATUS_LABELS[status]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>
        )}

        {/* ── Colour ── */}
        {allColors.length > 0 && (
          <AccordionSection
            title="Colour"
            badge={selectedColors.length}
            defaultExpanded={false}
          >
            <View style={styles.swatchGrid}>
              {allColors.map(color => (
                <ColorSwatch
                  key={color}
                  colorName={color}
                  selected={selectedColors.includes(color)}
                  onPress={() => onToggleColor(color)}
                />
              ))}
            </View>
          </AccordionSection>
        )}

        {/* ── Brand ── */}
        {allBrands.length > 0 && (
          <AccordionSection
            title="Brand"
            badge={selectedBrands.length}
            defaultExpanded={false}
          >
            <View style={styles.brandSearchWrap}>
              <Ionicons name="search-outline" size={14} color={colors.mutedForeground} />
              <TextInput
                style={styles.brandSearchInput}
                value={brandSearch}
                onChangeText={setBrandSearch}
                placeholder="Search brands…"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {brandSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setBrandSearch('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            {filteredBrands.map(brand => {
              const active = selectedBrands.includes(brand);
              return (
                <TouchableOpacity
                  key={brand}
                  style={styles.row}
                  onPress={() => onToggleBrand(brand)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, active && styles.checkboxActive]}>
                    {active && (
                      <Ionicons name="checkmark" size={11} color={colors.primaryForeground} />
                    )}
                  </View>
                  <Text style={styles.rowText}>{brand}</Text>
                </TouchableOpacity>
              );
            })}
            {filteredBrands.length === 0 && brandSearch.length > 0 && (
              <Text style={styles.noMatchText}>No brands match "{brandSearch}"</Text>
            )}
          </AccordionSection>
        )}

        {/* ── Season ── */}
        {allSeasons.length > 0 && (
          <AccordionSection
            title="Season"
            badge={selectedSeasons.length}
            defaultExpanded={false}
          >
            <View style={styles.chips}>
              {allSeasons.map(season => {
                const active = selectedSeasons.includes(season);
                return (
                  <TouchableOpacity
                    key={season}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleSeason(season)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {formatSeasonLabel(season)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>
        )}

        {/* ── Condition ── */}
        {onToggleCondition && (
          <AccordionSection
            title="Condition"
            badge={(selectedConditions ?? []).length}
            defaultExpanded={false}
          >
            <View style={styles.chips}>
              {CONDITION_OPTIONS_FILTER.map(({ value, label }) => {
                const active = (selectedConditions ?? []).includes(value);
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleCondition(value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>
        )}

        {/* ── Warmth ── */}
        {onToggleWarmth && (
          <AccordionSection
            title="Warmth"
            badge={(selectedWarmth ?? []).length}
            defaultExpanded={false}
          >
            <View style={styles.chips}>
              {WARMTH_OPTIONS_FILTER.map(({ value, label }) => {
                const active = (selectedWarmth ?? []).includes(value);
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleWarmth(value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AccordionSection>
        )}

        {/* ── Tags ── */}
        {allTags && allTags.length > 0 && (
          <AccordionSection
            title="Tags"
            badge={(selectedTags ?? []).length}
            defaultExpanded={false}
          >
            <View style={styles.chips}>
              {allTags.map(tag => {
                const active = (selectedTags ?? []).includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onToggleTag?.(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
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

  // ── Header
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
    letterSpacing: -0.3,
    textAlign: 'center',
  },

  // ── Scroll
  scroll: {
    flex: 1,
  },

  // ── Accordion
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionLabelInline: {
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

  // ── Rows (sort + brand checkboxes)
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

  // ── Radio
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

  // ── Checkbox
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // ── Colour swatches
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  swatchRing: {
    width: SWATCH_RING_SIZE,
    height: SWATCH_RING_SIZE,
    borderRadius: SWATCH_RING_SIZE / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRingSelected: {
    borderColor: colors.primary,
  },
  swatchCircle: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchHalf: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
  },

  // ── Brand search
  brandSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 36,
    gap: spacing.sm,
  },
  brandSearchInput: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.foreground,
    paddingVertical: 0,
  },
  noMatchText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontStyle: 'italic',
  },

  // ── Chips
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

  // ── Footer
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
