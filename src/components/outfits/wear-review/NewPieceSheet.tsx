import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { WorkspaceSheet } from '../../wardrobe/scan-review/WorkspaceSheet';
import { SpecSheet, type ExpandableRow, type SheetKind } from '../../wardrobe/scan-review/SpecSheet';
import { BrandPicker, CategoryPicker, MaterialPicker } from '../../wardrobe/scan-review/pickers';
import { TextLink } from '../../wardrobe/scan-review/atoms';
import { AdjustCropButton } from '../../wardrobe/scan-review/PieceEditorSheet';
import { PieceThumb } from '../../wardrobe/scan-review/PieceThumb';
import { cropImage } from '../../../lib/cropImage';
import { selectionFeedback } from '../../wardrobe/scan-review/feedback';
import type { PiecePatch, ScanReviewPiece } from '../../wardrobe/scan-review/types';
import { useBrandSuggestions } from '../../../hooks/useItems';
import { pieceFlags } from '../../../lib/scan-review';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { LocateInPhoto, PieceImage } from './PieceImage';
import type { WearDetection, WearDraft } from '../../../features/wear-log/types';

const DRAFT_KEYS: (keyof WearDraft)[] = [
  'name', 'brand', 'category', 'subcategory', 'color', 'colorNormalized', 'style',
  'seasons', 'occasions', 'material', 'fit', 'sizeProfile', 'sleeveLength',
];

/** SpecSheet edits a ScanReviewPiece; the draft is the subset a new item keeps. */
function toPiece(detection: WearDetection, draft: WearDraft): ScanReviewPiece {
  return {
    id: detection.id,
    ...draft,
    photo: detection.cropUrl ?? detection.cutoutUrl,
    cutout: detection.cutoutUrl,
    useCutout: !detection.cropUrl,
    canAdjustCrop: false,
    cropSource: null,
    cropBbox: null,
    lowConfidenceFields: detection.lowConfidenceFields,
  };
}

function toDraftPatch(patch: PiecePatch): Partial<WearDraft> {
  const out: Partial<WearDraft> = {};
  for (const key of DRAFT_KEYS) {
    if (key in patch) (out as Record<string, unknown>)[key] = patch[key as keyof PiecePatch];
  }
  return out;
}

/**
 * "Add as new": the Add Clothing spec sheet for one piece, seeded from the
 * scan. Brand, material and category open in place — a sheet over a sheet
 * is the dismiss-before-present trap — so Back returns to the spec list.
 * Every edit is saved to the review as it's made; nothing is created until
 * the outfit is logged.
 */
export function NewPieceEditor({ detection, draft, scanBrands, photoUri, onChange, onLocate, onAdjustCrop }: {
  detection: WearDetection;
  draft: WearDraft;
  /** Brands already chosen for other new pieces in this review. */
  scanBrands: string[];
  onChange: (patch: Partial<WearDraft>) => void;
  /** Show this piece outlined on the outfit photo. */
  onLocate?: () => void;
  /** The stored outfit photo: the user's crop is previewed from it. */
  photoUri?: string;
  /** Opens the crop editor; omitted where cropping isn't offered. */
  onAdjustCrop?: () => void;
}) {
  const [picker, setPicker] = useState<SheetKind | null>(null);
  const [expandedRow, setExpandedRow] = useState<ExpandableRow | null>(null);
  const brandSuggestions = useBrandSuggestions();
  // The user's crop, cut locally for the preview; the saved cover is cut again at full size.
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const box = draft.cropBbox;
  useEffect(() => {
    if (!box || !photoUri) { setCropPreview(null); return; }
    let live = true;
    void cropImage(photoUri, box, { maxDim: 800 }).then((uri) => { if (live) setCropPreview(uri); });
    return () => { live = false; };
  }, [photoUri, box?.x, box?.y, box?.width, box?.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const piece = useMemo(() => toPiece(detection, draft), [detection, draft]);
  const flags = pieceFlags(piece);
  const update = (patch: PiecePatch) => onChange(toDraftPatch(patch));
  const pick = (patch: Partial<WearDraft>) => {
    selectionFeedback();
    onChange(patch);
    setPicker(null);
  };

  const title = picker === 'brand' ? 'Brand' : picker === 'material' ? 'Material' : picker === 'category' ? 'Category' : 'New piece';

  return (
    <View style={styles.root}>
      {picker ? (
        <View style={styles.pad}>
          <Text style={styles.title}>{title}</Text>
          <TextLink label="Back to piece details" onPress={() => setPicker(null)} />
        </View>
      ) : null}
      {picker === 'brand' ? (
        <BrandPicker current={draft.brand} suggestions={brandSuggestions} scanBrands={scanBrands} onSelect={(brand) => pick({ brand })} />
      ) : picker === 'material' ? (
        <MaterialPicker current={draft.material} onSelect={(material) => pick({ material })} />
      ) : picker === 'category' ? (
        <View style={styles.pad}>
          <CategoryPicker
            category={draft.category}
            subcategory={draft.subcategory}
            style={draft.style}
            onChange={(patch) => onChange(patch)}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.subtitle, styles.pad]}>Saved to your closet when you log</Text>
          <View style={styles.plate}>
            <LocateInPhoto name={detection.attributes.name} onPress={onLocate}>
              {box ? <PieceThumb uri={cropPreview} width={168} height={210} />
                : <PieceImage cropUrl={detection.cropUrl} cutoutUrl={detection.cutoutUrl} width={168} height={210} />}
            </LocateInPhoto>
            {onAdjustCrop ? <View style={styles.cropActions}>
              <AdjustCropButton onPress={onAdjustCrop} />
              {box ? <TextLink label="Use the scan’s crop" tone="muted" onPress={() => onChange({ cropBbox: null })} /> : null}
            </View> : null}
          </View>
          <SpecSheet
            piece={piece}
            stage="review"
            flags={flags}
            expandedRow={expandedRow}
            disabled={false}
            compact
            onExpand={setExpandedRow}
            onUpdate={update}
            onOpenSheet={setPicker}
          />
        </ScrollView>
      )}
    </View>
  );
}

export function NewPieceSheet(props: React.ComponentProps<typeof NewPieceEditor> & { reduceMotion: boolean; onClose: () => void }) {
  return (
    <WorkspaceSheet title="New piece" detent="large" reduceMotion={props.reduceMotion} onClose={props.onClose}>
      <NewPieceEditor {...props} />
    </WorkspaceSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { ...typography.text.editorialSection, color: colors.foreground },
  subtitle: { ...typography.text.meta, color: colors.mutedForeground },
  content: { paddingBottom: spacing.xl, gap: spacing.lg },
  pad: { paddingHorizontal: spacing.lg },
  // A mat around the raw crop so an unsegmented photo reads as framed, not cut out.
  cropActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  plate: {
    alignSelf: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: stroke.hairline,
    borderColor: colors.hairline,
    borderRadius: radii.photo,
  },
});
