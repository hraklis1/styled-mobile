import { useEffect, useMemo } from 'react';
import { FloatingTray, TrayChevron } from '../primitives/FloatingTray';
import { useBatchImportStore } from '../../features/batch-import/store';
import { summarizeBatch } from '../../features/batch-import/summary';
import { discardBatch } from '../../features/batch-import/runner';
const DONE_DISMISS_MS = 4_000;

/**
 * The batch's presence while the user carries on elsewhere: a slim pill above
 * the tab bar. Tapping it opens the full progress/review workspace.
 */
export function BatchImportTray() {
  const batch = useBatchImportStore((s) => s.batch);
  const workspaceOpen = useBatchImportStore((s) => s.workspaceOpen);
  const openWorkspace = useBatchImportStore((s) => s.openWorkspace);
  const summary = useMemo(() => (batch ? summarizeBatch(batch) : null), [batch]);

  // A finished batch says so briefly, then clears itself.
  const isDone = summary?.tone === 'done';
  useEffect(() => {
    if (!isDone) return;
    const timer = setTimeout(discardBatch, DONE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [isDone]);

  if (!batch || !summary || workspaceOpen) return null;

  const onPress = summary.action === 'dismiss' ? discardBatch : openWorkspace;
  const icon = summary.tone === 'done'
    ? 'checkmark-circle'
    : summary.tone === 'attention'
      ? 'alert-circle-outline'
      : 'sparkles-outline';

  return (
    <FloatingTray
      title={summary.title}
      detail={summary.detail}
      progress={summary.progress}
      busy={summary.tone === 'working'}
      icon={icon}
      iconMuted={summary.tone === 'done'}
      trailing={summary.action === 'open' ? <TrayChevron /> : null}
      onPress={onPress}
      accessibilityHint={summary.action === 'dismiss' ? 'Dismisses this message' : 'Opens the batch import'}
    />
  );
}
