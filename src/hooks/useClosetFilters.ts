import { useState, useMemo } from 'react';
import { parseMaterialString } from '../components/wardrobe/FilterPanel';
import { SEASON_OPTIONS, CATEGORY_ORDER, CATEGORY_LABELS, type ItemCategory } from '../types/item';
import type { Item } from '../types/item';
import type { Outfit } from '../types/outfit';

export type SortKey = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'most_worn' | 'least_worn' | 'recently_worn' | 'cost_per_wear';
export type OutfitSortKey = 'newest' | 'oldest' | 'most_worn' | 'recently_worn' | 'name_asc';

interface UseClosetFiltersParams {
  items: Item[];
  outfits: Outfit[];
  search: string;
  activeCategory: ItemCategory | null;
}

export function useClosetFilters({ items, outfits, search, activeCategory }: UseClosetFiltersParams) {
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

  // ── Outfit filter state ──────────────────────────────────────────────────
  const [outfitSortKey, setOutfitSortKey]               = useState<OutfitSortKey>('newest');
  const [outfitFilterSheetOpen, setOutfitFilterSheetOpen] = useState(false);
  const [outfitSelectedTags, setOutfitSelectedTags]     = useState<string[]>([]);
  const [outfitSelectedEvents, setOutfitSelectedEvents] = useState<string[]>([]);
  const [outfitShowNeverWorn, setOutfitShowNeverWorn]   = useState(false);

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
      selectedMaterials.length,
    [sortKey, selectedColors, selectedBrands, selectedSeasons,
     selectedConditions, selectedWarmth, selectedCategories,
     selectedOccasions, selectedStatuses, selectedMaterials],
  );

  const allOutfitTags = useMemo(
    () => [...new Set(outfits.flatMap(o => o.tags ?? []))].sort(),
    [outfits],
  );
  const allOutfitEvents = useMemo(
    () => [...new Set(outfits.filter(o => o.event).map(o => o.event!))].sort(),
    [outfits],
  );
  const outfitActiveFilterCount = useMemo(
    () =>
      (outfitSortKey !== 'newest' ? 1 : 0) +
      outfitSelectedTags.length +
      outfitSelectedEvents.length +
      (outfitShowNeverWorn ? 1 : 0),
    [outfitSortKey, outfitSelectedTags, outfitSelectedEvents, outfitShowNeverWorn],
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

  // ── Filtered data ────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let result = items.filter(i => !i.isArchived);
    if (activeCategory) result = result.filter(i => i.category === activeCategory);
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
  }, [items, activeCategory, search, sortKey, selectedColors, selectedBrands, selectedSeasons,
      selectedConditions, selectedWarmth, selectedCategories, selectedOccasions,
      selectedStatuses, selectedMaterials]);

  const filteredOutfits = useMemo(() => {
    let result = outfits;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        o =>
          o.name.toLowerCase().includes(q) ||
          (o.event ?? '').toLowerCase().includes(q) ||
          (o.tags ?? []).some(t => t.toLowerCase().includes(q)),
      );
    }
    if (outfitSelectedTags.length)
      result = result.filter(o => outfitSelectedTags.every(t => (o.tags ?? []).includes(t)));
    if (outfitSelectedEvents.length)
      result = result.filter(o => o.event && outfitSelectedEvents.includes(o.event));
    if (outfitShowNeverWorn)
      result = result.filter(o => o.wearCount === 0);

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
  }, [outfits, search, outfitSelectedTags, outfitSelectedEvents, outfitShowNeverWorn, outfitSortKey]);

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
  }

  function clearOutfitFilters() {
    setOutfitSortKey('newest');
    setOutfitSelectedTags([]);
    setOutfitSelectedEvents([]);
    setOutfitShowNeverWorn(false);
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

    // Outfit filter state
    outfitSortKey, setOutfitSortKey,
    outfitFilterSheetOpen, setOutfitFilterSheetOpen,
    outfitSelectedTags, setOutfitSelectedTags,
    outfitSelectedEvents, setOutfitSelectedEvents,
    outfitShowNeverWorn, setOutfitShowNeverWorn,

    // Filter metadata
    allColors, allBrands, allSeasons, allMaterials,
    activeFilterCount,
    allOutfitTags, allOutfitEvents,
    outfitActiveFilterCount,
    categoryCounts, availableCategories,

    // Filtered data
    filteredItems, filteredOutfits,

    // Actions
    clearSheetFilters,
    clearOutfitFilters,
    resetAll,
  };
}
