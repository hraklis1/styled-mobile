import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DraggablePhotoGrid } from './DraggablePhotoGrid';
import { useCurrencyCode } from '../../hooks/useCurrencyCode';
import { formatShoppingPrice } from '../../lib/shoppingPresentation';
import {
  buildShoppingSnapOrganizationUpdates,
  type ShoppingSnapOrganizationStage,
  type ShoppingSnapOrganizationUpdate,
} from '../../lib/shoppingSnapOrganizer';
import { colors, radii, spacing, typography } from '../../theme';
import type { ShoppingCaptureRole, ShoppingSnap } from '../../types/shoppingSnap';

const TILE_WIDTH = 92;
const PHOTO_HEIGHT = 112;
const CHIP_HEIGHT = 28;
const TILE_INNER_GAP = spacing.xs;
const TILE_HEIGHT = PHOTO_HEIGHT + TILE_INNER_GAP + CHIP_HEIGHT;
const GRID_GAP = spacing.sm;

function roleLabel(role: ShoppingCaptureRole): string {
  if (role === 'tag') return 'Tag';
  if (role === 'garment') return 'Garment';
  return 'Unsorted';
}

function nextRole(role: ShoppingCaptureRole): ShoppingCaptureRole {
  if (role === 'unknown') return 'garment';
  if (role === 'garment') return 'tag';
  return 'unknown';
}

function stagePrice(snaps: ShoppingSnap[], snapIds: string[], currencyCode: string): string | null {
  const snapSet = new Set(snapIds);
  const price = snaps.find((snap) => snapSet.has(snap.id) && snap.captureRole === 'tag' && snap.extractedPrice !== null)?.extractedPrice
    ?? snaps.find((snap) => snapSet.has(snap.id) && snap.extractedPrice !== null)?.extractedPrice
    ?? null;
  return formatShoppingPrice(price, currencyCode);
}

