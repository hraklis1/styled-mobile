import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkspaceSheet } from '../../wardrobe/scan-review/WorkspaceSheet';
import { PrimaryButton } from '../../wardrobe/scan-review/ActionBar';
import { TextLink } from '../../wardrobe/scan-review/atoms';
import { selectionFeedback } from '../../wardrobe/scan-review/feedback';
import { dispatchWear } from '../../../features/wear-log/store';
import type { Resolution, ReviewFlow, WearDetection } from '../../../features/wear-log/types';
import type { Item } from '../../../types/item';
import { colors, spacing, stroke, typography } from '../../../theme';
import { ClosetPicker } from './ClosetMatchSheet';
import { NewPieceEditor } from './NewPieceSheet';
import { LocateInPhoto, PieceImage } from './PieceImage';
import { PhotoHero } from './PhotoHero';
import { orderedDetections } from '../../../features/wear-log/reducer';

type Mode = 'review' | 'library' | 'new' | 'photo';

/** One native presentation owns the complete queue and its sub-screens. */
export function WearResolveSheet({ queue: initialQueue, startIndex = 0, reviewIds = [], initialPhoto = false, flow, items, reduceMotion, onClose }: {
  queue: string[]; startIndex?: number; reviewIds?: string[]; initialPhoto?: boolean; flow: ReviewFlow; items: Item[]; reduceMotion: boolean; onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(startIndex);
  const [mode, setMode] = useState<Mode>(initialPhoto ? 'photo' : flow.resolutions[queue[startIndex]]?.kind === 'new' ? 'new' : 'review');
  const [dismissed, setDismissed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Set when the photo was opened from a piece's thumbnail: where "Back" returns.
  const [returnTo, setReturnTo] = useState<Mode | null>(null);
  // Keep tentative choices through in-sheet browsing, but never persist them.
  const [pendingById, setPendingById] = useState<Record<string, number>>({});
  const id = queue[index];
  const detection = flow.scan.detections.find((d) => d.id === id);
  const resolution = flow.resolutions[id];
  const ordered = orderedDetections(flow.scan);
  const dimmedIds = new Set(ordered.filter((d) => flow.resolutions[d.id].kind === 'dismissed').map((d) => d.id));
  if (mode !== 'photo' && (!detection || !resolution)) return null;
  const locate = () => { Keyboard.dismiss(); setActiveId(id); setReturnTo(mode); setMode('photo'); };
  const openFromPhoto = (pieceId: string) => {
    setReturnTo(null);
    const at = reviewIds.indexOf(pieceId);
    setQueue(at >= 0 ? reviewIds : [pieceId]);
    setIndex(Math.max(0, at));
    setMode(flow.resolutions[pieceId].kind === 'new' ? 'new' : 'review');
  };
  const advance = () => {
    Keyboard.dismiss();
    dispatchWear({ type: 'closeResolve' });
    if (index === queue.length - 1) setDismissed(true);
    else { setIndex(index + 1); setMode('review'); }
  };
  const confirm = (itemId: number) => {
    if (!items.some((item) => item.id === itemId)) return;
    dispatchWear({ type: 'confirm', detectionId: id, itemId });
    advance();
  };
  const skip = () => { dispatchWear({ type: 'dismiss', detectionId: id }); advance(); };
  const addNew = () => { Keyboard.dismiss(); dispatchWear({ type: 'markNew', detectionId: id }); setMode('new'); };
  const close = () => { dispatchWear({ type: 'closeResolve' }); onClose(); };
  // A piece opened outside the review queue is an edit, not a step in a sequence.
  const editing = queue.length === 1 && !reviewIds.includes(id);
  const title = mode === 'library' ? 'Choose matching piece' : mode === 'new' ? 'New piece' : mode === 'photo' ? 'Your outfit' : editing ? 'Edit piece' : 'Match your pieces';
  const brands = [...new Set(Object.values(flow.resolutions).flatMap((r) => r.kind === 'new' && r.draft.brand ? [r.draft.brand] : []))];
  return <WorkspaceSheet title={title} detent="large" reduceMotion={reduceMotion} dismissed={dismissed} onClose={close}
    subtitle={mode === 'photo' || editing ? undefined : <Text style={styles.meta}>Piece {index + 1} of {queue.length}</Text>}
    headerAction={<View /* swipe down closes; the footer confirms */ />}
    footer={mode === 'new' ? <View style={styles.footerStack}>
      <PrimaryButton label={editing ? 'Save' : index === queue.length - 1 ? 'Add to outfit' : 'Save & next'} onPress={() => { selectionFeedback(); advance(); }} />
      <View style={styles.center}><TextLink label="Skip this piece" tone="muted" onPress={skip} /></View>
    </View> : mode === 'library' ? <View style={styles.links}><TextLink label="Add as new" onPress={addNew} /><TextLink label="Skip this piece" tone="muted" onPress={skip} /></View> : undefined}>
    {mode === 'photo' ? <View>
      {returnTo ? <Pressable style={styles.back} onPress={() => { setMode(returnTo); setReturnTo(null); }} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back to piece">
        <Ionicons name="chevron-back" size={16} color={colors.foreground} /><Text style={styles.backText}>Back to piece</Text>
      </Pressable> : null}
      <PhotoHero
        uri={flow.photoUri}
        width={width}
        height={height * 0.6}
        detections={ordered}
        activeId={activeId}
        dimmedIds={dimmedIds}
        onSelect={setActiveId}
        onOpen={openFromPhoto}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {ordered.map((d) => <Pressable key={d.id} onPress={() => (d.id === activeId ? openFromPhoto(d.id) : setActiveId(d.id))}
          style={[styles.stripItem, d.id === activeId && styles.stripActive, dimmedIds.has(d.id) && styles.dimmed]}
          accessibilityRole="button" accessibilityLabel={d.attributes.name} accessibilityState={{ selected: d.id === activeId }}>
          <PieceImage cropUrl={d.cropUrl} cutoutUrl={d.cutoutUrl} width={56} height={70} />
        </Pressable>)}
      </ScrollView>
      {activeId ? null : <Text style={[styles.meta, styles.stripHint]}>Tap a piece to see it in the photo</Text>}
    </View>
      : mode === 'new' && resolution.kind === 'new' && detection ? <>
        <Pressable style={styles.back} onPress={() => { Keyboard.dismiss(); dispatchWear({ type: 'clear', detectionId: id }); setMode('review'); }} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back to matches. Undo new piece">
          <Ionicons name="chevron-back" size={16} color={colors.foreground} /><Text style={styles.backText}>Back to matches</Text>
        </Pressable>
        <NewPieceEditor key={id} detection={detection} draft={resolution.draft} scanBrands={brands} onLocate={locate} onChange={(patch) => dispatchWear({ type: 'editDraft', detectionId: id, patch })} />
      </>
      : mode === 'library' ? <>
        <View style={styles.pad}><TextLink label="Back to comparison" onPress={() => { Keyboard.dismiss(); setMode('review'); }} /></View>
        <ClosetPicker key={id} detection={detection} items={items} currentItemId={resolution.kind === 'matched' ? resolution.itemId : null} onPick={confirm} />
      </> : detection ? <FocusedPiece
        key={id}
        detection={detection}
        resolution={resolution}
        initialItemId={pendingById[id]}
        onPendingChange={(itemId) => setPendingById((previous) => ({ ...previous, [id]: itemId }))}
        items={items}
        last={index === queue.length - 1}
        editing={editing}
        onConfirm={confirm}
        onBrowse={() => setMode('library')}
        onAddNew={addNew}
        onSkip={skip}
        onLocate={locate}
      /> : null}
  </WorkspaceSheet>;
}

/** Candidate taps stay local until the primary confirmation action. */
export function FocusedPiece({ detection, resolution, initialItemId, onPendingChange, items, last, editing = false, onConfirm, onBrowse, onAddNew, onSkip, onLocate }: {
  detection: WearDetection; resolution: Resolution; items: Item[]; last: boolean; editing?: boolean;
  onConfirm: (id: number) => void; onBrowse: () => void; onAddNew: () => void; onSkip: () => void;
  initialItemId?: number;
  onPendingChange: (id: number) => void;
  /** Show this piece outlined on the outfit photo. */
  onLocate?: () => void;
}) {
  const [pendingId, setPendingId] = useState<number | null>(initialItemId ?? (resolution.kind === 'matched' ? resolution.itemId : null));
  const selected = items.find((item) => item.id === pendingId);
  const ranked = detection.candidates.map((c) => items.find((item) => item.id === c.itemId)).filter((item): item is Item => !!item);
  const candidates = [...new Map(ranked.map((item) => [item.id, item])).values()].slice(0, 2);
  const heldCopy = detection.holdReason === 'occluded' ? 'Partly hidden in your photo' : detection.holdReason === 'lookalike' ? 'You own a few like this' : null;
  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.detected}>
        <LocateInPhoto name={detection.attributes.name} onPress={onLocate}>
          <PieceImage cropUrl={detection.cropUrl} cutoutUrl={detection.cutoutUrl} width={72} height={90} />
        </LocateInPhoto>
        <View style={styles.copy}>
          <Text style={styles.heading}>{detection.attributes.name}</Text>
          {detection.attributes.description ? <Text style={styles.meta} numberOfLines={2}>{detection.attributes.description}</Text> : null}
          {heldCopy ? <Text style={styles.attention}>{heldCopy}</Text> : null}
        </View>
      </View>
      {candidates.length ? <>
        <Text style={styles.heading}>Is this your piece?</Text>
        <View style={styles.candidates}>
          {candidates.map((item) => {
            const on = pendingId === item.id;
            return <Pressable key={item.id} onPress={() => { selectionFeedback(); setPendingId(item.id); onPendingChange(item.id); }} style={({ pressed }) => [styles.candidate, pendingId != null && !on && styles.unselected, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${item.name}${item.brand ? `, ${item.brand}` : ''}`} accessibilityState={{ selected: on }}>
              <View style={[styles.candidateImage, on && styles.selected]}><PieceImage item={item} width="100%" height={140} /></View>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>{item.brand ? <Text style={styles.meta}>{item.brand}</Text> : null}
              {on ? <View style={styles.tick}><Ionicons name="checkmark" size={14} color={colors.primaryForeground} /></View> : null}
            </Pressable>;
          })}
          <Pressable onPress={onAddNew} style={({ pressed }) => [styles.candidate, pendingId != null && styles.unselected, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Add as a new piece">
            <View style={[styles.candidateImage, styles.newTile]}><View style={styles.newBadge}><Ionicons name="add" size={20} color={colors.foreground} /></View></View>
            <Text style={styles.name}>New piece</Text><Text style={styles.meta}>Not in my closet</Text>
          </Pressable>
        </View>
      </> : <>
        <Text style={styles.heading}>Is this piece in your closet?</Text>
        <Pressable onPress={onAddNew} style={({ pressed }) => [styles.option, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Add as a new piece">
          <View style={styles.optionIcon}><Ionicons name="add" size={18} color={colors.primaryForeground} /></View>
          <View style={styles.copy}><Text style={styles.optionTitle}>Add as new piece</Text><Text style={styles.meta}>Saved to your closet when you log</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>
      </>}
      {selected && !candidates.some((item) => item.id === selected.id) ? <View style={styles.current}><PieceImage item={selected} width={48} height={60} /><View style={styles.copy}><Text style={styles.name}>{selected.name}</Text><Text style={styles.meta}>Current match</Text></View></View> : null}
      <Pressable onPress={onBrowse} style={({ pressed }) => [styles.browse, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={candidates.length ? 'Browse closet' : 'Find it in my closet'}>
        <Text style={styles.name}>{candidates.length ? 'Browse closet' : 'Find it in my closet'}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </Pressable>
    </ScrollView>
    <View style={styles.footer}>
      {/* Anchored: always here, faded until a pick, so the footer never jumps. */}
      <PrimaryButton label={editing ? 'Save' : last ? 'Add to outfit' : 'Save & next'} disabled={!selected} onPress={() => { if (selected) { selectionFeedback(); onConfirm(selected.id); } }} />
      <View style={styles.center}><TextLink label="Skip this piece" tone="muted" onPress={onSkip} /></View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { paddingHorizontal: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md },
  detected: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.sm },
  heading: { ...typography.text.editorialSection, color: colors.foreground },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
  attention: { ...typography.text.meta, color: colors.accentInk },
  candidates: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  candidate: { flex: 1, minWidth: 0, gap: 4 },
  candidateImage: { borderWidth: 2, borderColor: 'transparent', marginBottom: 2 },
  selected: { borderColor: colors.foreground },
  unselected: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
  // Same footprint as a wardrobe photo (140 + the 2pt selection ring each side).
  newTile: { height: 144, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSubtle, borderColor: colors.controlOutline, borderWidth: stroke.hairline },
  newBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: stroke.hairline, borderColor: colors.controlOutline },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSubtle, minHeight: 72, borderWidth: stroke.hairline, borderColor: colors.controlOutline },
  footerStack: { gap: spacing.xs },
  optionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { ...typography.text.bodySmall, fontWeight: typography.weight.medium, color: colors.foreground },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36, paddingHorizontal: spacing.lg - 4, alignSelf: 'flex-start' },
  backText: { ...typography.text.meta, color: colors.foreground },
  center: { alignItems: 'center' },
  browse: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, borderTopWidth: stroke.hairline, borderBottomWidth: stroke.hairline, borderColor: colors.hairline },
  end: { justifyContent: 'flex-end' },
  tick: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.text.bodySmall, color: colors.foreground },
  current: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1 },
  footer: { gap: spacing.xs, borderTopWidth: stroke.hairline, borderTopColor: colors.hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  strip: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  // An offset ring with a little lift: the photo is never clipped by it.
  stripItem: { padding: 3, borderWidth: stroke.fine, borderColor: 'transparent', opacity: 0.7, backgroundColor: colors.background },
  stripActive: { borderColor: colors.foreground, opacity: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  stripHint: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  dimmed: { opacity: 0.3 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
});
