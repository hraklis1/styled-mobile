import { useCallback, useMemo } from 'react';
import { ScanReviewWorkspace, type ScanReviewPiece, type ScanReviewStage } from './scan-review-workspace';
import { useBrandSuggestions } from '../../hooks/useItems';
import { useBatchImportStore } from '../../features/batch-import/store';
import { photoCounts, pieceCounts } from '../../features/batch-import/summary';
import { applyPieceCrop, discardBatch } from '../../features/batch-import/runner';
import type { Batch, PieceFields } from '../../features/batch-import/types';
import { presentPaywall } from '../../lib/paywall';
import { track } from '../../lib/analytics';

function stageFor(batch: Batch): ScanReviewStage {
  if (batch.phase === 'saving') return 'saving';
  if (batch.phase === 'pre-extract') return 'pre-extract';
  if (batch.phase === 'review') return 'review';
  const photos = photoCounts(batch);
  return photos.settled < photos.total ? 'scanning' : 'extracting';
}

function failureFor(batch: Batch, retry: () => void, getCredits: () => void) {
  if (batch.saveError) return { message: batch.saveError, onRetry: retry };
  if (batch.blocked) {
    const { blocked } = photoCounts(batch);
    return {
      message: batch.blocked === 'free_limit'
        ? 'Your free closet is full.'
        : `Out of credits — ${blocked === 1 ? '1 photo' : `${blocked} photos`} not scanned.`,
      retryLabel: batch.blocked === 'free_limit' ? 'Upgrade' : 'Get credits',
      onRetry: getCredits,
    };
  }
  const photos = photoCounts(batch);
  const pieces = pieceCounts(batch);
  if ((batch.phase !== 'review' && batch.phase !== 'pre-extract') || (!photos.failed && !pieces.failed)) return null;
  const parts = [
    photos.failed ? `${photos.failed} photo${photos.failed === 1 ? '' : 's'} couldn't be scanned` : null,
    pieces.failed ? `${pieces.failed} piece${pieces.failed === 1 ? '' : 's'} couldn't be enriched` : null,
  ].filter(Boolean);
  return { message: `${parts.join(', ')}.`, onRetry: retry };
}

/**
 * The full-screen view of the active batch: live progress while it runs,
 * the review carousel once it's done. Closing it never stops the batch —
 * the tray takes over — and Save hands off to the queue straight away.
 */
export function BatchImportWorkspace() {
  const batch = useBatchImportStore((s) => s.batch);
  const open = useBatchImportStore((s) => s.workspaceOpen);
  const store = useBatchImportStore.getState;
  const brandSuggestions = useBrandSuggestions(open);

  const pieces = useMemo<ScanReviewPiece[]>(() => {
    if (!batch) return [];
    const photos = new Map(batch.photos.map((p) => [p.id, p]));
    return batch.pieces.map((piece) => {
      const photo = photos.get(piece.photoId);
      return {
        id: piece.id,
        included: piece.included !== false,
        sourceLabel: `Photo ${batch.photos.findIndex(p => p.id === piece.photoId) + 1} of ${batch.photos.length}`,
        extraction: piece.status === 'pending' ? 'not-started' : piece.status === 'extracting' ? 'running' : piece.status === 'failed' && piece.failedStep === 'extract' ? 'failed' : 'ready',
        name: piece.name,
        brand: piece.brand ?? '',
        photo: piece.previewUri,
        cutout: piece.cutoutUri ?? piece.cutoutUrl,
        useCutout: piece.useCutout,
        canAdjustCrop: Boolean(piece.bbox && photo?.masterUri),
        cropSource: photo?.masterUri ?? null,
        cropBbox: piece.bbox,
        category: piece.category,
        subcategory: piece.subcategory,
        color: piece.color,
        colorNormalized: piece.colorNormalized,
        style: piece.style,
        seasons: piece.seasons,
        occasions: piece.occasions,
        material: piece.material,
        fit: piece.fit,
        sizeProfile: piece.sizeProfile,
        sleeveLength: piece.sleeveLength,
        // A field the user has since edited is no longer the model's guess.
        lowConfidenceFields: (piece.lowConfidenceFields ?? [])
          .filter((field) => !piece.edited.includes(field as keyof PieceFields)),
        extractFailed: piece.status === 'failed' && piece.failedStep === 'extract',
      };
    });
  }, [batch]);

  const onUpdate = useCallback((id: string, patch: Partial<ScanReviewPiece>) => {
    const edit: Partial<PieceFields> = {};
    if (patch.name !== undefined) edit.name = patch.name;
    if (patch.brand !== undefined) edit.brand = patch.brand || null;
    if (patch.category !== undefined) edit.category = patch.category;
    if (patch.subcategory !== undefined) edit.subcategory = patch.subcategory;
    if (patch.color !== undefined) edit.color = patch.color;
    if (patch.colorNormalized !== undefined) edit.colorNormalized = patch.colorNormalized ?? null;
    if (patch.style !== undefined) edit.style = patch.style;
    if (patch.seasons !== undefined) edit.seasons = patch.seasons;
    if (patch.occasions !== undefined) edit.occasions = patch.occasions;
    if (patch.material !== undefined) edit.material = patch.material;
    if (patch.fit !== undefined) edit.fit = patch.fit;
    if (patch.sizeProfile !== undefined) edit.sizeProfile = patch.sizeProfile;
    if (patch.sleeveLength !== undefined) edit.sleeveLength = patch.sleeveLength;
    store().editPiece(id, edit);
  }, [store]);

  const getCredits = useCallback(async () => {
    const purchased = await presentPaywall();
    if (purchased) store().unblock();
  }, [store]);

  const retry = useCallback(() => {
    const current = store().batch;
    if (current?.saveError) store().beginSave();
    else store().retryFailed();
  }, [store]);

  if (!batch) return null;

  const photos = photoCounts(batch);
  const counts = pieceCounts(batch);
  const scanning = batch.photos.find((p) => p.status === 'scanning' || p.status === 'preparing')
    ?? batch.photos.find((p) => p.status === 'ready' || p.status === 'pending');

  return (
    <ScanReviewWorkspace
      visible={open}
      stage={stageFor(batch)}
      previewImage={scanning ? scanning.masterUri ?? scanning.sourceUri : null}
      scanProgress={{ current: photos.settled, total: photos.total }}
      scanPhotos={batch.photos.map((p) => ({
        id: p.id,
        uri: p.masterUri ?? p.sourceUri,
        state: p.status === 'done' ? 'done' : p === scanning ? 'active' : 'pending',
      }))}
      pieces={pieces}
      brandSuggestions={brandSuggestions}
      extractionProgress={{ current: counts.settled, total: counts.total }}
      failure={failureFor(batch, retry, () => { void getCredits(); })}
      onUpdate={onUpdate}
      onToggleCutout={(id) => {
        const piece = batch.pieces.find((p) => p.id === id);
        if (piece) store().editPiece(id, { useCutout: !piece.useCutout });
      }}
      onApplyCrop={(id, bbox) => applyPieceCrop(id, bbox)}
      onInclusionChange={changes => store().setInclusion(changes)}
      onKeepBasic={ids => store().keepBasicDetails(ids)}
      onExtract={ids => { store().beginExtraction(ids); }}
      onSave={(ids) => {
        track('closet_batch_save_started', { item_count: ids.length });
        store().beginSave(ids);
        store().closeWorkspace();
      }}
      onMinimize={store().closeWorkspace}
      onClose={() => {
        track('closet_batch_discarded', { item_count: batch.pieces.length, phase: batch.phase });
        discardBatch();
      }}
    />
  );
}
