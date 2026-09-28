import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';

// Preserve FlashList's generic item inference through the animation wrapper.
export const AnimatedClosetList = Animated.createAnimatedComponent(FlashList) as typeof FlashList;
