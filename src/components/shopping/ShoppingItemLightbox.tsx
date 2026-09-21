import { useReducedMotion } from 'react-native-reanimated';
import { purchaseDetails, validateShoppingPatch } from '../../lib/shoppingCatalog';
import { parseShoppingAmount, resolveShoppingPrice, shoppingPriceCandidates, suggestedShoppingCurrency } from '../../lib/shoppingPrices';
import { ShoppingWardrobeForm } from './ShoppingWardrobeForm';
import { ShoppingSyncNotice } from './ShoppingSyncNotice';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';

import { ActionMenuSheet } from '../primitives/ActionMenuSheet';
import { ShoppingSnapOrganizerModal } from './ShoppingSnapOrganizerModal';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { PriceCandidateChips, type PriceChoice } from './PriceCandidateChips';
import { useShoppingItemActions } from '../../hooks/useShoppingItemActions';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useShoppingBrief } from '../../hooks/useShoppingBrief';
import { matchShoppingPriority } from '../../lib/shopClarity';
import { sentenceCase } from './ShoppingPriorityRow';
import { formatShoppingDetailLocation } from '../../lib/shoppingLocations';
import {
  formatShoppingPrice,
  garmentFriendlyContentFit,
  itemRoleSummary,
  parseShoppingTagOcr,
  SHOPPING_CATALOG_STATUS_OPTIONS,
  shoppingItemBadges,
  shoppingPieceTitle,
  snapRoleLabel,
} from '../../lib/shoppingPresentation';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import { SHORTLIST_COPY } from '../../lib/shoppingVocabulary';
import { colors, radii, shoppingSurfaces, spacing, typography } from '../../theme';
import type { ShoppingFindCatalog, ShoppingFindCatalogPatch } from '../../types/shoppingSnap';

function catalogFromItem(item: ShoppingEditItem): ShoppingFindCatalog {
  return {
    ...purchaseDetails(item),
    category: item.category,
    sizeLabel: item.sizeLabel,
    colorLabel: item.colorLabel,
    materialLabel: item.materialLabel,
    notes: item.notes,
    isFavorite: item.isFavorite,
    catalogStatus: item.catalogStatus,
  };
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/**
 * The one detail that is a question rather than a fact. Every other row here
 * reports; this one asks, so it is the only one that can be tapped.
 */
function StoreDetailRow({ value, onPress }: { value: string | null; onPress?: () => void }) {
  if (!onPress) return <DetailRow label="Store" value={value ?? SHORTLIST_COPY.needsStore} />;

  return (
    <TouchableOpacity
      style={styles.detailRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `Store, ${value}. Change it.` : `${SHORTLIST_COPY.needsStore}. ${SHORTLIST_COPY.addStore}.`}
    >
      <Text style={styles.detailLabel}>Store</Text>
      <Text style={[styles.detailValue, styles.detailValueAction]} numberOfLines={1}>
        {value ?? SHORTLIST_COPY.addStore}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={colors.action} />
    </TouchableOpacity>
  );
}

function CatalogField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.catalogField}>
      <Text style={styles.catalogFieldLabel}>{label}</Text>
      <TextInput
        value={value ?? ''}
        onChangeText={onChange}
        placeholder={label}
        accessibilityLabel={label}
        keyboardType={label === 'Price' ? 'decimal-pad' : label === 'Purchase link' ? 'url' : 'default'}
        autoCapitalize={label === 'Purchase link' ? 'none' : 'sentences'}
        placeholderTextColor={colors.mutedForeground}
        style={styles.catalogFieldInput}
      />
    </View>
  );
}

/**
 * The one immersive, editorial view of a shopping piece — reached whether
 * you tap an item straight from the Shortlist or from a haul's full-screen
 * gallery. Catalog, Organize, Location, and Ask Stylist all live here now,
 * so there's no separate "edit mode" to hop into.
 */
