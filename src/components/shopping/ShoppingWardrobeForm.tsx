import { StatusBar } from 'expo-status-bar';
import { useReducedMotion } from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useShoppingOfflineStore } from '../../stores/useShoppingOfflineStore';
import { parseShoppingAmount } from '../../lib/shoppingPrices';
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useQueryClient } from '@tanstack/react-query';
import { useShoppingItemActions } from '../../hooks/useShoppingItemActions';
import { api } from '../../lib/api';
import {
  ITEM_CATEGORIES,
  type Item,
  type ItemCategory,
} from '../../types/item';
import type { ShoppingEditItem } from '../../lib/shoppingGallery';
import { OptionChips } from '../primitives/EditAtoms';
import { colors, typography } from '../../theme';
import { track } from '../../lib/analytics';
import { validateShoppingPatch } from '../../lib/shoppingCatalog';

export function ShoppingWardrobeForm({
  item,
  onClose,
  onSaved,
}: {
  item: ShoppingEditItem;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const { user } = useAuth();
  const [draftUserId] = useState(user?.id);
  const [restored] = useState(
    () =>
      useShoppingOfflineStore.getState().accounts[user?.id ?? '']
        ?.wardrobeDrafts?.[item.captureGroupId],
  );
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const qc = useQueryClient();
  const { saveCatalog } = useShoppingItemActions();
  const [draft, setDraft] = useState({
    name: item.productName ?? item.category ?? '',
    brand: item.brand ?? '',
    color: item.colorLabel ?? '',
    material: item.materialLabel ?? '',
    size: item.sizeLabel ?? '',
    notes: item.notes ?? '',
    price: item.extractedPrice?.toString() ?? '',
    currency: item.currencyCode ?? '',
    store: item.storeName ?? '',
    ...restored?.fields,
  });
  const [category, setCategory] = useState<ItemCategory | ''>(
    restored?.category
      ? (restored.category as ItemCategory)
      : ITEM_CATEGORIES.includes(item.category as ItemCategory)
        ? (item.category as ItemCategory)
        : '',
  );
  useEffect(() => {
    if (user && user.id === draftUserId)
      useShoppingOfflineStore
        .getState()
        .wardrobeDraft(user.id, item.captureGroupId, {
          fields: draft,
          category,
        });
  }, [user, draftUserId, item.captureGroupId, draft, category]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (saving || !user || user.id !== draftUserId) return;
    if (!draft.name.trim() || !category) {
      setError('Add a name and choose a category.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const price = draft.price.trim()
        ? (parseShoppingAmount(draft.price) ?? NaN)
        : null;
      validateShoppingPatch({
        priceOverride: price,
        currencyCode: draft.currency || null,
      });
      const photo = await manipulateAsync(
        (item.primarySnap.captureRole === 'tag'
          ? (item.snaps.find((snap) => snap.captureRole === 'garment') ??
            item.primarySnap)
          : item.primarySnap
        ).imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.85, format: SaveFormat.JPEG, base64: true },
      );
      const { data } = await api.post<Item>(
        '/api/items',
        {
          name: draft.name.trim(),
          category,
          brand: draft.brand || null,
          color: draft.color || null,
          material: draft.material || null,
          notes:
            [draft.notes, draft.size ? `Size: ${draft.size}` : '']
              .filter(Boolean)
              .join('\n') || null,
          size: draft.size || null,
          purchasePrice: price,
          purchaseCurrency: draft.currency || null,
          purchaseLocation: draft.store || null,
          sourceShoppingFindId: item.captureGroupId,
          shoppingImageData: `data:image/jpeg;base64,${photo.base64}`,
          needsDetails: true,
        },
        {
          headers: { 'Idempotency-Key': `shopping-${item.captureGroupId}` },
          timeout: 60000,
        },
      );
      await saveCatalog(item.captureGroupId, { wardrobeItemId: data.id });
      void qc.invalidateQueries({ queryKey: ['items'] });
      track('shopping_wardrobe_added', { has_price: price !== null });
      if (user)
        useShoppingOfflineStore
          .getState()
          .wardrobeDraft(user.id, item.captureGroupId, null);
      onSaved(data.id);
    } catch (failure) {
      const message = (
        failure as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      setError(
        message ??
          'Could not add to your wardrobe. Your purchase is still saved; reconnect and try again.',
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: 24,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          gap: 16,
        }}
      >
        <Text
          style={{
            ...typography.text.editorialTitle,
            color: colors.foreground,
          }}
        >
          Add to wardrobe
        </Text>
        <Text
          style={{ ...typography.text.body, color: colors.mutedForeground }}
        >
          Review your piece. Your original shopping photos will stay in your
          shortlist.
        </Text>
        {Object.entries(draft).map(([key, value]) => (
          <View key={key} style={{ gap: 4 }}>
            <Text
              style={{ ...typography.text.label, color: colors.foreground }}
            >
              {key === 'price'
                ? 'Purchase price'
                : key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
            <TextInput
              accessibilityLabel={key}
              value={value}
              onChangeText={(text) =>
                setDraft((current) => ({
                  ...current,
                  [key]: key === 'currency' ? text.toUpperCase() : text,
                }))
              }
              editable={!saving}
              multiline={key === 'notes'}
              style={{
                minHeight: 44,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                color: colors.foreground,
              }}
            />
          </View>
        ))}
        <Text style={{ ...typography.text.label, color: colors.foreground }}>
          Category
        </Text>
        <OptionChips
          options={ITEM_CATEGORIES.map((value) => ({
            value,
            label: value.replace('_', ' '),
          }))}
          value={category}
          onSelect={(value) => setCategory(value as ItemCategory)}
        />
        {error ? (
          <Text selectable style={{ color: colors.error }}>
            {error}
          </Text>
        ) : null}
        <TouchableOpacity
          disabled={saving}
          onPress={() => void save()}
          style={{
            minHeight: 48,
            backgroundColor: colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 8,
          }}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={{ color: colors.primaryForeground }}>
              Add to wardrobe
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          disabled={saving}
          onPress={onClose}
          style={{
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.foreground }}>Later</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}
