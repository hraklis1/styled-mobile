import type { StylistMode } from './types';

/** A request for affordable alternatives must override a sticky advice turn. */
export function resolveShoppingAlternativeMode(text?: string): StylistMode | undefined {
  if (!text) return undefined;
  const value = text.toLowerCase();
  if (/\b(is it worth|worth buying|should i (buy|get)|do i (really )?need)\b/.test(value)) return undefined;
  const affordable = /\b(cheaper|less expensive|more affordable|lower[- ]priced?|budget[- ]friendly)\b/.test(value);
  const request = /\b(find|show|suggest|recommend|get|shop|buy|version|alternative|option|dupe|instead)\b/.test(value);
  return affordable && request ? 'shop_list' : undefined;
}
