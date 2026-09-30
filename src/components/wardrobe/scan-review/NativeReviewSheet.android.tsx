import { useEffect, useRef } from 'react';
import { Column, ModalBottomSheet, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { fillMaxHeight } from '@expo/ui/jetpack-compose/modifiers';
import type { BottomSheetProps } from '@expo/ui';

export function NativeReviewSheet({ isPresented, onDismiss, snapPoints, children }: BottomSheetProps) {
  const ref = useRef<ModalBottomSheetRef>(null);
  const callback = useRef(onDismiss);
  callback.current = onDismiss;
  useEffect(() => {
    if (isPresented) return;
    let cancelled = false;
    void ref.current?.hide().then(() => { if (!cancelled) callback.current(); });
    return () => { cancelled = true; };
  }, [isPresented]);
  return <ModalBottomSheet ref={ref} onDismissRequest={onDismiss} skipPartiallyExpanded={snapPoints?.length === 1}>
    <Column modifiers={[fillMaxHeight()]}>{children}</Column>
  </ModalBottomSheet>;
}
