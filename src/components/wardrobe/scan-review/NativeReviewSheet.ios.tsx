import { BottomSheet, Group } from '@expo/ui/swift-ui';
import { frame, padding, presentationBackground, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import type { BottomSheetProps } from '@expo/ui';
import { colors, spacing } from '../../../theme';

/** Universal sheets omit the completed programmatic-dismiss callback in SDK 56. */
export function NativeReviewSheet({ isPresented, onDismiss, snapPoints, children }: BottomSheetProps) {
  return <BottomSheet isPresented={isPresented} onIsPresentedChange={() => {}} onDismiss={onDismiss}>
    <Group modifiers={[
      frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
      padding({ top: spacing.lg }),
      presentationDetents(snapPoints?.length === 1 ? ['large'] : ['medium', 'large']),
      presentationDragIndicator('visible'),
      presentationBackground(colors.background),
    ]}>{children}</Group>
  </BottomSheet>;
}
