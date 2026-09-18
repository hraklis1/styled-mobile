import { useShoppingSessionStore } from '../../stores/useShoppingSessionStore';
import { requestShoppingSync } from '../../hooks/useShoppingSyncManager';
import { useState } from 'react';
import { Text, View, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import {
  emptyShoppingAccount,
  useShoppingOfflineStore,
} from '../../stores/useShoppingOfflineStore';
import { syncShoppingMutations } from '../../lib/shoppingMutationSync';
import { CATALOG_COLUMNS } from '../../lib/shoppingCatalog';
import { colors, typography } from '../../theme';
import type { ShoppingFindCatalogPatch } from '../../types/shoppingSnap';
export function ShoppingSyncNotice() {
  const { user } = useAuth();
  const account = useShoppingOfflineStore(
    (state) => state.accounts[user?.id ?? ''] ?? emptyShoppingAccount,
  );
  const uploadError = useShoppingSessionStore(
    (state) =>
      state.pendingUploads.find((upload) => upload.uploadError)?.uploadError,
  );
  const issue = account.operations.find((operation) => operation.error);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const retry = () => {
    setBusy(true);
    void syncShoppingMutations(user.id)
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };
  if (!issue)
    return uploadError ? (
      <View style={{ padding: 12, backgroundColor: colors.surfaceSubtle }}>
        <Text style={{ color: colors.foreground }}>{uploadError}</Text>
        <TouchableOpacity
          onPress={() => void requestShoppingSync(user.id)}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: colors.action }}>Retry photo backup</Text>
        </TouchableOpacity>
      </View>
    ) : null;
  const resolve = (keepLocal: boolean) => {
    if (issue.kind === 'organization') {
      const updates = issue.updates?.map((update) => {
        const saved = issue.conflicts?.[update.snapId] as
          | {
              captureGroupId: string;
              captureRole: typeof update.captureRole;
              captureSequence: number;
            }
          | undefined;
        return saved
          ? {
              ...update,
              ...(!keepLocal ? saved : {}),
              baseGroupId: saved.captureGroupId,
            }
          : update;
      });
      useShoppingOfflineStore
        .getState()
        .update(user.id, issue.id, {
          updates,
          conflicts: undefined,
          error: undefined,
        });
      retry();
      return;
    }
    const base = { ...issue.base } as Record<string, unknown>;
    const patch = { ...issue.patch } as Record<string, unknown>;
    for (const [column, value] of Object.entries(issue.conflicts ?? {})) {
      const key =
        Object.keys(CATALOG_COLUMNS).find(
          (key) => CATALOG_COLUMNS[key] === column,
        ) ?? column;
      base[key] = value;
      if (!keepLocal) patch[key] = value;
    }
    useShoppingOfflineStore
      .getState()
      .update(user.id, issue.id, {
        base: base as ShoppingFindCatalogPatch,
        patch: patch as ShoppingFindCatalogPatch,
        conflicts: undefined,
        error: undefined,
      });
    retry();
  };
  return (
    <View
      style={{ backgroundColor: colors.surfaceSubtle, padding: 12, gap: 4 }}
    >
      <Text style={{ ...typography.text.caption, color: colors.foreground }}>
        {issue.error}
      </Text>
      <TouchableOpacity
        style={{ minHeight: 44, justifyContent: 'center' }}
        disabled={busy}
        onPress={() => {
          if (issue.conflicts)
            Alert.alert(
              'Choose which changes to keep',
              issue.kind === 'organization'
                ? 'These photographs were grouped differently on another device. Choose which grouping to keep.'
                : `Changed fields: ${Object.keys(issue.conflicts)
                    .map((key) => key.replaceAll('_', ' '))
                    .join(', ')}. Other edits will be preserved.`,
              [
                { text: 'Later', style: 'cancel' },
                { text: 'Keep saved values', onPress: () => resolve(false) },
                { text: 'Keep my changes', onPress: () => resolve(true) },
              ],
            );
          else retry();
        }}
      >
        <Text style={{ color: busy ? colors.mutedForeground : colors.action }}>
          {busy ? 'Backing up…' : issue.conflicts ? 'Review changes' : 'Retry'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
