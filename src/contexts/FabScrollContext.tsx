import { createContext, useContext, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

type FabScrollCtx = { fabCollapsed: SharedValue<number> };
const Ctx = createContext<FabScrollCtx | null>(null);

export function FabScrollProvider({ children }: { children: ReactNode }) {
  const fabCollapsed = useSharedValue(0); // 0 = expanded pill, 1 = collapsed circle
  return <Ctx.Provider value={{ fabCollapsed }}>{children}</Ctx.Provider>;
}

export function useFabScroll() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFabScroll outside FabScrollProvider');
  return ctx;
}
