import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/** AsyncStorage key for the single-scan review draft (see ScanItemSheet). */
export const SCAN_DRAFT_KEY = 'scan_review_draft';

/** A draft nobody has touched for this long is abandoned and dropped quietly. */
export const SCAN_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Loose shape of the persisted draft; ScanItemSheet owns the item types. */
export type StoredScanDraft = {
  version?: number;
  savedAt?: number;
  image: string | null;
  ready: { tempId: string }[];
  pending: { tempId: string }[];
  failedIds?: string[];
  approvedIds?: string[];
};

export type ScanDraftSummary = { count: number; image: string | null };

/**
 * Reads the saved draft, dropping it when unreadable, empty or stale.
 * Drafts written before `savedAt` existed are treated as fresh.
 */
export async function readScanDraft(now = Date.now()): Promise<StoredScanDraft | null> {
  const raw = await AsyncStorage.getItem(SCAN_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const draft: StoredScanDraft | null = Array.isArray(parsed)
      ? { ready: parsed, pending: [], image: null, failedIds: [], approvedIds: [] }
      : parsed;
    const valid = !!draft && Array.isArray(draft.ready) && Array.isArray(draft.pending);
    const stale = valid && typeof draft.savedAt === 'number' && now - draft.savedAt > SCAN_DRAFT_MAX_AGE_MS;
    if (valid && !stale && countDraftPieces(draft)) return draft;
  } catch { /* fall through and drop it */ }
  await AsyncStorage.removeItem(SCAN_DRAFT_KEY);
  return null;
}

export function countDraftPieces(draft: StoredScanDraft): number {
  return new Set([...draft.ready, ...draft.pending].map(p => p.tempId)).size;
}

type ScanDraftState = {
  /** What the tray shows; null when there is no resumable draft. */
  summary: ScanDraftSummary | null;
  refresh: () => Promise<void>;
  set: (summary: ScanDraftSummary | null) => void;
  discard: () => Promise<void>;
};

export const useScanDraftStore = create<ScanDraftState>((set) => ({
  summary: null,
  refresh: async () => {
    const draft = await readScanDraft().catch(() => null);
    set({ summary: draft ? { count: countDraftPieces(draft), image: draft.image } : null });
  },
  set: (summary) => set({ summary }),
  discard: async () => {
    set({ summary: null });
    await AsyncStorage.removeItem(SCAN_DRAFT_KEY).catch(() => {});
  },
}));
