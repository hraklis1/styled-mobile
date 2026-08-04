import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';

type Props = {
  /** The plain cropped photo. Always the fallback. */
  croppedImage: string | null;
  /** Background-removed version, when the server produced an acceptable one. */
  cutoutImage: string | null;
  /** True when the user has selected the cutout as this item's cover. */
  useCutout: boolean;
  onToggleCutout: () => void;
  /** Container style — callers pass their own card's thumb dimensions. */
  style?: StyleProp<ViewStyle>;
  /** Rendered on top of the thumbnail (e.g. the crop-adjust button). */
  children?: React.ReactNode;
};

/**
 * Review-step thumbnail that lets the user choose the item's initial cover.
 *
 * The server-side quality gate rejects the masks it can recognise as broken, but
 * segmentation on casual photos is inconsistent enough that some bad results get
 * through — and a person is a far better judge of "does this look like my
 * jacket" than any shape metric. This is the last line of defence, and the only
 * one that doesn't depend on model quality.
 *
 * A cutout is shown `contain`-fitted with padding (it has no background of its
 * own); the plain photo fills the frame as before.
 */
export function CutoutReviewThumb({
  croppedImage,
  cutoutImage,
  useCutout,
  onToggleCutout,
  style,
  children,
}: Props) {
  const showingCutout = !!cutoutImage && useCutout;
  const uri = showingCutout ? cutoutImage : croppedImage;

  return (
    <View style={style}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.img, showingCutout && styles.cutoutImg]}
          contentFit={showingCutout ? 'contain' : 'cover'}
          transition={150}
        />
      ) : (
        <Ionicons name="shirt-outline" size={22} color={colors.mutedForeground} />
      )}

      {!!cutoutImage && (
        <TouchableOpacity
          style={[styles.badge, showingCutout && styles.badgeActive]}
          onPress={onToggleCutout}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="switch"
          accessibilityState={{ checked: showingCutout }}
          accessibilityLabel={showingCutout
            ? 'Cover image is Cutout. Tap to use Photo.'
            : 'Cover image is Photo. Tap to use Cutout.'}
        >
          <Ionicons
            name={showingCutout ? 'cut-outline' : 'image-outline'}
            size={9}
            color={showingCutout ? colors.white : colors.foreground}
          />
          <Text style={[styles.badgeText, showingCutout && styles.badgeTextActive]}>
            {showingCutout ? 'Cutout' : 'Photo'}
          </Text>
        </TouchableOpacity>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: '100%', height: '100%' },
  // A cutout is trimmed to the garment, so the thumbnail supplies the air.
  cutoutImg: { padding: 3 },
  badge: {
    position: 'absolute',
    top: 2,
    left: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,252,247,0.92)',
  },
  badgeActive: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: typography.weight.semibold,
    color: colors.foreground,
  },
  badgeTextActive: {
    color: colors.white,
  },
});
