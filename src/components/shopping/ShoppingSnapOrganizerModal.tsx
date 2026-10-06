import { Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { ShoppingPhotoOrganizer } from './ShoppingPhotoOrganizer';
import type { ShoppingSnapOrganizationUpdate } from '../../lib/shoppingSnapOrganizer';
import type { ShoppingSnap } from '../../types/shoppingSnap';

/**
 * The single-item organizer, opened from a find's lightbox. It is the same
 * component the visit review screen uses — only the scope differs, one item
 * here against a whole visit there.
 */
export function ShoppingSnapOrganizerModal({
  visible,
  snaps,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean;
  snaps: ShoppingSnap[];
  onClose: () => void;
  onSave: (updates: ShoppingSnapOrganizationUpdate[]) => Promise<void>;
  isSaving: boolean;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* A native modal sits above the app's sheet host, so it brings its own. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <ShoppingPhotoOrganizer
            snaps={snaps}
            onClose={onClose}
            onSave={onSave}
            isSaving={isSaving}
            title="Group photos"
          />
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}