export function ShoppingSnapOrganizerModal({
  visible,
  snaps,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean;
  snaps: ShoppingSnap[];
  onClose: () => void;
  onSave: (updates: ShoppingSnapOrganizationUpdate[]) => Promise<void>;
  isSaving: boolean;
}) {
  const insets = useSafeAreaInsets();
  const currencyCode = useCurrencyCode();
  const [unassignedIds, setUnassignedIds] = useState<string[]>([]);
  const [stages, setStages] = useState<ShoppingSnapOrganizationStage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [rolesBySnapId, setRolesBySnapId] = useState<Record<string, ShoppingCaptureRole>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const snapById = useMemo(() => new Map(snaps.map((snap) => [snap.id, snap])), [snaps]);
  const snapsWithStagedRoles = useMemo(
    () => snaps.map((snap) => ({ ...snap, captureRole: rolesBySnapId[snap.id] ?? snap.captureRole })),
    [rolesBySnapId, snaps],
  );
  const originalCaptureGroupId = snaps[0]?.captureGroupId ?? '';
  const hasRoleChanges = snaps.some((snap) => rolesBySnapId[snap.id] && rolesBySnapId[snap.id] !== snap.captureRole);
  const hasGroupChanges = stages.length > 0;
  const canSave = (hasRoleChanges || hasGroupChanges) && snaps.length > 0 && !isSaving;

  const orderIds = useCallback((ids: string[]) => {
    const order = new Map(snaps.map((snap, index) => [snap.id, index]));
    return [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }, [snaps]);

  useEffect(() => {
    if (!visible) return;
    setUnassignedIds(snaps.map((snap) => snap.id));
    setStages([]);
    setSelectedIds(new Set());
    setRolesBySnapId(Object.fromEntries(snaps.map((snap) => [snap.id, snap.captureRole])));
    setSaveError(null);
  }, [snaps, visible]);

  const toggleSelected = useCallback((snapId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(snapId)) next.delete(snapId);
      else next.add(snapId);
      return next;
    });
  }, []);

  const cycleRole = useCallback((snapId: string) => {
    setRolesBySnapId((current) => {
      const snap = snapById.get(snapId);
      const currentRole = current[snapId] ?? snap?.captureRole ?? 'unknown';
      return { ...current, [snapId]: nextRole(currentRole) };
    });
  }, [snapById]);

  const makeItem = useCallback(() => {
    const selected = unassignedIds.filter((snapId) => selectedIds.has(snapId));
    if (selected.length === 0) return;
    setStages((current) => [...current, { id: Crypto.randomUUID(), snapIds: selected }]);
    setUnassignedIds((current) => current.filter((snapId) => !selectedIds.has(snapId)));
    setSelectedIds(new Set());
    setSaveError(null);
    void Haptics.selectionAsync();
  }, [selectedIds, unassignedIds]);

  const undoStage = useCallback((stageId: string) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return;
    setStages((current) => current.filter((item) => item.id !== stageId));
    setUnassignedIds((current) => orderIds([...current, ...stage.snapIds]));
    setSelectedIds(new Set());
  }, [orderIds, stages]);

  const save = useCallback(() => {
    const stagedItems = [
      ...stages,
      { id: 'unassigned', snapIds: unassignedIds },
    ].filter((stage) => stage.snapIds.length > 0);
    const updates = buildShoppingSnapOrganizationUpdates(snaps, stagedItems, rolesBySnapId, {
      originalCaptureGroupId,
      createGroupId: () => Crypto.randomUUID(),
    });
    setSaveError(null);
    void onSave(updates).catch((error) => {
      setSaveError(error instanceof Error ? error.message : 'Please try again.');
    });
  }, [onSave, originalCaptureGroupId, rolesBySnapId, snaps, stages, unassignedIds]);

  const renderPhotoTile = useCallback((snapId: string) => {
    const snap = snapById.get(snapId);
    if (!snap) return null;
    const role = rolesBySnapId[snapId] ?? snap.captureRole;
    const selected = selectedIds.has(snapId);
    return (
      <View
        style={[styles.photo, selected && styles.photoSelected]}
        accessibilityLabel={`${roleLabel(role)} photo, hold to reorder`}
        accessibilityState={{ selected }}
      >
        <Image source={{ uri: snap.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {selected ? (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={15} color={colors.primaryForeground} />
          </View>
        ) : null}
      </View>
    );
  }, [rolesBySnapId, selectedIds, snapById]);

  const renderRoleChip = useCallback((snapId: string) => {
    const snap = snapById.get(snapId);
    if (!snap) return null;
    const role = rolesBySnapId[snapId] ?? snap.captureRole;
    return (
      <TouchableOpacity
        style={styles.roleChip}
        onPress={() => cycleRole(snapId)}
        disabled={isSaving}
        accessibilityLabel={`Change photo role from ${roleLabel(role)}`}
      >
        <Text style={styles.roleText}>{roleLabel(role)}</Text>
      </TouchableOpacity>
    );
  }, [cycleRole, isSaving, rolesBySnapId, snapById]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ORGANIZE</Text>
            <Text style={styles.title}>Group photos</Text>
            <Text style={styles.subtitle}>Group related photos into items, then save.</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={onClose} disabled={isSaving} accessibilityLabel="Close organizer">
            <Ionicons name="close" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
          <View style={styles.pool}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Unassigned</Text>
                <Text style={styles.sectionMeta}>{unassignedIds.length} photo{unassignedIds.length === 1 ? '' : 's'}</Text>
              </View>
              <TouchableOpacity
                style={[styles.makeButton, selectedIds.size === 0 && styles.makeButtonDisabled]}
                onPress={makeItem}
                disabled={selectedIds.size === 0 || isSaving}
              >
                <Ionicons name="albums-outline" size={16} color={colors.primaryForeground} />
                <Text style={styles.makeText}>Create item</Text>
              </TouchableOpacity>
            </View>
            <DraggablePhotoGrid
              ids={unassignedIds}
              onReorder={setUnassignedIds}
              onTap={(snapId) => toggleSelected(snapId)}
              renderPhoto={renderPhotoTile}
              renderChip={renderRoleChip}
              disabled={isSaving}
              tileWidth={TILE_WIDTH}
              tileHeight={TILE_HEIGHT}
              photoHeight={PHOTO_HEIGHT}
              innerGap={TILE_INNER_GAP}
              gap={GRID_GAP}
            />
          </View>

          {stages.map((stage, index) => (
            <View key={stage.id} style={styles.pool}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Item {index + 1}</Text>
                  <Text style={styles.sectionMeta}>
                    {stage.snapIds.length} photo{stage.snapIds.length === 1 ? '' : 's'}
                    {stagePrice(snapsWithStagedRoles, stage.snapIds, currencyCode)
                      ? ` · ${stagePrice(snapsWithStagedRoles, stage.snapIds, currencyCode)}`
                      : ''}
                  </Text>
                </View>
                <TouchableOpacity style={styles.undoButton} onPress={() => undoStage(stage.id)} disabled={isSaving}>
                  <Ionicons name="return-up-back-outline" size={17} color={colors.primary} />
                  <Text style={styles.undoText}>Undo</Text>
                </TouchableOpacity>
              </View>
              <DraggablePhotoGrid
                ids={stage.snapIds}
                onReorder={(nextIds) => setStages((current) => current.map((item) => (
                  item.id === stage.id ? { ...item, snapIds: nextIds } : item
                )))}
                renderPhoto={renderPhotoTile}
                renderChip={renderRoleChip}
                disabled={isSaving}
                tileWidth={TILE_WIDTH}
                tileHeight={TILE_HEIGHT}
                photoHeight={PHOTO_HEIGHT}
                innerGap={TILE_INNER_GAP}
                gap={GRID_GAP}
              />
            </View>
          ))}

          {saveError ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle-outline" size={17} color={colors.error} />
              <Text selectable style={styles.errorText}>{saveError}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.saveBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSaving}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={save}
            disabled={!canSave}
          >
            {isSaving ? <ActivityIndicator color={colors.primaryForeground} /> : <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />}
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: typography.weight.bold, letterSpacing: 1.5, color: colors.primary },
  title: { paddingTop: 2, fontFamily: typography.family.display, fontSize: typography.size.xxl, color: colors.foreground },
  subtitle: { paddingTop: 2, fontSize: typography.size.sm, color: colors.mutedForeground },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surfaceSubtle },
  content: { gap: spacing.md, padding: spacing.lg },
  pool: { gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.card },
  sectionHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.foreground },
  sectionMeta: { paddingTop: 2, fontSize: typography.size.xs, color: colors.mutedForeground, fontVariant: ['tabular-nums'] },
  makeButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: colors.primary },
  makeButtonDisabled: { opacity: 0.45 },
  makeText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
  undoButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radii.md, backgroundColor: colors.accent },
  undoText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primary },
  photo: { width: TILE_WIDTH, height: PHOTO_HEIGHT, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', borderRadius: radii.md, backgroundColor: colors.surfaceSubtle },
  photoSelected: { borderColor: colors.primary },
  check: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  roleChip: { minHeight: CHIP_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: radii.full, backgroundColor: colors.surfaceElevated },
  roleText: { fontSize: 10, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: '#FBEDEA' },
  errorText: { flex: 1, fontSize: typography.size.sm, lineHeight: 20, color: colors.error },
  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  cancelButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  cancelText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.secondaryForeground },
  saveButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radii.md, backgroundColor: colors.primary },
  saveButtonDisabled: { opacity: 0.45 },
  saveText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.primaryForeground },
});
