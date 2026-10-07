import { BottomSheet, Group } from '@expo/ui/swift-ui';
import { frame, padding, presentationBackground, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import type { BottomSheetProps } from '@expo/ui';
import { colors, spacing } from '../../../theme';

/** Universal sheets omit the completed programmatic-dismiss callback in SDK 56. */
/** `fitHeight` sizes a short menu to its rows instead of half the screen. */
export function NativeReviewSheet({ isPresented, onDismiss, snapPoints, fitHeight, children }: BottomSheetProps & { fitHeight?: number }) {
  return <BottomSheet isPresented={isPresented} onIsPresentedChange={() => {}} onDismiss={onDismiss}>
    <Group modifiers={[
      frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      padding({ top: spacing.lg }),
      presentationDetents(fitHeight ? [{ height: fitHeight }] : snapPoints?.length === 1 ? ['large'] : ['medium', 'large']),
      presentationDragIndicator('visible'),
      presentationBackground(colors.background),
    ]}>{children}</Group>
  </BottomSheet>;
}
