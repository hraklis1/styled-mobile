import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { WorkspaceSheet } from '../../wardrobe/scan-review/WorkspaceSheet';
import { SpecSheet, type ExpandableRow, type SheetKind } from '../../wardrobe/scan-review/SpecSheet';
import { BrandPicker, CategoryPicker, MaterialPicker } from '../../wardrobe/scan-review/pickers';
import { TextLink } from '../../wardrobe/scan-review/atoms';
import { selectionFeedback } from '../../wardrobe/scan-review/feedback';
import type { PiecePatch, ScanReviewPiece } from '../../wardrobe/scan-review/types';
import { useBrandSuggestions } from '../../../hooks/useItems';
import { pieceFlags } from '../../../lib/scan-review';
import { colors, radii, spacing, typography } from '../../../theme';
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
    photo: detection.cutoutUrl,
    cutout: detection.cutoutUrl,
    useCutout: true,
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
export function NewPieceEditor({ detection, draft, scanBrands, onChange }: {
  detection: WearDetection;
  draft: WearDraft;
  /** Brands already chosen for other new pieces in this review. */
  scanBrands: string[];
  onChange: (patch: Partial<WearDraft>) => void;
}) {
  const [picker, setPicker] = useState<SheetKind | null>(null);
  const [expandedRow, setExpandedRow] = useState<ExpandableRow | null>(null);
  const brandSuggestions = useBrandSuggestions();
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
      ) : <Text style={[styles.subtitle, styles.pad]}>Added to your closet when you log</Text>}
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
          <View style={styles.plate}>
            {detection.cutoutUrl ? (
              <Image source={{ uri: detection.cutoutUrl }} style={styles.cutout} contentFit="contain" cachePolicy="memory-disk" />
            ) : null}
          </View>
          <SpecSheet
            piece={piece}
            stage="review"
            flags={flags}
            expandedRow={expandedRow}
            disabled={false}
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
  plate: {
    alignSelf: 'center',
    width: 150,
    height: 200,
    borderRadius: radii.photo,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutout: { width: '88%', height: '88%' },
});
