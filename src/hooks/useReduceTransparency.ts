import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Live iOS "Reduce Transparency" setting; blurred chrome swaps to a solid tint when on. */
export function useReduceTransparency(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => { if (active) setEnabled(value); })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}
