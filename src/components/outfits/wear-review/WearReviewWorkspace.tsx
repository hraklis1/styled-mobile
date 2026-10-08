import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, SectionList, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';

import { DetectionState } from '../../wardrobe/scan-review/LoadingStates';
import { SlowScanHint } from '../../wardrobe/scan-review/SlowScanHint';
import { PolishRow, PrimaryButton, actionBarStyle } from '../../wardrobe/scan-review/ActionBar';
import { usePolishChoice } from '../../wardrobe/scan-review/usePolishChoice';
import { enqueuePolish } from '../../../features/polish-queue/runner';
import { useAuth } from '../../../contexts/AuthContext';
import { OutlinePill, TextLink } from '../../wardrobe/scan-review/atoms';
import { cropFeedback, selectionFeedback } from '../../wardrobe/scan-review/feedback';
import { localISODay } from '../../../lib/dates';
import { presentPaywall } from '../../../lib/paywall';
import { UndoToast } from '../../primitives/UndoToast';
import { useReviewReducedMotion } from '../../../hooks/useReviewReducedMotion';
import { applySavedItems, useItems } from '../../../hooks/useItems';
import { OUTFIT_LOGS_QUERY_KEY } from '../../../hooks/useOutfitLogs';
import { track } from '../../../lib/analytics';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import type { Item } from '../../../types/item';
import { saveWearLog } from '../../../features/wear-log/api';
import { canLog, matchedItemIds, newDetections, orderedDetections, reviewCounts, reviewQueue, selectedItemIds, sharedMatch } from '../../../features/wear-log/reducer';
import { discardWearFlow, retryWearScan } from '../../../features/wear-log/runner';
import { dispatchWear, useWearLogStore } from '../../../features/wear-log/store';
import type { ReviewFlow, WearDetection } from '../../../features/wear-log/types';
import { ClosetPicker } from './ClosetMatchSheet';
import { WorkspaceSheet } from '../../wardrobe/scan-review/WorkspaceSheet';
import { ScanOptionsRows, scanOptionsRowCount } from '../../wardrobe/scan-review/MenuRows';
import { WearResolveSheet, type CropRequest } from './WearResolveSheet';
import { CropAdjustEditor } from '../../wardrobe/CropAdjustModal';
import { PieceImage } from './PieceImage';
import { WornDateSheet } from './WornDateSheet';
import { PairingRow } from './PairingRow';
import { OutfitPhotoHeader, photoHeaderHeight } from './OutfitPhotoHeader';

type Surface = { kind: 'resolve'; queue: string[]; startIndex?: number; initialPhoto?: boolean } | { kind: 'add' } | { kind: 'date' } | ({ kind: 'crop' } & CropRequest);

const FULL_BOX = { x: 0, y: 0, width: 100, height: 100 };

type DateChoice = 'today' | 'yesterday' | 'other';

const isoDay = localISODay;

