import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { ShoppingCaptureRole } from '../lib/classifyShoppingCapture';
import type { ShoppingSnapOrganizationUpdate } from '../lib/shoppingSnapOrganizer';
import type { ShoppingFindCatalogPatch, ShoppingFindCatalogStatus } from '../types/shoppingSnap';

const MAX_RECENT_STORES = 5;

export type ShoppingLocationStatus = 'resolving' | 'resolved' | 'unavailable';
export type ShoppingLocationSource = 'device' | 'photo_exif' | 'manual' | 'recent' | 'unavailable';

export type ShoppingSessionContext = {
  id: string;
  storeLocationId: string | null;
  storeName: string | null;
  branchLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  locationHint: string | null;
  locationSource: ShoppingLocationSource;
  locationStatus: ShoppingLocationStatus;
  locationCapturedAt: number | null;
  startedAt: number;
  lastActivityAt: number;
  pausedAt: number | null;
  endedAt: number | null;
  lifecycleStatus: 'active' | 'paused' | 'ended';
};

export type ShoppingVisitPreview = {
  id: string;
  shoppingSessionId: string;
  captureGroupId: string;
  captureSequence: number;
  localFileUri: string;
  previewUri: string | null;
  captureRole: ShoppingCaptureRole;
  ocrStatus: PendingShoppingUpload['ocrStatus'];
  syncStatus: 'pending' | 'synced';
  storagePath: string | null;
  timestamp: number;
};

export type PendingShoppingUpload = {
  id: string;
  localFileUri: string;
  previewUri?: string | null;
  storeName: string | null;
  storeLocationId: string | null;
  shoppingSessionId: string | null;
  sessionStartedAt: number | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  branchLabel: string | null;
  locationHint?: string | null;
  locationSource: ShoppingLocationSource;
  locationStatus: ShoppingLocationStatus;
  locationCapturedAt: number | null;
  captureGroupId: string;
  captureGroupStartedAt: number;
  captureSequence: number;
  captureRole: ShoppingCaptureRole;
  extractedPrice: number | null;
  rawOcrText: string;
  ocrStatus: 'processing' | 'complete' | 'failed';
  timestamp: number;
  category?: string | null;
  sizeLabel?: string | null;
  colorLabel?: string | null;
  materialLabel?: string | null;
  notes?: string | null;
  isFavorite?: boolean;
  catalogStatus?: ShoppingFindCatalogStatus;
};

type PendingUploadOCRPatch = Pick<
  PendingShoppingUpload,
  'extractedPrice' | 'rawOcrText' | 'ocrStatus' | 'captureRole'
>;

export type CaptureGroupAssignment = {
  groupId: string;
  groupStartedAt: number;
  sequence: number;
};

type ShoppingSessionState = {
  currentStoreName: string | null;
  currentSession: ShoppingSessionContext | null;
  recentStores: string[];
  recentSessions: ShoppingSessionContext[];
  lastBackgroundTimestamp: number | null;
  pendingUploads: PendingShoppingUpload[];
  pendingVisitMetadata: ShoppingSessionContext[];
  visitPreviews: ShoppingVisitPreview[];
  deletedCaptureIds: string[];
  activeCaptureGroupId: string | null;
  activeCaptureSessionId: string | null;
  activeCaptureGroupStartedAt: number | null;
  activeCapturePhotoCount: number;
  activeCaptureTagCount: number;
  nextCaptureSequence: number;
  setStoreName: (name: string) => void;
  setShoppingSession: (session: ShoppingSessionContext) => void;
  ensureActiveVisit: (session: ShoppingSessionContext) => void;
  resumeVisit: (now?: number) => void;
  pauseVisit: (now?: number) => void;
  endVisit: (now?: number) => void;
  assignVisitStore: (sessionId: string, storeName: string, patch?: Partial<ShoppingSessionContext>) => void;
  assignCaptureStore: (captureIds: string[], storeName: string) => void;
  updateShoppingSessionLocation: (
    sessionId: string,
    patch: Partial<Omit<ShoppingSessionContext, 'id' | 'storeName' | 'startedAt'>>,
  ) => void;
  clearStoreName: () => void;
  setBackgroundTimestamp: (time: number | null) => void;
  addPendingUpload: (upload: PendingShoppingUpload) => void;
  recordVisitPreview: (preview: ShoppingVisitPreview) => void;
  updateVisitPreview: (id: string, patch: Partial<ShoppingVisitPreview>) => void;
  removeVisitPreview: (id: string) => void;
  markCaptureDeleted: (id: string) => void;
  clearCaptureDeleted: (id: string) => void;
  clearPendingVisitMetadata: (sessionId: string) => void;
  assignCaptureGroup: (
    sessionId: string | null,
    candidateGroupId: string,
    timestamp: number,
  ) => CaptureGroupAssignment;
  applyCaptureRegroup: (updates: ShoppingSnapOrganizationUpdate[]) => void;
  regroupPendingUploads: (updates: ShoppingSnapOrganizationUpdate[]) => void;
  updatePendingGroupCatalog: (captureGroupId: string, patch: ShoppingFindCatalogPatch) => void;
  updatePendingUploadOCR: (id: string, patch: PendingUploadOCRPatch) => void;
  markPendingUploadLocationUnavailable: (id: string) => void;
  removePendingUpload: (id: string) => void;
};

