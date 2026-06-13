import { useState, useMemo } from 'react';
import { parseMaterialString } from '../components/wardrobe/FilterPanel';
import { SEASON_OPTIONS, CATEGORY_ORDER, CATEGORY_LABELS, type ItemCategory } from '../types/item';
import { getSubcategories } from '../lib/taxonomy';
import type { Item } from '../types/item';
import type { Outfit } from '../types/outfit';
import type { Event } from '../types/event';
import { getUpcomingAssignmentSummaries } from '../lib/outfitAssignments';

export type SortKey = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'most_worn' | 'least_worn' | 'recently_worn' | 'cost_per_wear';
export type OutfitSortKey = 'newest' | 'oldest' | 'most_worn' | 'recently_worn' | 'name_asc';

interface UseClosetFiltersParams {
  items: Item[];
  outfits: Outfit[];
  events: Event[];
  search: string;
  activeCategory: ItemCategory | null;
  activeSubcategory: string | null;
}

export function useClosetFilters({ items, outfits, events, search, activeCategory, activeSubcategory }: UseClosetFiltersParams) {
  // ── Pieces filter state ──────────────────────────────────────────────────
  const [sortKey, setSortKey]                     = useState<SortKey>('newest');
  const [filterSheetOpen, setFilterSheetOpen]     = useState(false);
  const [selectedColors, setSelectedColors]       = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands]       = useState<string[]>([]);
  const [selectedSeasons, setSelectedSeasons]     = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [selectedWarmth, setSelectedWarmth]       = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses]   = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedSleeveLengths, setSelectedSleeveLengths] = useState<string[]>([]);

  // ── Outfit filter state ──────────────────────────────────────────────────
  const [outfitSortKey, setOutfitSortKey]               = useState<OutfitSortKey>('newest');
  const [outfitFilterSheetOpen, setOutfitFilterSheetOpen] = useState(false);
  const [outfitSelectedTags, setOutfitSelectedTags]     = useState<string[]>([]);
  const [outfitShowAssigned, setOutfitShowAssigned]     = useState(false);
  const [outfitShowNeverWorn, setOutfitShowNeverWorn]   = useState(false);
  const [outfitShowFavorites, setOutfitShowFavorites]   = useState(false);

  // ── Filter metadata ──────────────────────────────────────────────────────
  const allColors    = useMemo(() => [...new Set(items.filter(i => i.colorNormalized).map(i => i.colorNormalized!))].sort(), [items]);
  const allBrands    = useMemo(() => [...new Set(items.filter(i => i.brand).map(i => i.brand!))].sort(), [items]);
  const allSeasons   = useMemo(() => [...SEASON_OPTIONS], []);
  const allMaterials = useMemo(
    () => [...new Set(
      items
        .filter(i => i.material && i.material.toLowerCase() !== 'null')
        .flatMap(i => parseMaterialString(i.material!))
    )].sort(),
    [items],
  );

  const allSleeveLengths = useMemo(
    () => [...new Set(items.filter(i => i.sleeveLength).map(i => i.sleeveLength!))].sort(),
    [items],
  );

  const activeFilterCount = useMemo(
    () =>
      (sortKey !== 'newest' ? 1 : 0) +
      selectedColors.length +
      selectedBrands.length +
      selectedSeasons.length +
      selectedConditions.length +
      selectedWarmth.length +
      selectedCategories.length +
      selectedOccasions.length +
      selectedStatuses.length +
      selectedMaterials.length +
      selectedSleeveLengths.length,
    [sortKey, selectedColors, selectedBrands, selectedSeasons,
     selectedConditions, selectedWarmth, selectedCategories,
     selectedOccasions, selectedStatuses, selectedMaterials, selectedSleeveLengths],
  );

  const allOutfitTags = useMemo(
    () => [...new Set(outfits.flatMap(o => o.tags ?? []))].sort(),
    [outfits],
  );
  const upcomingAssignmentSummaries = useMemo(() => getUpcomingAssignmentSummaries(events), [events]);
  const outfitActiveFilterCount = useMemo(
    () =>
      (outfitSortKey !== 'newest' ? 1 : 0) +
      outfitSelectedTags.length +
      (outfitShowAssigned ? 1 : 0) +
      (outfitShowNeverWorn ? 1 : 0) +
      (outfitShowFavorites ? 1 : 0),
    [outfitSortKey, outfitSelectedTags, outfitShowAssigned, outfitShowNeverWorn, outfitShowFavorites],
  );

  // ── Category metadata ────────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<ItemCategory, number>> = {};
    for (const item of items) {
      if (item.category) counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const availableCategories = useMemo(
    () => CATEGORY_ORDER.filter(c => (categoryCounts[c] ?? 0) > 0),
    [categoryCounts],
  );

  const availableSubcategories = useMemo(() => {
    if (!activeCategory) return [];
    const subs = new Set(
      items
        .filter(i => i.category === activeCategory && i.subcategory)
        .map(i => i.subcategory!)
    );
    const taxOrder = getSubcategories(activeCategory);
    const result = taxOrder.filter(s => subs.has(s));
    for (const sub of subs) if (!result.includes(sub)) result.push(sub);
    return result;
  }, [items, activeCategory]);

  // ── Filtered data ────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let result = items.filter(i => !i.isArchived);
    if (activeCategory) result = result.filter(i => i.category === activeCategory);
    if (activeSubcategory) result = result.filter(i => i.subcategory === activeSubcategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          (i.brand ?? '').toLowerCase().includes(q) ||
          (i.category ? (CATEGORY_LABELS[i.category] ?? '').toLowerCase().includes(q) : false),
      );
    }
    if (selectedColors.length)
      result = result.filter(i => i.colorNormalized && selectedColors.includes(i.colorNormalized));
    if (selectedBrands.length)
      result = result.filter(i => i.brand && selectedBrands.includes(i.brand));
    if (selectedSeasons.length)
      result = result.filter(i => (i.seasons ?? []).some(s => selectedSeasons.includes(s)));
    if (selectedConditions.length)
      result = result.filter(i => i.condition && selectedConditions.includes(i.condition));
    if (selectedWarmth.length)
      result = result.filter(i => i.warmthRating != null && selectedWarmth.includes(i.warmthRating));
    if (selectedCategories.length)
      result = result.filter(i => i.category && selectedCategories.includes(i.category));
    if (selectedOccasions.length)
      result = result.filter(i => (i.occasions ?? []).some(o => selectedOccasions.includes(o)));
    if (selectedStatuses.length)
      result = result.filter(i => i.laundryStatus != null && selectedStatuses.includes(i.laundryStatus));
    if (selectedMaterials.length)
      result = result.filter(i =>
        parseMaterialString(i.material ?? '').some(m => selectedMaterials.includes(m))
      );
    if (selectedSleeveLengths.length)
      result = result.filter(i => i.sleeveLength && selectedSleeveLengths.includes(i.sleeveLength));

    const arr = [...result];
    if (sortKey === 'oldest')
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (sortKey === 'name_asc')
      arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === 'name_desc')
      arr.sort((a, b) => b.name.localeCompare(a.name));
    else if (sortKey === 'most_worn')
      arr.sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0));
    else if (sortKey === 'least_worn')
      arr.sort((a, b) => (a.wearCount ?? 0) - (b.wearCount ?? 0));
    else if (sortKey === 'recently_worn')
      arr.sort((a, b) => {
        const ta = a.lastWornAt ? new Date(a.lastWornAt).getTime() : 0;
        const tb = b.lastWornAt ? new Date(b.lastWornAt).getTime() : 0;
        return tb - ta;
      });
    else if (sortKey === 'cost_per_wear')
      arr.sort((a, b) => {
        const cpwA = a.purchasePrice != null && a.wearCount > 0 ? a.purchasePrice / a.wearCount : Infinity;
        const cpwB = b.purchasePrice != null && b.wearCount > 0 ? b.purchasePrice / b.wearCount : Infinity;
        return cpwA - cpwB;
      });
    else
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [items, activeCategory, activeSubcategory, search, sortKey, selectedColors, selectedBrands, selectedSeasons,
      selectedConditions, selectedWarmth, selectedCategories, selectedOccasions,
      selectedStatuses, selectedMaterials, selectedSleeveLengths]);

  const filteredOutfits = useMemo(() => {
    let result = outfits;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        o =>
          o.name.toLowerCase().includes(q) ||
          (o.tags ?? []).some(t => t.toLowerCase().includes(q)),
      );
    }
    if (outfitSelectedTags.length)
      result = result.filter(o => outfitSelectedTags.every(t => (o.tags ?? []).includes(t)));
    if (outfitShowAssigned)
      result = result.filter(o => upcomingAssignmentSummaries.has(o.id));
    if (outfitShowNeverWorn)
      result = result.filter(o => o.wearCount === 0);
    if (outfitShowFavorites)
      result = result.filter(o => o.isFavorite);

    const arr = [...result];
    if (outfitSortKey === 'oldest')
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else if (outfitSortKey === 'most_worn')
      arr.sort((a, b) => b.wearCount - a.wearCount);
    else if (outfitSortKey === 'recently_worn')
      arr.sort((a, b) => {
        if (!a.lastWornAt && !b.lastWornAt) return 0;
        if (!a.lastWornAt) return 1;
        if (!b.lastWornAt) return -1;
        return new Date(b.lastWornAt).getTime() - new Date(a.lastWornAt).getTime();
      });
    else if (outfitSortKey === 'name_asc')
      arr.sort((a, b) => a.name.localeCompare(b.name));
    else
      arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [outfits, search, outfitSelectedTags, outfitShowAssigned, outfitShowNeverWorn, outfitShowFavorites, outfitSortKey, upcomingAssignmentSummaries]);

  // ── Actions ──────────────────────────────────────────────────────────────
  function clearSheetFilters() {
    setSortKey('newest');
    setSelectedColors([]);
    setSelectedBrands([]);
    setSelectedSeasons([]);
    setSelectedConditions([]);
    setSelectedWarmth([]);
    setSelectedCategories([]);
    setSelectedOccasions([]);
    setSelectedStatuses([]);
    setSelectedMaterials([]);
    setSelectedSleeveLengths([]);
  }

  function clearOutfitFilters() {
    setOutfitSortKey('newest');
    setOutfitSelectedTags([]);
    setOutfitShowAssigned(false);
    setOutfitShowNeverWorn(false);
    setOutfitShowFavorites(false);
  }

  function resetAll() {
    clearSheetFilters();
    clearOutfitFilters();
  }

  return {
    // Pieces filter state
    sortKey, setSortKey,
    filterSheetOpen, setFilterSheetOpen,
    selectedColors, setSelectedColors,
    selectedBrands, setSelectedBrands,
    selectedSeasons, setSelectedSeasons,
    selectedConditions, setSelectedConditions,
    selectedWarmth, setSelectedWarmth,
    selectedCategories, setSelectedCategories,
    selectedOccasions, setSelectedOccasions,
    selectedStatuses, setSelectedStatuses,
    selectedMaterials, setSelectedMaterials,
    selectedSleeveLengths, setSelectedSleeveLengths,

    // Outfit filter state
    outfitSortKey, setOutfitSortKey,
    outfitFilterSheetOpen, setOutfitFilterSheetOpen,
    outfitSelectedTags, setOutfitSelectedTags,
    outfitShowAssigned, setOutfitShowAssigned,
    outfitShowNeverWorn, setOutfitShowNeverWorn,
    outfitShowFavorites, setOutfitShowFavorites,

    // Filter metadata
    allColors, allBrands, allSeasons, allMaterials, allSleeveLengths,
    activeFilterCount,
    allOutfitTags, upcomingAssignmentSummaries,
    outfitActiveFilterCount,
    categoryCounts, availableCategories, availableSubcategories,

    // Filtered data
    filteredItems, filteredOutfits,

    // Actions
    clearSheetFilters,
    clearOutfitFilters,
    resetAll,
  };
}
