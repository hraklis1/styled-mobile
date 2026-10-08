import { useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { pieceFlags } from '../../../lib/scan-review';
import { colors, radii, spacing, stroke, typography } from '../../../theme';
import { PrimaryButton } from './ActionBar';
import { AdjustCropButton, CropPreview, SheetClose } from './PieceEditorSheet';
import { SpecSheet, type ExpandableRow, type SheetKind } from './SpecSheet';
import { WorkspaceSheet } from './WorkspaceSheet';
import { CategoryPicker, MaterialPicker } from './pickers';
import { selectionFeedback } from './feedback';
import { TextLink } from './atoms';
import { coverUri, type PiecePatch, type ScanReviewPiece, type ScanReviewStage } from './types';

/**
 * After extraction: the same sheet as the pre-extract editor (preview, crop,
 * Done), with the full spec list in place of Type and Brand. Edits save as
 * they're made; Done also marks the piece as looked at, which retires its
 * "worth a look" note. Material and category open in place, as in the
 * outfit log's new-piece editor: a sheet over a sheet is the
 * dismiss-before-present trap. Brand keeps its own search sheet, which can
 * offer the brand to the scan's other pieces.
 */
export function PieceDetailSheet({ piece, stage, confirmed, disabled, dismissed, reduceMotion, onClose, onDone, onCrop, onToggleCutout, polish, onUpdate, onOpenSheet }: {
  piece: ScanReviewPiece;
  stage: ScanReviewStage;
  /** Already looked at: its field marks are retired. */
  confirmed: boolean;
  disabled: boolean;
  dismissed: boolean;
  reduceMotion: boolean;
  onClose: () => void;
  onDone: () => void;
  onCrop?: () => void;
  onToggleCutout: () => void;
  /** This piece's own polish choice, overriding the footer's switch. Omitted when polish isn't on offer. */
  polish?: { on: boolean; cost: number; onToggle: (next: boolean) => void };
  onUpdate: (patch: PiecePatch) => void;
  onOpenSheet: (kind: SheetKind) => void;
}) {
  const [expandedRow, setExpandedRow] = useState<ExpandableRow | null>(null);
  const [picker, setPicker] = useState<Exclude<SheetKind, 'brand'> | null>(null);
  const showingCutout = Boolean(piece.cutout && piece.useCutout);
  const openPicker = (kind: SheetKind) => (kind === 'brand' ? onOpenSheet(kind) : setPicker(kind));
  const back = () => setPicker(null);
  return (
    <WorkspaceSheet
      title={picker === 'material' ? 'Material' : picker === 'category' ? 'Category' : 'Piece details'}
      detent="large"
      reduceMotion={reduceMotion}
      dismissed={dismissed}
      onClose={onClose}
      headerAction={picker ? <TextLink label="Back" weight="strong" onPress={back} accessibilityLabel="Back to piece details" /> : <SheetClose onPress={onDone} />}
      footer={<PrimaryButton label={picker ? 'Back to piece details' : 'Done'} onPress={picker ? back : onDone} disabled={disabled} />}
    >
      {picker === 'material' ? (
        <MaterialPicker current={piece.material} onSelect={(material) => { selectionFeedback(); onUpdate({ material }); back(); }} />
      ) : picker === 'category' ? (
        <View style={styles.pickerPad}>
          <CategoryPicker category={piece.category} subcategory={piece.subcategory} style={piece.style} onChange={(patch) => onUpdate(patch)} />
        </View>
      ) : <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={spacing.lg}>
        <View style={styles.media}>
          <CropPreview uri={coverUri(piece, stage)} name={piece.name} reduceMotion={reduceMotion} />
          <View style={styles.mediaActions}>
            {onCrop ? <AdjustCropButton onPress={onCrop} /> : null}
            {piece.cutout ? <TextLink label={showingCutout ? 'Show photo' : 'Show cutout'} tone="muted" onPress={onToggleCutout} disabled={disabled} /> : null}
          </View>
        </View>
        {polish ? (
          <TouchableOpacity
            style={styles.polish}
            activeOpacity={0.7}
            disabled={disabled}
            onPress={() => polish.onToggle(!polish.on)}
            accessibilityRole="switch"
            accessibilityState={{ checked: polish.on, disabled }}
            accessibilityLabel="Polish this piece"
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.foreground} />
            <View style={styles.polishCopy}>
              <Text style={styles.polishTitle}>Polish this piece</Text>
              <Text style={styles.polishDetail}>{`Studio-quality cover${polish.cost > 0 ? ` · ${polish.cost} credits` : ''}`}</Text>
            </View>
            <Switch value={polish.on} onValueChange={polish.onToggle} disabled={disabled} trackColor={{ true: colors.primary }} accessibilityElementsHidden importantForAccessibility="no" />
          </TouchableOpacity>
        ) : null}
        <SpecSheet
          piece={piece}
          variant="card"
          stage={stage}
          flags={confirmed ? [] : pieceFlags(piece)}
          expandedRow={expandedRow}
          disabled={disabled}
          onExpand={setExpandedRow}
          onUpdate={onUpdate}
          onOpenSheet={openPicker}
        />
      </KeyboardAwareScrollView>}
    </WorkspaceSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.lg, gap: spacing.lg },
  pickerPad: { paddingHorizontal: spacing.lg },
  media: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  mediaActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  polish: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60,
    marginHorizontal: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radii.lg, borderCurve: 'continuous', borderWidth: stroke.hairline, borderColor: colors.hairline, backgroundColor: colors.card,
  },
  polishCopy: { flex: 1, gap: 2 },
  polishTitle: { ...typography.text.label, color: colors.foreground },
  polishDetail: { ...typography.text.caption, color: colors.mutedForeground },
});
