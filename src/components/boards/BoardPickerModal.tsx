import { Modal, ScrollView, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { BoardEntryRef } from '../../hooks/useBoards';
import { useBoardPicker, BoardPickerBody, boardPickerContentStyle } from './BoardPicker';
import { colors, spacing } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  target: BoardEntryRef | BoardEntryRef[] | null;
};

/**
 * The board picker for hosts that are themselves a React Native Modal — the
 * stylist chat and the event detail sheet.
 *
 * SaveToBoardSheet can't be used there: @gorhom/bottom-sheet portals into the
 * BottomSheetModalProvider mounted at App.tsx, which sits *above* those modals
 * in the tree, so the sheet renders behind them and is invisible. This mirrors
 * ItemPickerSheet, which is a plain Modal for exactly the same reason.
 */
export function BoardPickerModal({ visible, onClose, target }: Props) {
  const picker = useBoardPicker(target, onClose);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={[boardPickerContentStyle, styles.content]}>
          <BoardPickerBody
            picker={picker}
            onClose={onClose}
            ScrollComponent={ScrollView}
            InputComponent={TextInput}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.lg },
});
