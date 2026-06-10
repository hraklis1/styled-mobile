import { View, useWindowDimensions } from 'react-native';
import { SkeletonBlock } from './SkeletonLoader';
import { spacing, radii } from '../../theme';

const SIDE_PAD = spacing.lg;
const COL_GAP  = spacing.sm;
const ASPECT_RATIO = 4 / 5;

type Props = { count?: number };

export function GarmentCardSkeleton({ count = 6 }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth  = (width - SIDE_PAD * 2 - COL_GAP) / 2;
  const cardHeight = cardWidth / ASPECT_RATIO;

  return (
    <View style={{
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: COL_GAP,
      paddingHorizontal: SIDE_PAD,
      paddingTop: spacing.md,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: cardWidth, marginBottom: spacing.md }}>
          <SkeletonBlock width={cardWidth} height={cardHeight} borderRadius={radii.md} />
          <SkeletonBlock
            width={cardWidth * 0.7}
            height={12}
            borderRadius={radii.sm}
            style={{ marginTop: spacing.sm }}
          />
          <SkeletonBlock
            width={cardWidth * 0.5}
            height={10}
            borderRadius={radii.sm}
            style={{ marginTop: 4 }}
          />
        </View>
      ))}
    </View>
  );
}
