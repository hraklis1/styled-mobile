import * as Haptics from 'expo-haptics';

/** Feedback never gates a state change or produces an unhandled rejection. */
export function selectionFeedback() {
  void Haptics.selectionAsync().catch(() => {});
}
export function bulkFeedback() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function cropFeedback(success: boolean) {
  void Haptics.notificationAsync(success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
}
