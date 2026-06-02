import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii } from '../../theme';

// ─── Colour utilities ─────────────────────────────────────────────────────────

const COLOR_HEX_MAP: Record<string, string> = {
  black: '#1A1A1A',
  white: '#F5F5F5',
  ivory: '#FFFFF0',
  cream: '#FFF8E7',
  'off white': '#F5F0E8',
  'off-white': '#F5F0E8',
  red: '#DC2626',
  crimson: '#DC143C',
  scarlet: '#FF2400',
  burgundy: '#800020',
  maroon: '#800000',
  wine: '#722F37',
  pink: '#F472B6',
  blush: '#FFBCBB',
  rose: '#F43F5E',
  coral: '#FF6B6B',
  salmon: '#FA8072',
  orange: '#EA580C',
  amber: '#F59E0B',
  yellow: '#EAB308',
  mustard: '#D4900A',
  gold: '#D4AF37',
  lime: '#84CC16',
  green: '#16A34A',
  olive: '#6B7C23',
  sage: '#B2C29C',
  mint: '#3EB489',
  teal: '#0D9488',
  aqua: '#00BCD4',
  cyan: '#06B6D4',
  blue: '#2563EB',
  cobalt: '#0047AB',
  navy: '#1B2A4A',
  'navy blue': '#1B2A4A',
  sky: '#7DD3FC',
  'light blue': '#93C5FD',
  'baby blue': '#BFDBFE',
  indigo: '#4338CA',
  purple: '#7C3AED',
  violet: '#7C3AED',
  lavender: '#C4B5FD',
  lilac: '#D8B4FE',
  mauve: '#E0B0FF',
  brown: '#92400E',
  tan: '#D2B48C',
  khaki: '#C3B091',
  camel: '#C19A6B',
  sand: '#C2B280',
  beige: '#D4C5A9',
  taupe: '#9E8E7E',
  grey: '#6B7280',
  gray: '#6B7280',
  'light grey': '#D1D5DB',
  'light gray': '#D1D5DB',
  'dark grey': '#374151',
  'dark gray': '#374151',
  charcoal: '#374151',
  silver: '#C0C0C0',
};

const PATTERN_KEYWORDS = ['multi', 'pattern', 'floral', 'stripe', 'plaid', 'check', 'print', 'camo'];

function resolveHex(lower: string): string {
  if (COLOR_HEX_MAP[lower]) return COLOR_HEX_MAP[lower];
  for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return hex;
  }
  return '#9CA3AF';
}

function getSwatchColor(name: string): { primary: string; secondary?: string } {
  const lower = name.toLowerCase().trim();
  if (lower.includes('/')) {
    const [a, b] = lower.split('/').map(s => s.trim());
    return { primary: resolveHex(a), secondary: resolveHex(b ?? '') };
  }
  if (PATTERN_KEYWORDS.some(kw => lower.includes(kw))) {
    return { primary: '#C8B9A8', secondary: '#7D7168' };
  }
  return { primary: resolveHex(lower) };
}

function isColorLight(hex: string): boolean {
  if (!hex.startsWith('#') || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// ─── Season label ─────────────────────────────────────────────────────────────

function formatSeasonLabel(season: string): string {
  const overrides: Record<string, string> = {
    spring_fall:   'Spring/Fall',
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

// ─── FilterPanel ──────────────────────────────────────────────────────────────

export interface FilterPanelProps {
  visible: boolean;
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
  filteredCount: number;
  activeFilterCount: number;
  onClearAll: () => void;
}

export function FilterPanel({
  visible,
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
  filteredCount,
  activeFilterCount,
  onClearAll,
}: FilterPanelProps) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [mounted, setMounted]           = useState(false);
  const [brandSearch, setBrandSearch]   = useState('');
  const [brandExpanded, setBrandExpanded] = useState(false);

  const slideAnim    = useRef(new Animated.Value(screenWidth)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const chevronAnim  = useRef(new Animated.Value(0)).current;

  // Prime animation values and reset local UI state when opening
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(screenWidth);
      backdropAnim.setValue(0);
      setBrandSearch('');
      setBrandExpanded(false);
      chevronAnim.setValue(0);
      setMounted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Animate in once Modal has mounted
  useEffect(() => {
    if (mounted && visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 16,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: screenWidth,
        useNativeDriver: true,
        tension: 80,
        friction: 16,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      onClose();
    });
  }, [screenWidth, slideAnim, backdropAnim, onClose]);

  const toggleBrand = useCallback(() => {
    const next = !brandExpanded;
    setBrandExpanded(next);
    if (!next) setBrandSearch('');
    Animated.timing(chevronAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [brandExpanded, chevronAnim]);

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const filteredBrands = useMemo(
    () => allBrands.filter(b => b.toLowerCase().includes(brandSearch.toLowerCase())),
    [allBrands, brandSearch],
  );

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Dimmed backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents="none"
      />

      {/* Full-width panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            transform: [{ translateX: slideAnim }],
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
      >
        {/* ── Header ── */}
        <View style={[styles.panelHeader, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
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
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* ── Body ── */}
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sort */}
          <Text style={styles.sectionLabel}>Sort by</Text>
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

          {/* Colour */}
          {allColors.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Colour</Text>
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
            </>
          )}

          {/* Brand — accordion */}
          {allBrands.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={toggleBrand}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionLabelInline}>Brand</Text>
                {selectedBrands.length > 0 && (
                  <View style={styles.accordionBadge}>
                    <Text style={styles.accordionBadgeText}>{selectedBrands.length}</Text>
                  </View>
                )}
                <Animated.View style={{ transform: [{ rotate: chevronRotate }], marginLeft: 'auto' }}>
                  <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
                </Animated.View>
              </TouchableOpacity>

              {brandExpanded && (
                <>
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
                </>
              )}
            </>
          )}

          {/* Season */}
          {allSeasons.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Season</Text>
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
            </>
          )}

          {/* Tags */}
          {allTags && allTags.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Tags</Text>
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
            </>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyBtn} onPress={handleClose} activeOpacity={0.85}>
            <Text style={styles.applyText}>
              Show {filteredCount} {filteredCount === 1 ? 'piece' : 'pieces'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.background,
  },

  // ── Header
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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

  // ── Section labels
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
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

  // ── Colour swatches (no labels)
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

  // ── Brand accordion
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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

  // ── Season / Tag chips
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
