import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressImageToDataUrl } from '../lib/compressImage';
import { useScanTag, useUpdateItem } from './useItems';
import type { TagScanResult } from './useItems';
import type { Item } from '../types/item';

export function useTagScanner(item: Item | null) {
  const [tagResult, setTagResult] = useState<TagScanResult | null>(null);
  const [tagSelectedFields, setTagSelectedFields] = useState<Set<string>>(new Set());
  const [sourceMenuVisible, setSourceMenuVisible] = useState(false);
  const scanTag = useScanTag();
  const updateItem = useUpdateItem();

  const pickLabelPhoto = async (source: 'camera' | 'library') => {
    const pickFn = source === 'camera'
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;
    const result = await pickFn({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const { dataUrl } = await compressImageToDataUrl(result.assets[0]);
    scanTag.mutate(
      { imageData: dataUrl },
      {
        onSuccess: (data) => {
          const hasAny = data.brand || data.size || data.material || data.care;
          if (!hasAny) {
            Alert.alert('No label found', "Couldn't read any label info. Try getting closer to the tag.");
            return;
          }
          const initial = new Set<string>();
          if (data.brand) initial.add('brand');
          if (data.size) initial.add('size');
          if (data.material) initial.add('material');
          if (data.care) initial.add('care');
          setTagSelectedFields(initial);
          setTagResult(data);
        },
        onError: () => Alert.alert('Scan failed', 'Could not read the label. Please try again.'),
      }
    );
  };

  const handleScanLabel = () => {
    setSourceMenuVisible(true);
  };

  const handleApplyTagScan = () => {
    if (!tagResult || !item) return;
    const patch: Partial<Item> & { id: number } = { id: item.id };
    if (tagSelectedFields.has('brand') && tagResult.brand) patch.brand = tagResult.brand;
    if (tagSelectedFields.has('material') && tagResult.material) patch.material = tagResult.material;
    if (tagSelectedFields.has('care') && tagResult.care) patch.care = tagResult.care;
    if (tagSelectedFields.has('size') && tagResult.size) {
      const sizeTag = tagResult.size.toLowerCase();
      const existing = item.tags ?? [];
      if (!existing.includes(sizeTag)) patch.tags = [...existing, sizeTag];
    }
    updateItem.mutate(patch, {
      onSuccess: () => setTagResult(null),
      onError: () => Alert.alert('Update failed', 'Could not apply label details.'),
    });
  };

  return {
    tagResult,
    tagSelectedFields,
    setTagSelectedFields,
    sourceMenuVisible,
    dismissSourceMenu: () => setSourceMenuVisible(false),
    selectLabelSource: (source: 'camera' | 'library') => {
      setSourceMenuVisible(false);
      void pickLabelPhoto(source);
    },
    handleScanLabel,
    handleApplyTagScan,
    dismissTagResult: () => setTagResult(null),
    isScanning: scanTag.isPending,
    isApplying: updateItem.isPending,
  };
}
