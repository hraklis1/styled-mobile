import { useEffect, useMemo } from 'react';
import { FloatingTray } from '../primitives/FloatingTray';
import { useBatchImportStore } from '../../features/batch-import/store';
import { summarizePolish, usePolishQueueStore } from '../../features/polish-queue/store';
import { presentPaywall } from '../../lib/paywall';
const DONE_DISMISS_MS = 4_000;

/**
 * Polishes queued from add-to-closet, running after the pieces have landed.
 * Yields to the batch tray, which owns the same spot while a batch is open.
 */
export function PolishQueueTray({ hidden = false }: { hidden?: boolean }) {
  const jobs = usePolishQueueStore((s) => s.jobs);
  const blocked = usePolishQueueStore((s) => s.blocked);
  const batchShowing = useBatchImportStore((s) => s.batch !== null);
  const summary = useMemo(() => summarizePolish(jobs), [jobs]);

  const finished = summary.total > 0 && summary.active === 0 && summary.failed === 0 && summary.blocked === 0;
  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => usePolishQueueStore.getState().clearSettled(), DONE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [finished]);

  if (summary.total === 0 || batchShowing || hidden) return null;

  const store = usePolishQueueStore.getState;
  let title: string;
  let detail: string | null = null;
  let tone: 'working' | 'done' | 'attention';
  let onPress: () => void;
  if (summary.active > 0) {
    tone = 'working';
    title = `Polishing ${Math.min(summary.done + 1, summary.total)} of ${summary.total}`;
    detail = 'Covers update as each one finishes';
    onPress = () => {};
  } else if (summary.blocked > 0) {
    tone = 'attention';
    title = blocked === 'free_limit' ? 'Polish needs Premium' : `Out of credits — ${summary.blocked} not polished`;
    detail = 'Tap to get credits';
    onPress = () => { void presentPaywall().then((ok) => { if (ok) store().unblock(); }); };
  } else if (summary.failed > 0) {
    tone = 'attention';
    title = `${summary.failed} couldn't be polished`;
    detail = 'Tap to try again';
    onPress = () => store().retryFailed();
  } else {
    tone = 'done';
    title = summary.done === 1 ? '1 piece polished' : `${summary.done} pieces polished`;
    onPress = () => store().clearSettled();
  }

  return (
    <FloatingTray
      title={title}
      detail={detail}
      progress={tone === 'working' ? summary.done / summary.total : null}
      busy={tone === 'working'}
      icon={tone === 'done' ? 'checkmark-circle' : 'alert-circle-outline'}
      iconMuted={tone === 'done'}
      accessory={tone === 'attention' ? { icon: 'close', label: 'Dismiss', onPress: () => store().clearSettled() } : undefined}
      onPress={onPress}
      disabled={tone === 'working'}
    />
  );
}
