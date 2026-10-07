/**
 * Short display names for list rows: "Brown Quarter-Zip Pullover Hoodie"
 * reads as "Quarter-zip", "Cream Cotton Tote Bag" as "Cotton tote". The full
 * descriptive name stays in the data and the detail view; this is only how a
 * compact row labels it.
 */

/**
 * Garment words, most distinctive first: when a name holds two ("Quarter-Zip
 * Pullover Hoodie"), the earlier entry wins. Compounds precede their heads so
 * "crossbody bag" beats "bag".
 */
const TERMS = [
  'quarter-zip', 'half-zip', 'zip-up', 'turtleneck', 'polo shirt', 'polo',
  'crossbody bag', 'shoulder bag', 'belt bag', 'tote', 'backpack', 'clutch', 'handbag', 'bag',
  'trench coat', 'puffer jacket', 'puffer', 'parka', 'overcoat', 'blazer', 'bomber', 'jacket', 'coat', 'gilet', 'vest',
  'hoodie', 'sweatshirt', 'cardigan', 'sweater', 'jumper', 'pullover',
  't-shirt', 'tee', 'tank top', 'camisole', 'blouse', 'shirt', 'top',
  'jeans', 'chinos', 'joggers', 'sweatpants', 'leggings', 'trousers', 'pants', 'shorts', 'skirt',
  'jumpsuit', 'romper', 'overalls', 'dress', 'suit',
  // After the clothes, so a "cap sleeve dress" stays a dress.
  'baseball cap', 'bucket hat', 'beanie', 'cap', 'hat',
  'sneakers', 'trainers', 'loafers', 'boots', 'sandals', 'heels', 'mules', 'flats', 'slippers', 'oxfords', 'shoes',
  'sunglasses', 'glasses', 'watch', 'necklace', 'bracelet', 'earrings', 'ring', 'belt', 'scarf', 'gloves', 'socks', 'tie',
];

/** Kept in front of the garment word: it's what tells two totes apart. */
const MATERIALS = new Set(['canvas', 'leather', 'denim', 'suede', 'wool', 'linen', 'knit', 'cashmere', 'corduroy', 'cotton', 'silk', 'nylon']);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function shortPieceName(name: string): string {
  const full = name.trim();
  if (!full) return full;
  for (const term of TERMS) {
    // Whole words only, with an optional plural: "boot" never matches "bootcut".
    const match = new RegExp(`(?:^|[^a-z-])(${escape(term)}s?)(?![a-z-])`, 'i').exec(full);
    if (!match) continue;
    const start = match.index + match[0].length - match[1].length;
    const before = full.slice(0, start).trim().split(/\s+/).pop()?.toLocaleLowerCase() ?? '';
    const words = MATERIALS.has(before) ? `${before} ${match[1]}` : match[1];
    const lower = words.toLocaleLowerCase();
    return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
  }
  return full;
}
