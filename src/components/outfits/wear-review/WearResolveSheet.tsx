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
import { PieceImage } from './PieceImage';
import { PhotoHero } from './PhotoHero';
import { orderedDetections } from '../../../features/wear-log/reducer';

type Mode = 'review' | 'library' | 'new' | 'photo';

/** One native presentation owns the complete queue and its sub-screens. */
export function WearResolveSheet({ queue: initialQueue, initialPhoto = false, flow, items, reduceMotion, onClose }: {
  queue: string[]; initialPhoto?: boolean; flow: ReviewFlow; items: Item[]; reduceMotion: boolean; onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>(initialPhoto ? 'photo' : flow.resolutions[queue[0]]?.kind === 'new' ? 'new' : 'review');
  const [dismissed, setDismissed] = useState(false);
  // Keep tentative choices through in-sheet browsing, but never persist them.
  const [pendingById, setPendingById] = useState<Record<string, number>>({});
  const id = queue[index];
  const detection = flow.scan.detections.find((d) => d.id === id);
  const resolution = flow.resolutions[id];
  const ordered = orderedDetections(flow.scan);
  const numbers = Object.fromEntries(ordered.map((d, i) => [d.id, i + 1]));
  const dimmedIds = new Set(ordered.filter((d) => flow.resolutions[d.id].kind === 'dismissed').map((d) => d.id));
  if (mode !== 'photo' && (!detection || !resolution)) return null;
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
  const title = mode === 'library' ? 'Choose matching piece' : mode === 'new' ? 'New piece' : mode === 'photo' ? 'Your outfit' : 'Match your pieces';
  const brands = [...new Set(Object.values(flow.resolutions).flatMap((r) => r.kind === 'new' && r.draft.brand ? [r.draft.brand] : []))];
  return <WorkspaceSheet title={title} detent="large" reduceMotion={reduceMotion} dismissed={dismissed} onClose={close}
    subtitle={mode === 'photo' ? undefined : <Text style={styles.meta}>Piece {index + 1} of {queue.length}</Text>}
    headerAction={<TextLink label="Done" onPress={mode === 'new' ? advance : () => setDismissed(true)} accessibilityLabel={mode === 'new' ? 'Finish piece details' : 'Close piece review'} />}
    footer={mode === 'new' ? <View style={styles.links}>
      <TextLink label="Undo new piece" onPress={() => { dispatchWear({ type: 'clear', detectionId: id }); setMode('review'); }} />
      <TextLink label="Skip piece" tone="muted" onPress={skip} />
    </View> : mode === 'library' ? <View style={styles.links}><TextLink label="Add as new" onPress={addNew} /><TextLink label="Skip piece" tone="muted" onPress={skip} /></View> : undefined}>
    {mode === 'photo' ? <PhotoHero
        uri={flow.photoUri}
        width={width}
        height={height * 0.65}
        detections={ordered}
        numbers={numbers}
        activeId={null}
        dimmedIds={dimmedIds}
        onPressBox={(id) => {
          setQueue([id]);
          setIndex(0);
          setMode(flow.resolutions[id].kind === 'new' ? 'new' : 'review');
        }}
      />
      : mode === 'new' && resolution.kind === 'new' && detection ? <NewPieceEditor key={id} detection={detection} draft={resolution.draft} scanBrands={brands} onChange={(patch) => dispatchWear({ type: 'editDraft', detectionId: id, patch })} />
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
        onConfirm={confirm}
        onBrowse={() => setMode('library')}
        onAddNew={addNew}
        onSkip={skip}
      /> : null}
  </WorkspaceSheet>;
}

/** Candidate taps stay local until the primary confirmation action. */
export function FocusedPiece({ detection, resolution, initialItemId, onPendingChange, items, last, onConfirm, onBrowse, onAddNew, onSkip }: {
  detection: WearDetection; resolution: Resolution; items: Item[]; last: boolean;
  onConfirm: (id: number) => void; onBrowse: () => void; onAddNew: () => void; onSkip: () => void;
  initialItemId?: number;
  onPendingChange: (id: number) => void;
}) {
  const [pendingId, setPendingId] = useState<number | null>(initialItemId ?? (resolution.kind === 'matched' ? resolution.itemId : null));
  const selected = items.find((item) => item.id === pendingId);
  const ranked = detection.candidates.map((c) => items.find((item) => item.id === c.itemId)).filter((item): item is Item => !!item);
  const candidates = [...new Map(ranked.map((item) => [item.id, item])).values()].slice(0, 2);
  const heldCopy = detection.holdReason === 'occluded' ? 'Partly hidden in your photo' : detection.holdReason === 'lookalike' ? 'You own a few like this' : null;
  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.detected}>
        <PieceImage cutoutUrl={detection.cutoutUrl} width={144} height={180} />
        <Text style={styles.heading}>{detection.attributes.name}</Text>
        {detection.attributes.description ? <Text style={styles.meta}>{detection.attributes.description}</Text> : null}
        {heldCopy ? <Text style={styles.attention}>{heldCopy}</Text> : null}
      </View>
      <Text style={styles.heading}>{candidates.length ? 'Is this your piece?' : 'Choose a piece from your closet'}</Text>
      <View style={styles.candidates}>
        {candidates.map((item) => <Pressable key={item.id} onPress={() => { selectionFeedback(); setPendingId(item.id); onPendingChange(item.id); }} style={[styles.candidate, pendingId === item.id && styles.selected]} accessibilityRole="button" accessibilityLabel={`${item.name}${item.brand ? `, ${item.brand}` : ''}`} accessibilityState={{ selected: pendingId === item.id }}>
          <PieceImage item={item} width="100%" height={148} />
          <Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.brand}</Text>
          <Ionicons name={pendingId === item.id ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={colors.foreground} style={styles.tick} />
        </Pressable>)}
      </View>
      {selected && !candidates.some((item) => item.id === selected.id) ? <View style={styles.current}><PieceImage item={selected} width={48} height={60} /><View style={styles.copy}><Text style={styles.name}>{selected.name}</Text><Text style={styles.meta}>Current match</Text></View></View> : null}
      <TextLink label="Browse closet" onPress={onBrowse} />
    </ScrollView>
    <View style={styles.footer}>
      <PrimaryButton label={last ? 'Confirm & finish' : 'Confirm & next'} disabled={!selected} onPress={() => { if (selected) { selectionFeedback(); onConfirm(selected.id); } }} />
      <View style={styles.links}><TextLink label="Add as new" onPress={onAddNew} /><TextLink label="Skip piece" tone="muted" onPress={onSkip} /></View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { paddingHorizontal: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md },
  detected: { alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.md },
  heading: { ...typography.text.editorialSection, color: colors.foreground },
  meta: { ...typography.text.meta, color: colors.mutedForeground },
  attention: { ...typography.text.meta, color: colors.accentInk },
  candidates: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  candidate: { flex: 1, minWidth: 0, borderWidth: stroke.fine, borderColor: colors.controlOutline, padding: spacing.sm, gap: 4 },
  selected: { borderColor: colors.foreground },
  tick: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: colors.background, borderRadius: 11 },
  name: { ...typography.text.bodySmall, color: colors.foreground },
  current: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1 },
  footer: { borderTopWidth: stroke.hairline, borderTopColor: colors.hairline, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
});
