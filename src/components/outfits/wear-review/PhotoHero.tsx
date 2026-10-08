import { useMemo } from 'react';
import type { WearDetection } from '../../../features/wear-log/types';
import { MarkedPhoto, type PhotoMark } from '../../wardrobe/scan-review/MarkedPhoto';

const MATCH_TAG = {
  action: 'Match',
  accessibilityLabel: (name: string) => `Match ${name}`,
  accessibilityHint: 'Opens the matcher',
};

/**
 * The outfit photo on the shared marked-photo frame: a dot per detection.
 * Tapping a dot outlines that piece and names it; tapping the name opens it.
 * Pieces not being logged go hollow.
 */
export function PhotoHero({ uri, height, width, detections, activeId, dimmedIds, onSelect, onOpen }: {
  uri: string;
  height: number;
  width: number;
  detections: WearDetection[];
  activeId: string | null;
  dimmedIds: Set<string>;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const marks = useMemo<PhotoMark[]>(() => detections.map((d) => ({
    id: d.id, box: d.bbox_pct ?? null, label: d.attributes.name, off: dimmedIds.has(d.id),
  })), [detections, dimmedIds]);
  const tag = useMemo(() => ({ ...MATCH_TAG, onPress: onOpen }), [onOpen]);
  return (
    <MarkedPhoto source={uri} marks={marks} activeId={activeId} width={width} height={height}
      outlineActive tag={tag} onMarkerPress={onSelect} />
  );
}