export function ShoppingItemLightbox({
  item,
  onClose,
  onAssignStore,
}: {
  item: ShoppingEditItem;
  onClose: () => void;
  /** Names the store for this item's whole visit. The host closes the lightbox
   *  and presents its own sheet — a bottom sheet cannot render above the
   *  full-screen modal this lives in. */
  onAssignStore?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const contentScrollRef = useRef<ScrollView>(null);
  const catalogEditorY = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showFullTag, setShowFullTag] = useState(false);
  const [displayItem, setDisplayItem] = useState(item);
  // The other half of Shop: when a find answers a priority on this month's
  // brief, say so here, where the decision is made. Reads the cached brief
  // only — the query is shared with the overview, so this costs no request.
  const { isPremium } = useEntitlement();
  const brief = useShoppingBrief(isPremium);
  const filledPriority = useMemo(
    () => (brief.data ? matchShoppingPriority(displayItem, brief.data.priorities) : null),
    [brief.data, displayItem],
  );
  const [catalogEditing, setCatalogEditing] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState<ShoppingFindCatalog>(() => catalogFromItem(item));
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [showCaptureInfo, setShowCaptureInfo] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState(item.extractedPrice?.toString() ?? '');
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const {
    saveCatalog,
    isSavingCatalog,
    deleteItem,
    isDeleting,
    saveOrganization,
    isSavingOrganization,
    askStylistAboutItem,
  } = useShoppingItemActions();

  useEffect(() => {
    setDisplayItem(item);
    setCatalogDraft(catalogFromItem(item));
    setCatalogEditing(false);
    setCatalogError(null);
    setDecisionError(null);
    setShowCaptureInfo(false);
    setShowFullTag(false);
    setMoreOpen(false);
  }, [item]);

  useEffect(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle('dark');
  }, []);

  useEffect(() => {
    if (!catalogEditing) return;
    const frame = requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({
        y: Math.max(0, catalogEditorY.current - spacing.md),
        animated: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [catalogEditing]);

  const photos = useMemo(
    () => [displayItem.primarySnap, ...displayItem.snaps.filter((snap) => snap.id !== displayItem.primarySnap.id)],
    [displayItem],
  );
  const currencyCode = useCurrencyCode();
  const priceCandidates = displayItem.priceResolution?.candidates ?? displayItem.snaps.flatMap((snap) => shoppingPriceCandidates(snap.rawOcrText, snap.countryCode, currencyCode));
  const hasTagPhoto = displayItem.snaps.some((snap) => snap.captureRole === 'tag');
  const priceCountry = displayItem.snaps.find((snap) => snap.captureRole === 'tag' && snap.countryCode)?.countryCode
    ?? (hasTagPhoto ? null : displayItem.snaps.find((snap) => snap.captureRole !== 'garment' && snap.countryCode)?.countryCode
      ?? displayItem.snaps.find((snap) => snap.countryCode)?.countryCode);
  const priceResolution = displayItem.priceResolution ?? resolveShoppingPrice(priceCandidates, priceCountry, undefined, currencyCode);
  const amount = displayItem.extractedPrice ?? priceResolution.amount;
  const resolvedCurrency = displayItem.currencyCode ?? priceResolution.currencyCode;
  const price = formatShoppingPrice(amount, resolvedCurrency);
  // One tap settles a price the tag left open — a conflict, a symbol with
  // no currency, or an automatic pick among several readings the shopper has
  // not confirmed — without opening the editor.
  const showPriceChips = !catalogEditing && priceCandidates.length > 0 && (
    priceResolution.status === 'ambiguous'
    || (amount !== null && !resolvedCurrency)
    || (displayItem.priceOverride == null && priceCandidates.length > 1)
  );
  const [priceChipError, setPriceChipError] = useState<string | null>(null);
  const pickPrice = (choice: PriceChoice) => {
    setPriceChipError(null);
    const patch: ShoppingFindCatalogPatch = { priceOverride: choice.amount, currencyCode: choice.currencyCode };
    // No expected base: the item's currencyCode is the *resolved* currency,
    // not what the group row stores, and sending it would read as a conflict.
    void saveCatalog(displayItem.captureGroupId, patch)
      .then(() => {
        setDisplayItem((current) => ({
          ...current,
          ...patch,
          extractedPrice: choice.amount,
          priceResolution: current.priceResolution
            ? { ...current.priceResolution, amount: choice.amount, currencyCode: choice.currencyCode, status: 'resolved', inferred: false }
            : current.priceResolution,
        }));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((error) => setPriceChipError(error instanceof Error ? error.message : 'Please try again.'));
  };
  const priceActionLabel = amount !== null && !resolvedCurrency
    ? `${amount.toLocaleString()} · Confirm currency`
    : priceResolution.status === 'ambiguous' ? SHORTLIST_COPY.confirmPrice : SHORTLIST_COPY.needsPrice;
  const meta = [displayItem.sizeLabel ? `Size ${displayItem.sizeLabel}` : null, displayItem.colorLabel, displayItem.materialLabel]
    .filter(Boolean)
    .join('   ·   ');
  const badges = shoppingItemBadges(displayItem);
  const activePhoto = photos[activeIndex] ?? displayItem.primarySnap;
  const activeDimensions = imageDimensions[activePhoto.id];
  const activeAspect = activeDimensions ? activeDimensions.width / activeDimensions.height : 0;
  const heroHeight = activeAspect > 1.15
    ? Math.min(height * 0.42, 380)
    : Math.min(height * 0.55, 560);
  const canOrganize = displayItem.snaps.length > 1 || displayItem.snaps.some((snap) => snap.captureRole === 'unknown');
  const mapCoordinate = displayItem.primarySnap.latitude !== null && displayItem.primarySnap.longitude !== null
    ? { latitude: displayItem.primarySnap.latitude, longitude: displayItem.primarySnap.longitude }
    : null;

  const tagOcrText = useMemo(
    () => displayItem.snaps
      .filter((snap) => snap.captureRole === 'tag')
      .map((snap) => snap.rawOcrText.trim())
      .filter(Boolean)
      .join('\n'),
    [displayItem],
  );
  const { fields: tagFields, sections: tagSections } = useMemo(
    () => parseShoppingTagOcr(tagOcrText),
    [tagOcrText],
  );
  const tagSpecs = tagFields.filter((field) => field.label !== 'USD');

  const jumpToPhoto = (index: number) => {
    void Haptics.selectionAsync();
    setActiveIndex(index);
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const openMap = () => {
    if (!mapCoordinate) return;
    void Haptics.selectionAsync();
    void Linking.openURL(
      `https://maps.apple.com/?q=${encodeURIComponent(`${mapCoordinate.latitude},${mapCoordinate.longitude}`)}`,
    );
  };

  const handleAskStylist = () => {
    onClose();
    setTimeout(() => askStylistAboutItem(displayItem), 300);
  };

  const handleSaveCatalog = () => {
    const details = {
      productName: cleanText(catalogDraft.productName ?? null),
      brand: cleanText(catalogDraft.brand ?? null),
      productCode: cleanText(catalogDraft.productCode ?? null),
      purchaseUrl: cleanText(catalogDraft.purchaseUrl ?? null),
      priceOverride: priceDraft.trim() ? (parseShoppingAmount(priceDraft) ?? NaN) : null,
      currencyCode: cleanText(catalogDraft.currencyCode?.toUpperCase() ?? null),
      category: cleanText(catalogDraft.category),
      sizeLabel: cleanText(catalogDraft.sizeLabel),
      colorLabel: cleanText(catalogDraft.colorLabel),
      materialLabel: cleanText(catalogDraft.materialLabel),
      notes: cleanText(catalogDraft.notes),
    } satisfies ShoppingFindCatalogPatch;
    const original = catalogFromItem(displayItem);
    const patch = Object.fromEntries(Object.entries(details).filter(([key, value]) => {
      if (key === 'priceOverride' && (priceDraft.trim() ? parseShoppingAmount(priceDraft) : null) === displayItem.extractedPrice) return false;
      return value !== (original[key as keyof ShoppingFindCatalog] ?? null);
    })) as ShoppingFindCatalogPatch;
    setCatalogError(null);
    try { validateShoppingPatch(patch); } catch (error) { setCatalogError(error instanceof Error ? error.message : 'Check the details.'); return; }
    void saveCatalog(displayItem.captureGroupId, patch, original)
      .then(() => {
        setDisplayItem((current) => ({ ...current, ...patch, extractedPrice: patch.priceOverride ?? current.extractedPrice }));
        setCatalogEditing(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((error) => {
        setCatalogError(error instanceof Error ? error.message : 'Please try again.');
      });
  };

  const saveDecision = (patch: Pick<ShoppingFindCatalogPatch, 'catalogStatus' | 'isFavorite'>) => {
    if (decisionSaving) return;
    void Haptics.selectionAsync();
    const previous = displayItem;
    setDecisionSaving(true);
    setDecisionError(null);
    setDisplayItem((current) => ({ ...current, ...patch }));
    void saveCatalog(displayItem.captureGroupId, patch)
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (patch.catalogStatus === 'closet' && !displayItem.wardrobeItemId) Alert.alert('Marked as bought', 'Add this piece to your wardrobe now or come back later.', [{ text: 'Later', style: 'cancel' }, { text: 'Add to wardrobe', onPress: () => setWardrobeOpen(true) }]);
      })
      .catch((error) => {
        setDisplayItem(previous);
        setDecisionError(error instanceof Error ? error.message : 'Could not save that decision.');
      })
      .finally(() => setDecisionSaving(false));
  };

  const handleSaveOrganization = async (updates: Parameters<typeof saveOrganization>[0]) => {
    await saveOrganization(updates);
    setOrganizerOpen(false);
    // Photos may now belong to different items — closing avoids showing a stale grouping.
    onClose();
  };

  const handleDelete = () => {
    Alert.alert('Delete this piece?', 'These shopping photos will be removed from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteItem(displayItem)
            .then(onClose)
            .catch((error) => {
              Alert.alert('Could not delete', error instanceof Error ? error.message : 'Please try again.');
            });
        },
      },
    ]);
  };

  const capturedLabel = new Date(displayItem.capturedAt).toLocaleString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const locationSourceLabel = `${activePhoto.locationSource ? activePhoto.locationSource.replace('_', ' ') : 'Not captured'}${
    activePhoto.locationAccuracyMeters !== null ? ` · ~${Math.round(activePhoto.locationAccuracyMeters)} m` : ''
  }`;
  const syncLabel = displayItem.syncStatus === 'pending' ? SHORTLIST_COPY.onThisPhone : SHORTLIST_COPY.backedUp;

  return (
    <Modal visible animationType={reducedMotion ? 'none' : 'slide'} presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar style="light" />
      <View style={styles.root}>
        <ScrollView ref={contentScrollRef} bounces={false} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { height: heroHeight }]}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const page = Math.round(event.nativeEvent.contentOffset.x / width);
                setActiveIndex(Math.max(0, Math.min(page, photos.length - 1)));
              }}
            >
              {photos.map((photo) => (
                <View key={photo.id} style={{ width, height: heroHeight }}>
                  <Image
                    source={{ uri: photo.imageUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit={garmentFriendlyContentFit(photo)}
                    contentPosition="center"
                    cachePolicy="memory-disk"
                    recyclingKey={photo.id}
                    transition={200}
                    onLoad={(event) => {
                      const source = event.source;
                      if (source?.width && source?.height) {
                        setImageDimensions((current) => current[photo.id]
                          ? current
                          : { ...current, [photo.id]: { width: source.width, height: source.height } });
                      }
                    }}
                  />
                </View>
              ))}
            </ScrollView>
            <LinearGradient
              colors={['rgba(20, 15, 12, 0.4)', 'transparent']}
              style={styles.topScrim}
              pointerEvents="none"
            />
            <View style={[styles.rolePill, { top: insets.top + spacing.sm }]}>
              <Text style={styles.rolePillText}>{snapRoleLabel(activePhoto.captureRole)}</Text>
            </View>
          </View>

          {photos.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstrip}>
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id}
                  style={[styles.filmstripThumb, index === activeIndex && styles.filmstripThumbActive]}
                  onPress={() => jumpToPhoto(index)}
                  accessibilityLabel={`View photo ${index + 1} of ${photos.length}`}
                >
                  <Image source={{ uri: photo.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={photo.id} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <View style={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
            <Text style={styles.eyebrow}>{[displayItem.brand, displayItem.storeName].filter(Boolean).join(' · ')}</Text>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{shoppingPieceTitle(displayItem)}</Text>
              {price && resolvedCurrency ? <Text style={styles.price}>{price}</Text> : (
                <TouchableOpacity
                  testID="choose-price-button"
                  style={styles.priceAction}
                  accessibilityRole="button"
                  accessibilityLabel={priceActionLabel}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setPriceDraft(displayItem.extractedPrice?.toString() ?? '');
                    setCatalogDraft(catalogFromItem(displayItem));
                    setCatalogError(null);
                    setCatalogEditing(true);
                  }}
                >
                  <Text style={styles.priceActionLabel}>{priceActionLabel}</Text>
                  <Ionicons name="create-outline" size={14} color={colors.action} />
                </TouchableOpacity>
              )}
            </View>
            {showPriceChips ? (
              <View style={styles.priceChips}>
                <PriceCandidateChips
                  prompt={priceResolution.status === 'ambiguous' ? 'Which price?' : !resolvedCurrency && amount !== null ? 'Which currency?' : 'Read from the tag'}
                  candidates={priceCandidates}
                  selected={amount !== null && resolvedCurrency ? { amount, currencyCode: resolvedCurrency } : null}
                  disabled={isSavingCatalog}
                  onPick={pickPrice}
                />
                {priceChipError ? <Text selectable style={styles.catalogError}>{priceChipError}</Text> : null}
              </View>
            ) : null}
            {filledPriority ? (
              <View style={styles.briefChip} accessibilityLabel={`Fills your brief: ${sentenceCase(filledPriority.label)}`}>
                <Ionicons name="checkmark-circle" size={14} color={shoppingSurfaces.olive.accent} />
                <Text style={styles.briefChipText} numberOfLines={1}>
                  Fills your brief · <Text style={styles.briefChipStrong}>{sentenceCase(filledPriority.label)}</Text>
                </Text>
              </View>
            ) : null}
            <TouchableOpacity style={[styles.stylistRow, styles.stylistPrimary]} onPress={handleAskStylist} accessibilityRole="button">
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text style={styles.stylistRowText}>{SHORTLIST_COPY.askStylist}</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </TouchableOpacity>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            <ShoppingSyncNotice />
            <View style={styles.decisionSection}>
              <View style={styles.decisionHeader}>
                <Text style={styles.decisionLabel}>STATUS</Text>
                <TouchableOpacity
                  style={styles.favoriteButton}
                  onPress={() => saveDecision({ isFavorite: !displayItem.isFavorite })}
                  disabled={decisionSaving}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={displayItem.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  accessibilityState={{ selected: displayItem.isFavorite, disabled: decisionSaving }}
                >
                  <Ionicons name={displayItem.isFavorite ? 'heart' : 'heart-outline'} size={21} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.decisionChips}>
                {SHOPPING_CATALOG_STATUS_OPTIONS.map((option) => {
                  const active = displayItem.catalogStatus === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.decisionChip, active && styles.decisionChipActive]}
                      onPress={() => saveDecision({ catalogStatus: option.value })}
                      disabled={decisionSaving || active}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active, disabled: decisionSaving }}
                    >
                      <Text style={[styles.decisionChipText, active && styles.decisionChipTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {decisionError ? (
                <View style={styles.inlineError}>
                  <Text selectable style={styles.catalogError}>{decisionError}</Text>
                  <TouchableOpacity onPress={() => saveDecision({ catalogStatus: displayItem.catalogStatus, isFavorite: displayItem.isFavorite })} disabled={decisionSaving}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            <View style={styles.divider} />
            {tagSpecs.length > 0 ? (
              <Text style={styles.specs}>
                {tagSpecs.map((field) => `${field.label.toUpperCase()} ${field.value}`).join('   ·   ')}
              </Text>
            ) : null}
            {displayItem.notes && !catalogEditing ? <Text style={styles.notes}>“{displayItem.notes}”</Text> : null}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionPill, catalogEditing && styles.actionPillActive]}
                hitSlop={4}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setPriceDraft(displayItem.extractedPrice?.toString() ?? '');
                  setCatalogDraft(catalogFromItem(displayItem));
                  setCatalogError(null);
                  setCatalogEditing((editing) => !editing);
                }}
              >
                <Ionicons name="pricetag-outline" size={14} color={catalogEditing ? colors.primaryForeground : colors.foreground} />
                <Text style={[styles.actionPillText, catalogEditing && styles.actionPillTextActive]}>
                  {catalogEditing ? 'Cancel' : SHORTLIST_COPY.editDetails}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionPill} onPress={() => setMoreOpen(true)} accessibilityRole="button" accessibilityLabel="More piece options">
                <Ionicons name="ellipsis-horizontal" size={14} color={colors.foreground} />
                <Text style={styles.actionPillText}>More</Text>
              </TouchableOpacity>
              {mapCoordinate ? (
                <TouchableOpacity style={styles.actionPill} hitSlop={4} onPress={openMap}>
                  <Ionicons name="location-outline" size={14} color={colors.foreground} />
                  <Text style={styles.actionPillText}>Location</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {catalogEditing ? (
              <View
                style={styles.catalogEditor}
                onLayout={(event) => {
                  catalogEditorY.current = event.nativeEvent.layout.y;
                  requestAnimationFrame(() => {
                    contentScrollRef.current?.scrollTo({
                      y: Math.max(0, catalogEditorY.current - spacing.md),
                      animated: true,
                    });
                  });
                }}
              >
                <View style={styles.catalogFieldGrid}>
                  <CatalogField label="Price" value={priceDraft} onChange={setPriceDraft} />
                  <CatalogField label="Currency (CAD, EUR…)" value={catalogDraft.currencyCode ?? null} onChange={(value) => setCatalogDraft((current) => ({ ...current, currencyCode: value.toUpperCase() }))} />
                  <CatalogField label="Product name" value={catalogDraft.productName ?? null} onChange={(value) => setCatalogDraft((current) => ({ ...current, productName: value }))} />
                  <CatalogField label="Brand" value={catalogDraft.brand ?? null} onChange={(value) => setCatalogDraft((current) => ({ ...current, brand: value }))} />
                  <CatalogField label="Product code" value={catalogDraft.productCode ?? null} onChange={(value) => setCatalogDraft((current) => ({ ...current, productCode: value }))} />
                  <CatalogField label="Purchase link" value={catalogDraft.purchaseUrl ?? null} onChange={(value) => setCatalogDraft((current) => ({ ...current, purchaseUrl: value }))} />
                  <CatalogField label="Category" value={catalogDraft.category} onChange={(value) => setCatalogDraft((current) => ({ ...current, category: value }))} />
                  <CatalogField label="Size" value={catalogDraft.sizeLabel} onChange={(value) => setCatalogDraft((current) => ({ ...current, sizeLabel: value }))} />
                  <CatalogField label="Color" value={catalogDraft.colorLabel} onChange={(value) => setCatalogDraft((current) => ({ ...current, colorLabel: value }))} />
                  <CatalogField label="Material" value={catalogDraft.materialLabel} onChange={(value) => setCatalogDraft((current) => ({ ...current, materialLabel: value }))} />
                </View>
                {!catalogDraft.currencyCode ? <TouchableOpacity style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => setCatalogDraft((current) => ({ ...current, currencyCode: suggestedShoppingCurrency(priceCountry, currencyCode) }))}><Text style={{ color: colors.action }}>Use {suggestedShoppingCurrency(priceCountry, currencyCode)} currency</Text></TouchableOpacity> : null}
                <TextInput
                  value={catalogDraft.notes ?? ''}
                  onChangeText={(value) => setCatalogDraft((current) => ({ ...current, notes: value }))}
                  placeholder="Fit, styling ideas, sale context..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  style={styles.catalogNotesInput}
                />
                {catalogError ? <Text selectable style={styles.catalogError}>{catalogError}</Text> : null}
                <TouchableOpacity
                  style={[styles.catalogSaveButton, isSavingCatalog && styles.disabled]}
                  onPress={handleSaveCatalog}
                  disabled={isSavingCatalog}
                >
                  {isSavingCatalog ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                  )}
                  <Text style={styles.catalogSaveText}>Save details</Text>
                </TouchableOpacity>
              </View>
            ) : null}


            {displayItem.purchaseUrl ? <TouchableOpacity style={styles.stylistRow} onPress={() => { try { validateShoppingPatch({ purchaseUrl: displayItem.purchaseUrl }); void Linking.openURL(displayItem.purchaseUrl!).catch(() => Alert.alert('Could not open link')); } catch { Alert.alert('Edit the purchase link first.'); } }}><Text style={styles.stylistRowText}>Open purchase link</Text></TouchableOpacity> : null}
            {displayItem.catalogStatus === 'closet' ? <TouchableOpacity style={styles.stylistRow} onPress={() => { if (displayItem.wardrobeItemId) { onClose(); void Linking.openURL(`styled://wardrobe-item/${displayItem.wardrobeItemId}`); } else setWardrobeOpen(true); }}><Text style={styles.stylistRowText}>{displayItem.wardrobeItemId ? 'View in wardrobe' : 'Add to wardrobe'}</Text></TouchableOpacity> : null}
            {wardrobeOpen ? <ShoppingWardrobeForm item={displayItem} onClose={() => setWardrobeOpen(false)} onSaved={(id) => { setWardrobeOpen(false); setDisplayItem((current) => ({ ...current, wardrobeItemId: id })); }} /> : null}


            <View style={styles.badgeRow}>
              {badges.map((badge) => (
                <View key={badge.key} style={styles.badge}>
                  <View
                    style={[
                      styles.badgeDot,
                      badge.tone === 'attention' && styles.badgeDotAttention,
                      badge.tone === 'success' && styles.badgeDotSuccess,
                    ]}
                  />
                  <Text style={styles.badgeText}>{badge.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />
            <Text style={styles.detailsEyebrow}>DETAILS</Text>
            <View style={styles.detailRows}>
              <StoreDetailRow value={displayItem.storeName} onPress={onAssignStore} />
              <DetailRow label="Captured" value={capturedLabel} />
              <DetailRow label="Location" value={formatShoppingDetailLocation(displayItem)} />
            </View>

            {showCaptureInfo ? <View style={styles.disclosureCard} onLayout={(event) => contentScrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: !reducedMotion })}>
              <TouchableOpacity
                style={styles.disclosureToggle}
                onPress={() => setShowCaptureInfo((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showCaptureInfo ? `Hide ${SHORTLIST_COPY.captureInformation}` : `Show ${SHORTLIST_COPY.captureInformation}`}
              >
                <Text style={styles.disclosureLabel}>{SHORTLIST_COPY.captureInformation.toUpperCase()}</Text>
                <Ionicons name={showCaptureInfo ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showCaptureInfo ? (
                <View style={styles.detailRows}>
                  <DetailRow label="Role" value={itemRoleSummary(displayItem)} />
                  <DetailRow label="Location source" value={locationSourceLabel} />
                  <DetailRow label="Backup" value={syncLabel} />
                </View>
              ) : null}
            </View> : null}

            {showFullTag && tagOcrText.length > 0 ? (
              <View style={styles.disclosureCard} onLayout={(event) => contentScrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: !reducedMotion })}>
                <TouchableOpacity
                  style={styles.disclosureToggle}
                  onPress={() => setShowFullTag((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={showFullTag ? 'Hide tag text' : 'Show tag text'}
                >
                  <Text style={styles.disclosureLabel}>{SHORTLIST_COPY.tagDetails.toUpperCase()}</Text>
                  <Ionicons name={showFullTag ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
                {showFullTag ? (
                  <View style={styles.tagTextBlock}>
                    {tagSections.length > 0 ? tagSections.map((section, index) =>
                      section.type === 'header' ? (
                        <Text key={index} style={styles.tagHeader}>
                          {section.text}
                        </Text>
                      ) : section.type === 'item' ? (
                        <View key={index} style={styles.tagListRow}>
                          <Text style={styles.tagBullet}>{'•'}</Text>
                          <Text style={styles.tagItemText}>{section.text}</Text>
                        </View>
                      ) : (
                        <Text key={index} style={styles.tagText}>
                          {section.text}
                        </Text>
                      ),
                    ) : <Text selectable style={styles.tagText}>{tagOcrText}</Text>}
                  </View>
                ) : null}
              </View>
            ) : null}


          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + spacing.sm }]}
          onPress={onClose}
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ActionMenuSheet
        visible={moreOpen}
        title="Piece options"
        onClose={() => setMoreOpen(false)}
        options={[
          ...(canOrganize ? [{ label: 'Organize photos', icon: 'albums-outline' as const, onPress: () => setOrganizerOpen(true) }] : []),
          { label: 'Use this photo as cover', icon: 'image-outline', onPress: () => {
            void saveCatalog(displayItem.captureGroupId, { coverPhotoId: activePhoto.id })
              .then(() => setDisplayItem((current) => ({ ...current, primarySnap: activePhoto, coverPhotoId: activePhoto.id })))
              .catch((error) => Alert.alert('Could not save cover', error.message));
          } },
          { label: 'Capture information', icon: 'information-circle-outline', onPress: () => { setShowFullTag(false); setShowCaptureInfo(true); } },
          ...(tagOcrText.length ? [{ label: 'Tag text', icon: 'pricetag-outline' as const, onPress: () => { setShowCaptureInfo(false); setShowFullTag(true); } }] : []),
          { label: isDeleting ? 'Deleting…' : 'Delete this piece', icon: 'trash-outline', destructive: true, onPress: () => { if (!isDeleting) handleDelete(); } },
        ]}
      />
      <ShoppingSnapOrganizerModal
        visible={organizerOpen}
        snaps={displayItem.snaps}
        onClose={() => setOrganizerOpen(false)}
        onSave={handleSaveOrganization}
        isSaving={isSavingOrganization}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  stylistPrimary: { backgroundColor: colors.surfaceSubtle, borderRadius: radii.card, paddingHorizontal: spacing.md },
  root: { flex: 1, backgroundColor: colors.background },
  hero: { width: '100%', backgroundColor: colors.surfaceSubtle },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  rolePill: {
    position: 'absolute',
    left: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(250, 248, 245, 0.92)',
  },
  rolePillText: { ...typography.text.eyebrow, color: colors.foreground },
  filmstrip: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  filmstripThumb: {
    width: 46,
    height: 58,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceSubtle,
  },
  filmstripThumbActive: { borderColor: colors.primary },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  eyebrow: { ...typography.text.eyebrow, color: colors.primary },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1, ...typography.text.editorialTitle, color: colors.foreground },
  price: { fontSize: typography.text.sheetTitle.fontSize, color: colors.foreground, fontVariant: ['tabular-nums'] },
  priceAction: { maxWidth: '45%', minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, paddingHorizontal: spacing.xs },
  // A fix-it control, not a caption: set in action colour with a pencil so it
  // reads as the thing to tap, matching the pending price on every tile.
  priceChips: { marginTop: spacing.xs, gap: spacing.xs },
  priceActionLabel: { fontSize: typography.text.bodySmall.fontSize, fontWeight: typography.weight.semibold, color: colors.action },
  meta: { fontSize: typography.text.bodySmall.fontSize, letterSpacing: typography.tracking.compact, textTransform: 'uppercase', color: colors.mutedForeground },
  decisionSection: { gap: spacing.sm, paddingTop: spacing.sm },
  decisionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  decisionLabel: { ...typography.text.eyebrow, color: colors.primary },
  favoriteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.surfaceSubtle },
  decisionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  decisionChip: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  decisionChipActive: { borderColor: colors.foreground, backgroundColor: colors.foreground },
  decisionChipText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  decisionChipTextActive: { color: colors.primaryForeground },
  inlineError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  retryText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.action },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.sm, backgroundColor: colors.hairline },
  specs: { fontSize: typography.text.caption.fontSize, letterSpacing: typography.tracking.subtle, color: colors.secondaryForeground, fontVariant: ['tabular-nums'] },
  notes: { fontSize: typography.text.body.fontSize, lineHeight: 24, fontStyle: 'italic', color: colors.secondaryForeground },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  actionPill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  actionPillActive: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  actionPillText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.foreground },
  actionPillTextActive: { color: colors.primaryForeground },
  catalogEditor: { marginTop: spacing.sm, gap: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  catalogFieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  catalogField: { flexGrow: 1, flexBasis: '45%', gap: 4 },
  catalogFieldLabel: { ...typography.text.eyebrow, color: colors.mutedForeground },
  catalogFieldInput: {
    paddingVertical: 6,
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.foreground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  catalogNotesInput: {
    minHeight: 64,
    fontSize: typography.text.bodySmall.fontSize,
    lineHeight: 20,
    color: colors.foreground,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  catalogError: { fontSize: typography.text.caption.fontSize, color: colors.error },
  catalogSaveButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  disabled: { opacity: 0.6 },
  catalogSaveText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  briefChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 28, paddingHorizontal: spacing.sm, borderRadius: radii.full, backgroundColor: shoppingSurfaces.olive.wash },
  briefChipText: { flexShrink: 1, fontSize: typography.text.caption.fontSize, color: shoppingSurfaces.olive.accent },
  briefChipStrong: { fontWeight: typography.weight.semibold },
  stylistRow: {
    marginTop: spacing.xs,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stylistRowText: { flex: 1, fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.primary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mutedForeground },
  badgeDotAttention: { backgroundColor: colors.primary },
  badgeDotSuccess: { backgroundColor: colors.success },
  badgeText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.medium, color: colors.mutedForeground },
  detailsEyebrow: { ...typography.text.eyebrow, color: colors.primary },
  detailRows: { gap: spacing.sm, paddingTop: spacing.xs },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  detailLabel: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.mutedForeground },
  detailValue: { flex: 1, fontSize: typography.text.bodySmall.fontSize, textAlign: 'right', color: colors.foreground },
  detailValueAction: { fontWeight: typography.weight.medium, color: colors.action },
  disclosureCard: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  disclosureToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  disclosureLabel: { ...typography.text.eyebrow, color: colors.primary },
  tagTextBlock: { gap: spacing.xs },
  tagHeader: { ...typography.text.eyebrow, color: colors.primary, marginTop: spacing.xs },
  tagListRow: { flexDirection: 'row', gap: spacing.xs },
  tagBullet: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 21, color: colors.secondaryForeground },
  tagItemText: { flex: 1, fontSize: typography.text.bodySmall.fontSize, lineHeight: 21, color: colors.secondaryForeground },
  tagText: { fontSize: typography.text.bodySmall.fontSize, lineHeight: 21, color: colors.secondaryForeground },
  deleteTouch: { alignSelf: 'flex-start', marginTop: spacing.lg, paddingVertical: spacing.xs },
  deleteText: { fontSize: typography.text.caption.fontSize, fontWeight: typography.weight.semibold, color: colors.error },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(24, 20, 18, 0.5)',
  },
});
