import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

interface MenuContentProps {
  onTakePhoto: () => void;
  onFromLibrary: () => void;
  onBatchImport: () => void;
  onManual: () => void;
  bottomInset: number;
}

export function MenuContent({
  onTakePhoto,
  onFromLibrary,
  onBatchImport,
  onManual,
  bottomInset,
}: MenuContentProps) {
  return (
    <View style={[styles.container, { paddingBottom: Math.max(bottomInset, spacing.xl) }]}>
      <Text style={styles.sectionLabel}>Choose how to add</Text>

      <TouchableOpacity style={styles.option} onPress={onTakePhoto} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Take photo to add item">
        <View style={[styles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Take Photo</Text>
          <Text style={styles.optionSub}>Snap your item — AI fills in the details</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={onFromLibrary} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Import from photo library">
        <View style={[styles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="image-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Choose from Photos</Text>
          <Text style={styles.optionSub}>Pick a photo from your camera roll</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={onBatchImport} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Batch import up to 10 photos">
        <View style={[styles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="images-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Batch Import</Text>
          <Text style={styles.optionSub}>Scan up to 10 photos at once</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={onManual} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Enter item manually">
        <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
          <Ionicons name="pencil-outline" size={22} color={colors.mutedForeground} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Enter Manually</Text>
          <Text style={styles.optionSub}>Type the name, category, and colour</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  sectionLabel: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: typography.tracking.wide,
    marginBottom: -spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  optionSub: {
    fontSize: typography.text.bodySmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
