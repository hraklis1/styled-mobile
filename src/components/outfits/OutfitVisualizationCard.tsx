import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useVisualizeOutfit } from '../../hooks/useOutfits';
import { resolveImageUri } from '../../lib/resolveImageUri';
import { colors, spacing, typography, radii } from '../../theme';
import type { Outfit } from '../../types/outfit';

type Props = { outfit: Outfit };

export function OutfitVisualizationCard({ outfit }: Props) {
  const visualize = useVisualizeOutfit();
  const imageUri = resolveImageUri(outfit.aiGeneratedImageUrl);

  const handleGenerate = (force = false) => visualize.mutate({ id: outfit.id, force });

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>AI Visualization</Text>
        {imageUri && !visualize.isPending && (
          <TouchableOpacity onPress={() => handleGenerate(true)} style={styles.regenButton}>
            <Ionicons name="refresh-outline" size={14} color={colors.mutedForeground} />
            <Text style={styles.regenLabel}>Regenerate</Text>
          </TouchableOpacity>
        )}
      </View>

      {visualize.isPending ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Generating flat-lay...</Text>
        </View>
      ) : visualize.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {(visualize.error as Error)?.message ?? 'Generation failed'}
          </Text>
          <TouchableOpacity onPress={() => handleGenerate(true)} style={styles.retryButton}>
            <Text style={styles.retryLabel}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" transition={200} />
      ) : (
        <TouchableOpacity style={styles.emptyBox} onPress={handleGenerate}>
          <Ionicons name="sparkles-outline" size={28} color={colors.primary} />
          <Text style={styles.emptyTitle}>Generate flat-lay</Text>
          <Text style={styles.emptySubtitle}>
            AI creates a studio-style image of your outfit pieces
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  regenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  regenLabel: {
    fontSize: typography.size.xs,
    color: colors.mutedForeground,
  },

  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.md,
  },

  loadingBox: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
  },
  loadingText: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
  },

  errorBox: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary,
    borderRadius: radii.sm,
  },
  retryLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },

  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  emptySubtitle: {
    fontSize: typography.size.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
