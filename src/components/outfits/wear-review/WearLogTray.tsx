import { useEffect } from 'react';
import { FloatingTray, TrayChevron } from '../../primitives/FloatingTray';

import { useBatchImportStore } from '../../../features/batch-import/store';
import { reviewCounts } from '../../../features/wear-log/reducer';
import { startWearRunner } from '../../../features/wear-log/runner';
import { useWearLogStore } from '../../../features/wear-log/store';
import type { WearFlow } from '../../../features/wear-log/types';

type Summary = { title: string; detail: string | null; tone: 'working' | 'ready' | 'attention' };

function summarize(flow: WearFlow): Summary | null {
  switch (flow.status) {
    case 'processing':
      return { title: 'Reading your outfit', detail: 'Matching it to your closet', tone: 'working' };
    case 'failed':
      return flow.offline
        ? { title: 'Outfit photo waiting', detail: 'Finishes when you’re back online', tone: 'attention' }
        : { title: 'Outfit photo didn’t go through', detail: 'Tap to try again', tone: 'attention' };
    case 'reviewing':
    case 'saving': {
      const c = reviewCounts(flow);
      return {
        title: c.total === 1 ? '1 piece to review' : `${c.total} pieces to review`,
        detail: c.toCheck ? `${c.toCheck} still to check` : 'Ready to log',
        tone: 'ready',
      };
    }
    default:
      return null;
  }
}

/**
 * The outfit scan's presence while the logger is closed — kept in the
 * background, or left mid-review. Same pill as the batch import tray;
 * tapping it reopens the logger on the scan.
 */
export function WearLogTray({ onOpen }: { onOpen: () => void }) {
  const flow = useWearLogStore((s) => s.flow);
  const workspaceOpen = useWearLogStore((s) => s.workspaceOpen);
  const batchTrayUp = useBatchImportStore((s) => Boolean(s.batch) && !s.workspaceOpen);

  useEffect(() => startWearRunner(), []);

  const summary = summarize(flow);
  if (!summary || workspaceOpen) return null;

  return (
    <FloatingTray
      title={summary.title}
      detail={summary.detail}
      busy={summary.tone === 'working'}
      icon={summary.tone === 'attention' ? 'cloud-offline-outline' : 'shirt-outline'}
      trailing={<TrayChevron />}
      onPress={onOpen}
      accessibilityHint="Opens your outfit log"
      // When the batch tray is up, this one sits above it rather than on top.
      stackLevel={batchTrayUp ? 1 : 0}
    />
  );
}
