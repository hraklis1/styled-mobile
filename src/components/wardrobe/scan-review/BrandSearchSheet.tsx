import { useRef, type ReactNode } from 'react';
import { BrandPicker } from './pickers';
import { WorkspaceSheet } from './WorkspaceSheet';
import { selectionFeedback, bulkFeedback } from './feedback';

export function BrandSearchSheet({ targetIds, current, suggestions, scanBrands, subtitle, dismissed, reduceMotion, onSelect, onClose }: {
  targetIds: string[];
  current: string;
  suggestions: string[];
  scanBrands: string[];
  subtitle?: ReactNode;
  dismissed: boolean;
  reduceMotion: boolean;
  onSelect: (ids: string[], brand: string) => void;
  onClose: () => void;
}) {
  const committed = useRef(false);
  return <WorkspaceSheet title="Brand" subtitle={subtitle} detent="large" dismissed={dismissed} reduceMotion={reduceMotion} onClose={onClose}>
    <BrandPicker current={current} suggestions={suggestions} scanBrands={scanBrands} onSelect={brand => {
      if (committed.current || dismissed) return;
      committed.current = true;
      if (targetIds.length > 1) bulkFeedback(); else selectionFeedback();
      onSelect(targetIds, brand);
    }} />
  </WorkspaceSheet>;
}
