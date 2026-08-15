import { useEffect, useRef, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BoardEntryRef } from '../../hooks/useBoards';
import { useBoardPicker, BoardPickerBody, boardPickerContentStyle } from './BoardPicker';
import { colors, spacing } from '../../theme';

// Fixed snap point — dynamic sizing collapses to 0 height when the content is a
// BottomSheetScrollView, leaving the sheet invisible.
const SNAP_POINTS = ['60%'];

type Props = {
  onClose: () => void;
  /** A single reference or a batch (bulk select) to save into a board. */
  target: BoardEntryRef | BoardEntryRef[] | null;
};

// Mounted only while open by the parent (matches AddActionSheet), so it presents
// on mount and reports dismissal through onClose.
//
// Do NOT use this from inside a React Native Modal (the stylist, event detail):
// BottomSheetModalProvider lives at the app root, above those modals, so the
// sheet portals behind them and never appears. BoardPickerModal is the variant
// for those hosts.
export function SaveToBoardSheet({ onClose, target }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const picker = useBoardPicker(target, onClose);

  useEffect(() => {
    ref.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onDismiss={onClose}
    >
      <BottomSheetView style={[boardPickerContentStyle, { paddingBottom: insets.bottom + spacing.lg }]}>
        <BoardPickerBody
          picker={picker}
          onClose={onClose}
          ScrollComponent={BottomSheetScrollView}
          InputComponent={BottomSheetTextInput}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.background },
  handle: { backgroundColor: colors.border, width: 36 },
});
