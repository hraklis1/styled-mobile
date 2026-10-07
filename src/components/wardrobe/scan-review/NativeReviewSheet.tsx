import { useEffect, useRef } from 'react';
import { BottomSheet, type BottomSheetProps } from '@expo/ui';

export function NativeReviewSheet({ fitHeight: _fitHeight, ...props }: BottomSheetProps & { fitHeight?: number }) {
  const callback = useRef(props.onDismiss);
  callback.current = props.onDismiss;
  useEffect(() => { if (!props.isPresented) callback.current(); }, [props.isPresented]);
  return <BottomSheet {...props} />;
}