function dateChoice(date: string): DateChoice {
  if (date === isoDay(0)) return 'today';
  if (date === isoDay(-1)) return 'yesterday';
  return 'other';
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const pieces = (n: number) => (n === 1 ? '1 piece' : `${n} pieces`);

/**
 * The outfit logger's scan: processing → review → logged, in one surface.
 * State lives in the wear-log store (persisted), so closing the logger or
 * the app mid-review resumes where it was; this component only renders it.
 */
export function WearReviewWorkspace({ onClose, onMinimize, onLogged, onPickManually }: {
  onClose: () => void;
  /** Close the logger and let the scan finish; the tray stands in for it. */
  onMinimize: () => void;
  onLogged: () => void;
  /** Leave the scan for the hand-picked logger (credits, a bad photo). */
  onPickManually: () => void;
}) {
  const flow = useWearLogStore((s) => s.flow);
  const setWorkspaceOpen = useWearLogStore((s) => s.setWorkspaceOpen);
  const reduceMotion = useReviewReducedMotion();
  useEffect(() => {
    setWorkspaceOpen(true);
    return () => setWorkspaceOpen(false);
  }, [setWorkspaceOpen]);
  const safe = useSafeAreaInsets();
  // The logger is an iOS page sheet, which already starts below the status
  // bar; the window's top inset would push the header down a second time.
  const insets = { top: Platform.OS === 'ios' ? 0 : safe.top, bottom: safe.bottom };
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.round(height * 0.32);

  if (flow.status === 'processing' || flow.status === 'failed') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Log today’s wear" onClose={onClose} right={<ScanOptions detail="This photo and its scan" reduceMotion={reduceMotion} onMinimize={onMinimize} onDiscard={onClose} />} />
        {flow.status === 'processing' ? (
          <DetectionState
            previewImage={flow.photoUri}
            progress={{ current: 0, total: 0 }}
            heroHeight={heroHeight}
            reduceMotion={reduceMotion}
            title="Reading your outfit"
            stepLabels={['Detect', 'Match']}
          />
        ) : null}
        {flow.status === 'processing' ? (
          <View style={[styles.bar, styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <SlowScanHint watchKey={flow.id} background={{ onPress: onMinimize }}>
              <View style={styles.center}>
                <TextLink label="Pick the pieces yourself" tone="muted" onPress={onPickManually} />
              </View>
            </SlowScanHint>
          </View>
        ) : (
          <View style={styles.failed} accessibilityLiveRegion="polite">
            <Image source={{ uri: flow.photoUri }} style={{ width, height: heroHeight }} contentFit="contain" />
            <Text style={styles.failedTitle}>{flow.offline ? 'Saved for when you’re back online' : 'That didn’t go through'}</Text>
            <Text style={styles.failedCopy}>{flow.message}</Text>
            <View style={[styles.bar, styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              {flow.offline
                ? <PrimaryButton label="Keep it for later" onPress={onMinimize} />
                : flow.needsCredits
                  // As in the closet scan: top up, then the same photo is read with no re-pick.
                  ? <PrimaryButton label="Get credits" onPress={() => { void presentPaywall().then((ok) => { if (ok && !retryWearScan()) onPickManually(); }); }} />
                  : <PrimaryButton label="Try again" onPress={() => { if (!retryWearScan()) onPickManually(); }} />}
              <View style={styles.center}><TextLink label="Pick the pieces yourself" onPress={onPickManually} /></View>
            </View>
          </View>
        )}
      </View>
    );
  }

  if (flow.status === 'logged') {
    return <Logged flow={flow} topInset={insets.top} onDone={onLogged} />;
  }

  if (flow.status === 'idle') return null;

  return (
    <Review
      flow={flow}
      screenHeight={height}
      width={width}
      insets={insets}
      reduceMotion={reduceMotion}
      onClose={onClose}
      onMinimize={onMinimize}
    />
  );
}

/** "⋯" in the header, as in the closet scan: keep for later, or discard with a second tap. */
function ScanOptions({ detail, disabled, reduceMotion, onMinimize, onDiscard }: {
  detail: string; disabled?: boolean; reduceMotion: boolean; onMinimize: () => void; onDiscard: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const then = (fn: () => void) => { setDismissed(true); fn(); };
  return <>
    <Pressable onPress={() => { setDismissed(false); setOpen(true); }} disabled={disabled} style={styles.more} hitSlop={4}
      accessibilityRole="button" accessibilityLabel="More options" accessibilityState={{ disabled }}>
      <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
    </Pressable>
    {open ? <View style={styles.sheetHost} pointerEvents="box-none">
      <WorkspaceSheet title="Outfit options" detent="fit" rows={scanOptionsRowCount(onMinimize)} reduceMotion={reduceMotion} dismissed={dismissed} onClose={() => setOpen(false)}>
        <ScanOptionsRows onKeep={() => then(onMinimize)} discardLabel="Discard scan" detail={detail}
          onDiscard={() => then(() => { discardWearFlow(); onDiscard(); })} />
      </WorkspaceSheet>
    </View> : null}
  </>;
}

function Header({ title, onClose, right }: { title: string; onClose: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }} hitSlop={4} accessibilityRole="button" accessibilityLabel="Close">
        <Ionicons name="close" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} accessibilityRole="header">{title}</Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

function Review({ flow, screenHeight, width, insets, reduceMotion, onClose, onMinimize }: {
  flow: ReviewFlow;
  screenHeight: number;
  width: number;
  insets: { top: number; bottom: number };
  reduceMotion: boolean;
  onClose: () => void;
  onMinimize: () => void;
}) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const photoHeight = photoHeaderHeight(width, screenHeight, natural);
  const qc = useQueryClient();
  const { data: items = [], isSuccess, isError, refetch } = useItems();
  const itemsById = useMemo(() => new Map<number, Item>(items.map((i) => [i.id, i])), [items]);
  const availableIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const [surface, setSurface] = useState<Surface | null>(null);
  const ordered = useMemo(() => orderedDetections(flow.scan), [flow.scan]);
  const numbers = useMemo(() => Object.fromEntries(ordered.map((d, i) => [d.id, i + 1])), [ordered]);
  const counts = reviewCounts(flow);
  const queue = reviewQueue(flow, isSuccess ? availableIds : undefined);
  const missingAdditional = isSuccess ? flow.additionalItemIds.filter((id) => !availableIds.has(id)) : [];
  const saving = flow.status === 'saving';
  const [accessoriesOpen, setAccessoriesOpen] = useState(false);
  const sections = useMemo(() => {
    const accessories = ordered.filter((d) => d.layer === 'accessory');
    // Three or more small pieces fold into one row so the list reads as clothes first.
    const fold = accessories.length >= 3;
    const rest = fold ? ordered.filter((d) => d.layer !== 'accessory') : ordered;
    // One list in layer order: a row's status pill changes as it's resolved,
    // but the row never jumps between headers.
    return [
      ...(rest.length ? [{ key: 'pieces', title: '', data: rest }] : []),
      ...(fold ? [{ key: 'accessories', title: 'Accessories', data: accessoriesOpen ? accessories : [], all: accessories }] : []),
    ];
  }, [ordered, accessoriesOpen]);
  const ready = ordered.filter((d) => !queue.includes(d.id) && flow.resolutions[d.id]?.kind !== 'dismissed').length;
  const openPiece = (id: string) => {
    if (saving) return;
    // Tapping a queued row starts the guided review there instead of a one-piece queue.
    const at = queue.indexOf(id);
    setSurface(at >= 0 ? { kind: 'resolve', queue, startIndex: at } : { kind: 'resolve', queue: [id] });
  };
  // Medium matches the scan pre-filled; one tap accepts them all.
  const suggested = isSuccess ? queue.filter((id) => {
    const r = flow.resolutions[id];
    return r?.kind === 'matched' && r.source === 'suggested' && availableIds.has(r.itemId);
  }) : [];
  const acceptSuggested = () => {
    selectionFeedback();
    for (const id of suggested) {
      const r = flow.resolutions[id];
      if (r?.kind === 'matched') dispatchWear({ type: 'confirm', detectionId: id, itemId: r.itemId });
    }
  };
  // Skipping a piece (here or in the guided sheet) gets a moment to take it back.
  const [skipToast, setSkipToast] = useState<{ id: string; name: string } | null>(null);
  const dismissedKey = ordered.filter((d) => flow.resolutions[d.id]?.kind === 'dismissed').map((d) => d.id).join(',');
  const prevDismissed = useRef(dismissedKey);
  useEffect(() => {
    const before = new Set(prevDismissed.current.split(',').filter(Boolean));
    prevDismissed.current = dismissedKey;
    const added = dismissedKey.split(',').filter((id) => id && !before.has(id));
    if (!added.length) { if (skipToast && !dismissedKey.split(',').includes(skipToast.id)) setSkipToast(null); return; }
    const d = ordered.find((o) => o.id === added[added.length - 1]);
    if (d) setSkipToast({ id: d.id, name: d.attributes.name });
  }, [dismissedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!skipToast) return;
    const t = setTimeout(() => setSkipToast(null), 4000);
    return () => clearTimeout(t);
  }, [skipToast]);
  const closeSurface = (crop?: CropRequest) => {
    if (crop) { setSurface({ kind: 'crop', ...crop }); return; }
    dispatchWear({ type: 'closeResolve' });
    setSurface(null);
  };
  // Back to the same piece, in the same walk, once the crop is applied or cancelled.
  const resumeAfterCrop = (crop: CropRequest) => setSurface({ kind: 'resolve', queue: crop.queue, startIndex: crop.index });
  const cropTarget = surface?.kind === 'crop' ? flow.scan.detections.find((d) => d.id === surface.detectionId) : undefined;
  const cropResolution = surface?.kind === 'crop' ? flow.resolutions[surface.detectionId] : undefined;

  // New pieces join the closet when the outfit is logged; they can get a
  // polished cover like any import, on the same terms (Premium, credits).
  const { user } = useAuth();
  const polish = usePolishChoice();
  const newCount = newDetections(flow).length;
  const polishing = polish.polishAll && newCount > 0;
  const polishRef = useRef(polishing);
  polishRef.current = polishing;

  const save = useCallback(async () => {
    const current = useWearLogStore.getState().flow;
    if (current.status !== 'reviewing' || !canLog(current) || !isSuccess
      || selectedItemIds(current).some((id) => !availableIds.has(id))) return;
    dispatchWear({ type: 'saveStarted' });
    try {
      const saved = await saveWearLog(current);
      applySavedItems(qc, saved.createdItems);
      // Queued only once the log has landed, so a polish can never hold it up or fail it.
      if (polishRef.current && user && saved.createdItems.length) enqueuePolish(user.id, saved.createdItems);
      void qc.invalidateQueries({ queryKey: OUTFIT_LOGS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ['items'] });
      cropFeedback(true);
      track('outfit_scan_review_completed', {
        matched_count: matchedItemIds(current).length,
        new_count: saved.createdItems.length,
        manually_added_count: current.additionalItemIds.length,
        skipped_count: Object.values(current.resolutions).filter((r) => r.kind === 'dismissed').length,
        already_logged_count: saved.alreadyLoggedItemIds.length,
        polish_count: polishRef.current ? saved.createdItems.length : 0,
      });
      dispatchWear({ type: 'saved', logId: saved.logId, itemIds: saved.itemIds, alreadyLoggedItemIds: saved.alreadyLoggedItemIds });
    } catch (err) {
      cropFeedback(false);
      const offline = !(err as { response?: unknown })?.response;
      dispatchWear({ type: 'saveFailed', message: offline ? 'You’re offline. Your review is saved — log it when you’re back.' : 'Couldn’t log this outfit. Try again.' });
    }
  }, [qc, availableIds, isSuccess, user]);
  const dateLabel = dateChoice(flow.date) === 'today' ? 'Worn today' : dateChoice(flow.date) === 'yesterday' ? 'Worn yesterday' : `Worn ${shortDate(flow.date)}`;
  const buttonLabel = saving ? 'Logging' : queue.length ? `Review pieces · ${queue.length} left` : 'Log outfit';
  const status = queue.length ? `${queue.length} to confirm${ready ? ` · ${ready} ready` : ''}`
    : counts.newItems ? `${pieces(counts.logging)} selected` : `${pieces(counts.logging)} matched`;
  return (
    <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="Review outfit" onClose={onClose} right={<ScanOptions detail="This photo and your review" disabled={saving} reduceMotion={reduceMotion} onMinimize={onMinimize} onDiscard={onClose} />} />
      <View style={styles.body}>
        <SectionList sections={sections} keyExtractor={(d) => d.id} style={styles.body} stickySectionHeadersEnabled={false}
          ListHeaderComponent={<View>
            <OutfitPhotoHeader uri={flow.photoUri} width={width} height={photoHeight} onNatural={setNatural} disabled={saving} onPress={() => setSurface({ kind: 'resolve', queue: [], initialPhoto: true })} />
            <View style={styles.summary}>
              <View style={styles.summaryHead}>
                <Text style={styles.summaryTitle} accessibilityRole="header">Your outfit</Text>
                <Pressable style={({ pressed }) => [styles.dateChip, pressed && styles.pressed]} disabled={saving} onPress={() => setSurface({ kind: 'date' })} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${dateLabel}. Change date`}>
                  <Ionicons name="calendar-outline" size={15} color={colors.foreground} /><Text style={styles.dateText}>{dateLabel}</Text><Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <Text style={styles.summaryMeta} accessibilityLiveRegion="polite">{status}</Text>
            </View>
            {suggested.length >= 2 && !saving ? <View style={styles.pillWrap}><OutlinePill icon="checkmark" label={`Accept ${suggested.length} suggested matches`} onPress={acceptSuggested} /></View> : null}
            {ordered.length === 0 ? <Text style={styles.failedCopy}>We couldn’t make out any clothes. Add pieces from your closet, or retake the photo.</Text> : null}
          </View>}
          renderSectionHeader={({ section }) => section.key === 'accessories'
            ? <AccessoriesHeader pieces={section.all ?? []} open={accessoriesOpen} toConfirm={(section.all ?? []).filter((d) => queue.includes(d.id)).length} onToggle={() => setAccessoriesOpen((o) => !o)} />
            : section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
          renderItem={({ item: d }) => <PairingRow detection={d} resolution={flow.resolutions[d.id]} itemsById={itemsById} sharedWith={sharedMatch(flow, d.id).map((id) => numbers[id])} wardrobeReady={!!isSuccess} disabled={saving}
            onOpen={() => openPiece(d.id)} onRestore={() => dispatchWear({ type: 'restore', detectionId: d.id })} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={<View style={styles.listFooter}>
            {flow.additionalItemIds.map((id) => {
              const item = itemsById.get(id);
              const missing = isSuccess && !item;
              const duplicated = matchedItemIds(flow).includes(id);
              return <View style={styles.additionalRow} key={id}>
                <PieceImage item={item} />
                <View style={styles.additionalCopy}><Text style={styles.itemName} numberOfLines={2}>{item?.name ?? (missing ? 'Piece no longer in your closet' : 'Loading piece…')}</Text>
                  <Text style={[styles.meta, missing && styles.error]}>{missing ? 'Remove this piece to continue' : [item?.brand, 'Added manually'].filter(Boolean).join(' · ')}</Text>
                  {duplicated ? <Text style={styles.meta}>Also matched in your photo · logged once</Text> : null}
                </View>
                <TextLink label="Remove" disabled={saving} onPress={() => dispatchWear({ type: 'removeAdditionalItem', itemId: id })} accessibilityLabel={`Remove ${item?.name ?? 'missing piece'}`} />
              </View>;
            })}
            <View style={styles.pillWrap}><OutlinePill label="Add another piece" disabled={saving || !isSuccess} onPress={() => setSurface({ kind: 'add' })} /></View>
          </View>}
          contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} />
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {flow.saveError ? <Text style={styles.error} accessibilityLiveRegion="assertive">{flow.saveError}</Text> : null}
          {missingAdditional.length ? <Text style={styles.error}>Remove unavailable pieces before logging.</Text> : null}
          {newCount > 0 && !queue.length && !saving ? <PolishRow state={{
            count: polishing ? newCount : 0,
            total: newCount,
            cost: polish.costFor(newCount),
            balance: polish.balance,
            locked: !polish.isPremium,
            onToggle: (next) => { void polish.setAll(next); },
          }} /> : null}
          {!isSuccess ? <View style={styles.loadingRow}><Text style={styles.meta}>{isError ? 'Couldn’t load your closet' : 'Loading your closet…'}</Text>{isError ? <TextLink label="Try again" onPress={() => { void refetch(); }} /> : null}</View> : null}
          <PrimaryButton label={buttonLabel} busy={saving} variant={queue.length && !saving ? 'secondary' : 'primary'} disabled={saving || !isSuccess || (!queue.length && (!canLog(flow) || missingAdditional.length > 0))}
            onPress={() => { if (queue.length) setSurface({ kind: 'resolve', queue }); else void save(); }} />
        </View>
      </View>
      {skipToast && !surface ? <UndoToast message={`Not logging ${skipToast.name}`} bottom={Math.max(insets.bottom, spacing.md) + 132}
        onUndo={() => { dispatchWear({ type: 'restore', detectionId: skipToast.id }); setSkipToast(null); }} /> : null}
      <View style={styles.sheetHost} pointerEvents="box-none">
        {surface?.kind === 'resolve' ? <WearResolveSheet queue={surface.queue} startIndex={surface.startIndex} reviewIds={queue} initialPhoto={surface.initialPhoto} flow={flow} items={items} reduceMotion={reduceMotion} onClose={closeSurface} />
          : surface?.kind === 'add' ? <AdditionalPieceSheet items={items} selectedIds={selectedItemIds(flow)} reduceMotion={reduceMotion} onClose={closeSurface} />
          : surface?.kind === 'date' ? <WornDateSheet date={flow.date} reduceMotion={reduceMotion} onSelect={(date) => dispatchWear({ type: 'setDate', date })} onClose={closeSurface} /> : null}
        {surface?.kind === 'crop' && cropTarget && cropResolution?.kind === 'new' ? (
          <Modal visible animationType={reduceMotion ? 'fade' : 'slide'} presentationStyle="fullScreen" onRequestClose={() => resumeAfterCrop(surface)}>
            <GestureHandlerRootView style={styles.root}>
              <CropAdjustEditor
                sourceImage={flow.photoUri}
                initialBbox={cropResolution.draft.cropBbox ?? cropTarget.bbox_pct ?? FULL_BOX}
                itemName={cropResolution.draft.name || cropTarget.attributes.name}
                onApply={(bbox) => { dispatchWear({ type: 'editDraft', detectionId: cropTarget.id, patch: { cropBbox: bbox } }); resumeAfterCrop(surface); }}
                onCancel={() => resumeAfterCrop(surface)}
              />
            </GestureHandlerRootView>
          </Modal>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

function AccessoriesHeader({ pieces: list, open, toConfirm, onToggle }: {
  pieces: WearDetection[]; open: boolean; toConfirm: number; onToggle: () => void;
}) {
  return <Pressable style={styles.accessories} onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}
    accessibilityLabel={`Accessories, ${list.length} pieces${toConfirm ? `, ${toConfirm} to confirm` : ''}`}>
    <View style={styles.accessoryCopy}>
      <Text style={styles.itemName}>Accessories · {list.length}</Text>
      {toConfirm ? <Text style={styles.meta}>{toConfirm} to confirm</Text> : null}
    </View>
    {!open ? <View style={styles.accessoryStrip}>{list.slice(0, 4).map((d) => <PieceImage key={d.id} cropUrl={d.cropUrl} cutoutUrl={d.cutoutUrl} width={32} height={40} />)}</View> : null}
    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
  </Pressable>;
}

function AdditionalPieceSheet({ items, selectedIds, reduceMotion, onClose }: {
  items: Item[]; selectedIds: number[]; reduceMotion: boolean; onClose: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  return <WorkspaceSheet title="Add missing piece" detent="large" reduceMotion={reduceMotion} dismissed={dismissed} onClose={onClose}>
    <ClosetPicker items={items} unavailableIds={selectedIds} onPick={(itemId) => { dispatchWear({ type: 'addAdditionalItem', itemId }); setDismissed(true); }} />
  </WorkspaceSheet>;
}

function Logged({ flow, topInset, onDone }: {
  flow: Extract<ReturnType<typeof useWearLogStore.getState>['flow'], { status: 'logged' }>;
  topInset: number;
  onDone: () => void;
}) {
  useEffect(() => {
    cropFeedback(true);
    // Close first, then clear the flow, so the sheet leaves on this screen.
    const t = setTimeout(() => { onDone(); discardWearFlow(); }, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  const already = flow.alreadyLoggedItemIds.length;
  const when = dateChoice(flow.date) === 'today' ? 'Today' : dateChoice(flow.date) === 'yesterday' ? 'Yesterday' : shortDate(flow.date);
  return (
    <View style={[styles.root, styles.logged, { paddingTop: topInset }]} accessibilityLiveRegion="polite">
      <View>
        <Image source={{ uri: flow.photoUri }} style={styles.loggedPhoto} contentFit="cover" />
        <View style={styles.loggedBadge}><Ionicons name="checkmark" size={16} color={colors.primaryForeground} /></View>
      </View>
      <Text style={styles.loggedTitle}>Logged</Text>
      <Text style={styles.loggedMeta}>{pieces(flow.itemIds.length)} · {when}</Text>
      {already ? (
        <Text style={styles.failedCopy}>{`${pieces(already)} ${already === 1 ? 'was' : 'were'} already logged that day and counted once.`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  sheetHost: { position: 'absolute', width: 0, height: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerTitle: { ...typography.text.editorialSection, color: colors.foreground, flex: 1 },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerRight: { minWidth: 44, alignItems: 'flex-end' },
  summary: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: 4 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryTitle: { ...typography.text.editorialSection, color: colors.foreground, flexShrink: 1 },
  // Scrolls with the list and always clears the sticky bar below it.
  listFooter: { paddingBottom: spacing.xl },
  pillWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  summaryMeta: { ...typography.text.meta, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.2 },
  additionalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline },
  additionalCopy: { flex: 1, gap: 4 },
  itemName: { ...typography.text.bodySmall, color: colors.foreground },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...typography.text.meta, color: colors.mutedForeground, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs },
  accessories: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 64, marginTop: spacing.sm, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline },
  accessoryCopy: { flex: 1, gap: 4 },
  accessoryStrip: { flexDirection: 'row', gap: spacing.xs },
  separator: { height: stroke.hairline, backgroundColor: colors.hairline, marginLeft: spacing.lg },
  bar: actionBarStyle,
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: spacing.md, borderRadius: 16, borderWidth: stroke.fine, borderColor: colors.controlOutline },
  dateText: { ...typography.text.meta, color: colors.foreground },
  pressed: { opacity: 0.6 },
  error: { ...typography.text.meta, color: colors.error },
  failed: { flex: 1, alignItems: 'center', gap: spacing.sm },
  failedTitle: { ...typography.text.editorialSection, color: colors.foreground, textAlign: 'center', marginTop: spacing.lg },
  failedCopy: { ...typography.text.bodySmall, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: spacing.xl },
  center: { alignItems: 'center' },
  bottom: { marginTop: 'auto', alignSelf: 'stretch' },
  logged: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loggedTitle: { ...typography.text.editorialSection, color: colors.foreground, marginTop: spacing.md },
  loggedMeta: { ...typography.text.meta, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 1.2 },
  loggedPhoto: { width: 112, height: 140, borderRadius: radii.photo, backgroundColor: colors.surfaceSubtle },
  loggedBadge: { position: 'absolute', right: -10, bottom: -10, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.background },
});