const shoppingSessionMMKV = createMMKV({
  id: 'styled.shopping-session',
});

const shoppingSessionStorage: StateStorage = {
  getItem: (name) => shoppingSessionMMKV.getString(name) ?? null,
  setItem: (name, value) => {
    shoppingSessionMMKV.set(name, value);
  },
  removeItem: (name) => {
    shoppingSessionMMKV.remove(name);
  },
};

function addRecentStore(recentStores: string[], storeName: string): string[] {
  const deduplicated = recentStores.filter(
    (recentStore) => recentStore.toLocaleLowerCase() !== storeName.toLocaleLowerCase(),
  );

  return [storeName, ...deduplicated].slice(0, MAX_RECENT_STORES);
}

function addRecentSession(
  recentSessions: ShoppingSessionContext[],
  session: ShoppingSessionContext,
): ShoppingSessionContext[] {
  if (!session.storeName) return recentSessions;
  const deduplicated = recentSessions.filter((recent) => !(
    recent.storeName?.toLocaleLowerCase() === session.storeName?.toLocaleLowerCase()
    && recent.locality === session.locality
    && recent.branchLabel === session.branchLabel
  ));
  return [session, ...deduplicated].slice(0, MAX_RECENT_STORES);
}

export const useShoppingSessionStore = create<ShoppingSessionState>()(
  persist(
    (set) => ({
      currentStoreName: null,
      currentSession: null,
      recentStores: [],
      recentSessions: [],
      lastBackgroundTimestamp: null,
      pendingUploads: [],
      pendingVisitMetadata: [],
      visitPreviews: [],
      deletedCaptureIds: [],
      activeCaptureGroupId: null,
      activeCaptureSessionId: null,
      activeCaptureGroupStartedAt: null,
      activeCapturePhotoCount: 0,
      activeCaptureTagCount: 0,
      nextCaptureSequence: 1,

      setStoreName: (name) => {
        const storeName = name.trim();
        if (!storeName) return;

        set((state) => ({
          currentStoreName: storeName,
          recentStores: addRecentStore(state.recentStores, storeName),
        }));
      },

      setShoppingSession: (session) => set((state) => ({
        currentStoreName: session.storeName,
        currentSession: session,
        recentStores: session.storeName
          ? addRecentStore(state.recentStores, session.storeName)
          : state.recentStores,
        recentSessions: session.locationStatus === 'resolved' && session.storeName
          ? addRecentSession(state.recentSessions, session)
          : state.recentSessions,
        pendingVisitMetadata: upsertVisitMetadata(state.pendingVisitMetadata, session),
        ...(state.activeCaptureSessionId !== session.id ? {
          activeCaptureGroupId: null,
          activeCaptureSessionId: session.id,
          activeCaptureGroupStartedAt: null,
          activeCapturePhotoCount: 0,
          activeCaptureTagCount: 0,
        } : {}),
      })),

      ensureActiveVisit: (session) => set((state) => {
        if (state.currentSession && state.currentSession.lifecycleStatus !== 'ended') return state;
        return {
          currentStoreName: session.storeName,
          currentSession: session,
          pendingVisitMetadata: upsertVisitMetadata(state.pendingVisitMetadata, session),
          activeCaptureSessionId: session.id,
          activeCaptureGroupId: null,
          activeCaptureGroupStartedAt: null,
          activeCapturePhotoCount: 0,
          activeCaptureTagCount: 0,
          visitPreviews: [],
        };
      }),

      resumeVisit: (now = Date.now()) => set((state) => {
        if (!state.currentSession) return state;
        const currentSession: ShoppingSessionContext = {
          ...state.currentSession,
          lifecycleStatus: 'active',
          pausedAt: null,
          lastActivityAt: now,
        };
        // The active group deliberately survives resume. Backgrounding the app
        // mid-item — to answer a text, to check a price — used to split that
        // item in two with nothing on screen to say so.
        return {
          currentSession,
          pendingVisitMetadata: upsertVisitMetadata(state.pendingVisitMetadata, currentSession),
        };
      }),

      pauseVisit: (now = Date.now()) => set((state) => {
        if (!state.currentSession) return state;
        const hasContent = state.visitPreviews.some(
          (preview) => preview.shoppingSessionId === state.currentSession?.id,
        ) || Boolean(state.currentSession.storeName);
        if (!hasContent) {
          return {
            currentStoreName: null,
            currentSession: null,
            activeCaptureGroupId: null,
            activeCaptureSessionId: null,
            activeCaptureGroupStartedAt: null,
            activeCapturePhotoCount: 0,
            activeCaptureTagCount: 0,
            visitPreviews: [],
          };
        }
        const currentSession: ShoppingSessionContext = {
          ...state.currentSession,
          lifecycleStatus: 'paused',
          pausedAt: now,
        };
        return {
          currentSession,
          pendingVisitMetadata: upsertVisitMetadata(state.pendingVisitMetadata, currentSession),
        };
      }),

      endVisit: (now = Date.now()) => set((state) => {
        const ended = state.currentSession ? {
          ...state.currentSession,
          lifecycleStatus: 'ended' as const,
          endedAt: now,
        } : null;
        return {
          currentStoreName: null,
          currentSession: null,
          pendingVisitMetadata: ended
            ? upsertVisitMetadata(state.pendingVisitMetadata, ended)
            : state.pendingVisitMetadata,
          activeCaptureGroupId: null,
          activeCaptureSessionId: null,
          activeCaptureGroupStartedAt: null,
          activeCapturePhotoCount: 0,
          activeCaptureTagCount: 0,
          visitPreviews: [],
        };
      }),

      assignVisitStore: (sessionId, rawStoreName, patch = {}) => set((state) => {
        const storeName = rawStoreName.trim();
        if (!storeName) return state;
        const base = state.currentSession?.id === sessionId
          ? state.currentSession
          : state.pendingVisitMetadata.find((session) => session.id === sessionId)
            ?? (() => {
              const upload = state.pendingUploads.find((item) => item.shoppingSessionId === sessionId);
              if (!upload) return null;
              return {
                id: sessionId,
                storeLocationId: upload.storeLocationId,
                storeName: upload.storeName,
                branchLabel: upload.branchLabel,
                latitude: upload.latitude,
                longitude: upload.longitude,
                locationAccuracyMeters: upload.locationAccuracyMeters,
                locality: upload.locality,
                region: upload.region,
                countryCode: upload.countryCode,
                locationHint: upload.locationHint ?? null,
                locationSource: upload.locationSource,
                locationStatus: upload.locationStatus,
                locationCapturedAt: upload.locationCapturedAt,
                startedAt: upload.sessionStartedAt ?? upload.timestamp,
                lastActivityAt: upload.timestamp,
                pausedAt: null,
                endedAt: null,
                lifecycleStatus: 'ended' as const,
              };
            })();
        if (!base) return state;
        const currentSession: ShoppingSessionContext = {
          ...base,
          ...patch,
          id: base.id,
          storeName,
          lastActivityAt: Date.now(),
        };
        return {
          currentStoreName: state.currentSession?.id === sessionId ? storeName : state.currentStoreName,
          currentSession: state.currentSession?.id === sessionId ? currentSession : state.currentSession,
          recentStores: addRecentStore(state.recentStores, storeName),
          recentSessions: currentSession.locationStatus === 'resolved'
            ? addRecentSession(state.recentSessions, currentSession)
            : state.recentSessions,
          pendingVisitMetadata: upsertVisitMetadata(state.pendingVisitMetadata, currentSession),
          pendingUploads: state.pendingUploads.map((upload) => upload.shoppingSessionId === sessionId
            ? {
              ...upload,
              storeName,
              storeLocationId: currentSession.storeLocationId,
              latitude: currentSession.latitude,
              longitude: currentSession.longitude,
              locationAccuracyMeters: currentSession.locationAccuracyMeters,
              locality: currentSession.locality,
              region: currentSession.region,
              countryCode: currentSession.countryCode,
              branchLabel: currentSession.branchLabel,
              locationHint: currentSession.locationHint,
              locationSource: currentSession.locationSource,
              locationStatus: currentSession.locationStatus,
              locationCapturedAt: currentSession.locationCapturedAt,
            }
            : upload),
        };
      }),

      assignCaptureStore: (captureIds, rawStoreName) => set((state) => {
        const storeName = rawStoreName.trim();
        const ids = new Set(captureIds);
        if (!storeName || ids.size === 0) return state;
        return {
          recentStores: addRecentStore(state.recentStores, storeName),
          pendingUploads: state.pendingUploads.map((upload) => ids.has(upload.id)
            ? { ...upload, storeName }
            : upload),
        };
      }),

      updateShoppingSessionLocation: (sessionId, patch) => set((state) => {
        if (!state.currentSession || state.currentSession.id !== sessionId) return state;
        const currentSession = { ...state.currentSession, ...patch };
        return {
          currentSession,
          recentSessions: currentSession.locationStatus === 'resolved'
            ? addRecentSession(state.recentSessions, currentSession)
            : state.recentSessions,
          pendingUploads: state.pendingUploads.map((upload) => upload.shoppingSessionId === sessionId
            ? {
              ...upload,
              latitude: currentSession.latitude,
              longitude: currentSession.longitude,
              locationAccuracyMeters: currentSession.locationAccuracyMeters,
              locality: currentSession.locality,
              region: currentSession.region,
              countryCode: currentSession.countryCode,
              branchLabel: currentSession.branchLabel,
              locationHint: currentSession.locationHint,
              locationSource: currentSession.locationSource,
              locationStatus: currentSession.locationStatus,
              locationCapturedAt: currentSession.locationCapturedAt,
            }
            : upload),
          pendingVisitMetadata: upsertVisitMetadata(state.pendingVisitMetadata, currentSession),
        };
      }),

      clearStoreName: () => set({
        currentStoreName: null,
        currentSession: null,
        activeCaptureGroupId: null,
        activeCaptureSessionId: null,
        activeCaptureGroupStartedAt: null,
        activeCapturePhotoCount: 0,
        activeCaptureTagCount: 0,
      }),

      setBackgroundTimestamp: (time) => set({ lastBackgroundTimestamp: time }),

      addPendingUpload: (upload) =>
        set((state) => ({
          pendingUploads: state.pendingUploads.some((item) => item.id === upload.id)
            ? state.pendingUploads
            : [...state.pendingUploads, upload],
        })),

      recordVisitPreview: (preview) => set((state) => ({
        visitPreviews: state.visitPreviews.some((item) => item.id === preview.id)
          ? state.visitPreviews
          : [...state.visitPreviews, preview],
        currentSession: state.currentSession?.id === preview.shoppingSessionId
          ? { ...state.currentSession, lastActivityAt: preview.timestamp }
          : state.currentSession,
      })),

      updateVisitPreview: (id, patch) => set((state) => ({
        visitPreviews: state.visitPreviews.map((preview) => preview.id === id
          ? { ...preview, ...patch }
          : preview),
        pendingUploads: state.pendingUploads.map((upload) => upload.id === id && 'previewUri' in patch
          ? { ...upload, previewUri: patch.previewUri ?? null }
          : upload),
      })),

      removeVisitPreview: (id) => set((state) => ({
        visitPreviews: state.visitPreviews.filter((preview) => preview.id !== id),
      })),

      markCaptureDeleted: (id) => set((state) => ({
        deletedCaptureIds: state.deletedCaptureIds.includes(id)
          ? state.deletedCaptureIds
          : [...state.deletedCaptureIds, id],
        pendingUploads: state.pendingUploads.filter((upload) => upload.id !== id),
        visitPreviews: state.visitPreviews.filter((preview) => preview.id !== id),
      })),

      clearCaptureDeleted: (id) => set((state) => ({
        deletedCaptureIds: state.deletedCaptureIds.filter((candidate) => candidate !== id),
      })),

      clearPendingVisitMetadata: (sessionId) => set((state) => ({
        pendingVisitMetadata: state.pendingVisitMetadata.filter((session) => session.id !== sessionId),
      })),

      /**
       * Every capture opens its own group. Grouping too much is the expensive
       * mistake — merging two items is one tap, splitting one apart needs the
       * organizer — so the shutter never silently absorbs a photo into
       * whatever came before it. Photos are drawn back together deliberately,
       * by `applyCaptureRegroup`: automatically for a price tag shot right
       * after a garment, or by the user pressing "Same item".
       */
      assignCaptureGroup: (sessionId, candidateGroupId, timestamp) => {
        let assignment: CaptureGroupAssignment = {
          groupId: candidateGroupId,
          groupStartedAt: timestamp,
          sequence: 1,
        };
        set((state) => {
          assignment = {
            groupId: candidateGroupId,
            groupStartedAt: timestamp,
            sequence: state.nextCaptureSequence,
          };
          return {
            activeCaptureGroupId: candidateGroupId,
            activeCaptureSessionId: sessionId,
            activeCaptureGroupStartedAt: timestamp,
            activeCapturePhotoCount: 1,
            activeCaptureTagCount: 0,
            nextCaptureSequence: state.nextCaptureSequence + 1,
          };
        });
        return assignment;
      },

      /**
       * Applies a regroup to every local record of the affected captures —
       * the queued upload and, when the visit is still open, the rail preview.
       * Patching both is what lets the rail restack the instant a tag attaches
       * rather than after a round trip.
       */
      applyCaptureRegroup: (updates) => set((state) => {
        if (updates.length === 0) return state;
        const updateById = new Map(updates.map((update) => [update.snapId, update]));
        return {
          pendingUploads: state.pendingUploads.map((upload) => {
            const update = updateById.get(upload.id);
            if (!update) return upload;
            return {
              ...upload,
              captureGroupId: update.captureGroupId,
              captureGroupStartedAt: update.captureGroupStartedAt,
              captureSequence: update.captureSequence,
              captureRole: update.captureRole,
            };
          }),
          visitPreviews: state.visitPreviews.map((preview) => {
            const update = updateById.get(preview.id);
            if (!update) return preview;
            return {
              ...preview,
              captureGroupId: update.captureGroupId,
              captureSequence: update.captureSequence,
              captureRole: update.captureRole,
            };
          }),
        };
      }),

      regroupPendingUploads: (updates) => set((state) => {
        if (updates.length === 0) return state;
        const updateById = new Map(updates.map((update) => [update.snapId, update]));
        return {
          pendingUploads: state.pendingUploads.map((upload) => {
            const update = updateById.get(upload.id);
            if (!update) return upload;
            return {
              ...upload,
              captureGroupId: update.captureGroupId,
              captureGroupStartedAt: update.captureGroupStartedAt,
              captureSequence: update.captureSequence,
              captureRole: update.captureRole,
            };
          }),
          visitPreviews: state.visitPreviews.map((preview) => {
            const update = updateById.get(preview.id);
            if (!update) return preview;
            return {
              ...preview,
              captureGroupId: update.captureGroupId,
              captureSequence: update.captureSequence,
              captureRole: update.captureRole,
            };
          }),
        };
      }),

      updatePendingGroupCatalog: (captureGroupId, patch) => set((state) => ({
        pendingUploads: state.pendingUploads.map((upload) => upload.captureGroupId === captureGroupId
          ? {
            ...upload,
            ...patch,
          }
          : upload),
      })),

      updatePendingUploadOCR: (id, patch) => set((state) => {
        const upload = state.pendingUploads.find((item) => item.id === id);
        const newlyDetectedTag = upload?.captureRole !== 'tag'
          && patch.captureRole === 'tag'
          && upload?.captureGroupId === state.activeCaptureGroupId;
        return {
          pendingUploads: state.pendingUploads.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
          visitPreviews: state.visitPreviews.map((item) => item.id === id
            ? { ...item, captureRole: patch.captureRole, ocrStatus: patch.ocrStatus }
            : item),
          activeCaptureTagCount: newlyDetectedTag
            ? state.activeCaptureTagCount + 1
            : state.activeCaptureTagCount,
        };
      }),

      markPendingUploadLocationUnavailable: (id) => set((state) => ({
        pendingUploads: state.pendingUploads.map((upload) => upload.id === id
          ? { ...upload, locationStatus: 'unavailable', locationSource: 'unavailable' }
          : upload),
      })),

      removePendingUpload: (id) =>
        set((state) => ({
          pendingUploads: state.pendingUploads.filter((upload) => upload.id !== id),
        })),
    }),
    {
      name: 'shopping-session-v1',
      version: 2,
      storage: createJSONStorage(() => shoppingSessionStorage),
      migrate: (persistedState: unknown) => {
        const state = (persistedState ?? {}) as Partial<ShoppingSessionState>;
        const normalizeSession = (session: ShoppingSessionContext | null | undefined) => {
          if (!session) return null;
          return {
            ...session,
            storeName: session.storeName ?? null,
            locationHint: session.locationHint ?? null,
            lastActivityAt: session.lastActivityAt ?? session.startedAt,
            pausedAt: session.pausedAt ?? null,
            endedAt: session.endedAt ?? null,
            lifecycleStatus: session.lifecycleStatus ?? 'paused',
          } satisfies ShoppingSessionContext;
        };
        return {
          ...state,
          currentSession: normalizeSession(state.currentSession),
          recentSessions: (state.recentSessions ?? [])
            .map((session) => normalizeSession(session))
            .filter((session): session is ShoppingSessionContext => Boolean(session?.storeName)),
          pendingVisitMetadata: state.pendingVisitMetadata ?? [],
          visitPreviews: state.visitPreviews ?? [],
          deletedCaptureIds: state.deletedCaptureIds ?? [],
        };
      },
      partialize: ({
        currentStoreName,
        currentSession,
        recentStores,
        recentSessions,
        lastBackgroundTimestamp,
        pendingUploads,
        pendingVisitMetadata,
        visitPreviews,
        deletedCaptureIds,
        activeCaptureGroupId,
        activeCaptureSessionId,
        activeCaptureGroupStartedAt,
        activeCapturePhotoCount,
        activeCaptureTagCount,
        nextCaptureSequence,
      }) => ({
        currentStoreName,
        currentSession,
        recentStores,
        recentSessions,
        lastBackgroundTimestamp,
        pendingUploads,
        pendingVisitMetadata,
        visitPreviews,
        deletedCaptureIds,
        activeCaptureGroupId,
        activeCaptureSessionId,
        activeCaptureGroupStartedAt,
        activeCapturePhotoCount,
        activeCaptureTagCount,
        nextCaptureSequence,
      }),
    },
  ),
);

function upsertVisitMetadata(
  metadata: ShoppingSessionContext[],
  session: ShoppingSessionContext,
): ShoppingSessionContext[] {
  return [...metadata.filter((item) => item.id !== session.id), session];
}
