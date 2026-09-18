import { shoppingSurfaces } from '../theme';

/** UI accents are curated independently of the garment's actual color swatch. */
export function shoppingAccent(color: string): { accent: string; wash: string } {
  const words = new Set(color.toLowerCase().split(/[^a-z]+/).filter(Boolean));
  if (['charcoal', 'black'].some(word => words.has(word))) return shoppingSurfaces.charcoal;
  if (['olive', 'sage', 'green'].some(word => words.has(word))) return shoppingSurfaces.olive;
  if (['stone', 'grey', 'gray'].some(word => words.has(word))) return shoppingSurfaces.stone;
  return shoppingSurfaces.olive;
}
