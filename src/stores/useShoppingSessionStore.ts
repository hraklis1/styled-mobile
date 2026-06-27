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
  storeName: string;
  branchLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  locality: string | null;
  region: string | null;
  countryCode: string | null;
  locationSource: ShoppingLocationSource;
  locationStatus: ShoppingLocationStatus;
  locationCapturedAt: number | null;
  startedAt: number;
};

export type PendingShoppingUpload = {
  id: string;
  localFileUri: string;
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
  activeCaptureGroupId: string | null;
  activeCaptureSessionId: string | null;
  activeCaptureGroupStartedAt: number | null;
  activeCapturePhotoCount: number;
  activeCaptureTagCount: number;
  nextCaptureSequence: number;
  setStoreName: (name: string) => void;
  setShoppingSession: (session: ShoppingSessionContext) => void;
  updateShoppingSessionLocation: (
    sessionId: string,
    patch: Partial<Omit<ShoppingSessionContext, 'id' | 'storeName' | 'startedAt'>>,
  ) => void;
  clearStoreName: () => void;
  setBackgroundTimestamp: (time: number | null) => void;
  addPendingUpload: (upload: PendingShoppingUpload) => void;
  assignCaptureGroup: (
    sessionId: string | null,
    candidateGroupId: string,
    timestamp: number,
  ) => CaptureGroupAssignment;
  startNextCaptureGroup: () => void;
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
  const deduplicated = recentSessions.filter((recent) => !(
    recent.storeName.toLocaleLowerCase() === session.storeName.toLocaleLowerCase()
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
        recentStores: addRecentStore(state.recentStores, session.storeName),
        recentSessions: session.locationStatus === 'resolved'
          ? addRecentSession(state.recentSessions, session)
          : state.recentSessions,
        ...(state.activeCaptureSessionId !== session.id ? {
          activeCaptureGroupId: null,
          activeCaptureSessionId: session.id,
          activeCaptureGroupStartedAt: null,
          activeCapturePhotoCount: 0,
          activeCaptureTagCount: 0,
        } : {}),
      })),

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
              locationSource: currentSession.locationSource,
              locationStatus: currentSession.locationStatus,
              locationCapturedAt: currentSession.locationCapturedAt,
            }
            : upload),
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

      assignCaptureGroup: (sessionId, candidateGroupId, timestamp) => {
        let assignment: CaptureGroupAssignment = {
          groupId: candidateGroupId,
          groupStartedAt: timestamp,
          sequence: 1,
        };
        set((state) => {
          const canReuseActiveGroup = state.activeCaptureGroupId !== null
            && state.activeCaptureSessionId === sessionId;
          const groupId = canReuseActiveGroup ? state.activeCaptureGroupId! : candidateGroupId;
          const groupStartedAt = canReuseActiveGroup
            ? state.activeCaptureGroupStartedAt ?? timestamp
            : timestamp;
          assignment = {
            groupId,
            groupStartedAt,
            sequence: state.nextCaptureSequence,
          };
          return {
            activeCaptureGroupId: groupId,
            activeCaptureSessionId: sessionId,
            activeCaptureGroupStartedAt: groupStartedAt,
            activeCapturePhotoCount: canReuseActiveGroup ? state.activeCapturePhotoCount + 1 : 1,
            activeCaptureTagCount: canReuseActiveGroup ? state.activeCaptureTagCount : 0,
            nextCaptureSequence: state.nextCaptureSequence + 1,
          };
        });
        return assignment;
      },

      startNextCaptureGroup: () => set({
        activeCaptureGroupId: null,
        activeCaptureGroupStartedAt: null,
        activeCapturePhotoCount: 0,
        activeCaptureTagCount: 0,
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
      storage: createJSONStorage(() => shoppingSessionStorage),
      partialize: ({
        currentStoreName,
        currentSession,
        recentStores,
        recentSessions,
        lastBackgroundTimestamp,
        pendingUploads,
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
