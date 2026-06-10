import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '../../theme';

interface MenuContentProps {
  onTakePhoto: () => void;
  onFromLibrary: () => void;
  onBatchImport: () => void;
  onManual: () => void;
  onLogOutfit: () => void;
  bottomInset: number;
}

export function MenuContent({
  onTakePhoto,
  onFromLibrary,
  onBatchImport,
  onManual,
  onLogOutfit,
  bottomInset,
}: MenuContentProps) {
  return (
    <View style={[styles.container, { paddingBottom: Math.max(bottomInset, spacing.xl) }]}>
      <Text style={styles.sectionLabel}>Add to Wardrobe</Text>

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
          <Text style={styles.optionTitle}>From Library</Text>
          <Text style={styles.optionSub}>Pick from your camera roll</Text>
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

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>Log</Text>

      <TouchableOpacity style={styles.option} onPress={onLogOutfit} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Log an outfit">
        <View style={[styles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="layers-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>Log an Outfit</Text>
          <Text style={styles.optionSub}>Record what you wore today</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.border} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: -spacing.xs,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginVertical: spacing.xs,
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
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  optionSub: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
