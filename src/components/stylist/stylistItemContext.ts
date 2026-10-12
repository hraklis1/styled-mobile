import { createContext } from 'react';

/** Opens an owned piece from anywhere inside a stylist reply (mentions, rankings). */
export const OpenItemContext = createContext<((itemId: number) => void) | undefined>(undefined);
