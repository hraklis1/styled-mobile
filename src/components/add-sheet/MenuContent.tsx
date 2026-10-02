import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '../../theme';
import { SheetHeading, SheetRows } from '../primitives/SheetOptions';
import { MAX_PHOTOS } from '../wardrobe/BatchScanSheet';

interface MenuContentProps {
  onTakePhoto: () => void;
  onFromPhotos: () => void;
  onManual: () => void;
  bottomInset: number;
}

export function MenuContent({ onTakePhoto, onFromPhotos, onManual, bottomInset }: MenuContentProps) {
  return (
    <View style={[styles.container, { paddingBottom: Math.max(bottomInset, spacing.xl) }]}>
      <SheetHeading title="Add to your closet" />
      <SheetRows
        options={[
          { label: 'Photograph a piece', hint: 'We’ll take care of the details', icon: 'camera-outline', onPress: onTakePhoto },
          { label: 'From your photos', hint: `Up to ${MAX_PHOTOS} at once`, icon: 'images-outline', onPress: onFromPhotos },
          // A full row, not a link: on the free plan this is the main way in.
          { label: 'Enter details manually', hint: 'Name, category and colour', icon: 'create-outline', onPress: onManual },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
