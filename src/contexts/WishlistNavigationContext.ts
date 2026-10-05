import { createContext } from 'react';

/** Shared by product rails without importing the modal provider and its chat tree. */
export const WishlistNavigationContext = createContext<(id: string) => void>(() => {});
