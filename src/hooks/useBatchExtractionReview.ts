import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { applyInclusionChanges, includedPieces, type InclusionChange } from '../lib/extraction-review';
import type { ScanReviewPiece } from '../components/wardrobe/scan-review/types';

/** Host-owned records persist inclusion. The ref also covers two taps in one React batch. */
export function useBatchExtractionReview(pieces: ScanReviewPiece[], busy: boolean, onChange: (changes: InclusionChange[]) => void) {
  const current = useRef(pieces);
  current.current = pieces;
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => subscription.remove();
  }, []);
  const change = (ids: readonly string[], included: boolean) => {
    if (busy) return;
    const targets = current.current.filter(p => ids.includes(p.id) && (p.included !== false) !== included);
    if (!targets.length) return;
    const changes = targets.map(p => ({ id: p.id, included }));
    current.current = applyInclusionChanges(current.current, changes);
    onChange(changes);
    const message = `${included ? 'Included' : 'Excluded'} ${targets.length === 1 ? targets[0].name || 'piece' : `${targets.length} pieces`}`;
    if (screenReader) AccessibilityInfo.announceForAccessibility(message);
  };
  return {
    included: includedPieces(pieces),
    snapshot: () => includedPieces(current.current),
    change,
  };
}
