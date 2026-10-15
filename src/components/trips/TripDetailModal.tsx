import { Modal } from 'react-native';
import { TripDetailView, type TripDetailViewProps } from './TripDetailView';

/**
 * The Trip screen as a full-screen modal, so it opens the same way from the
 * stylist (itself a modal) and from the Calendar without a cross-stack route.
 */
export function TripDetailModal({ tripId, onClose, ...rest }: Omit<TripDetailViewProps, 'tripId'> & { tripId: number | null }) {
  return (
    <Modal visible={tripId != null} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      {tripId != null ? <TripDetailView tripId={tripId} onClose={onClose} {...rest} /> : null}
    </Modal>
  );
}
