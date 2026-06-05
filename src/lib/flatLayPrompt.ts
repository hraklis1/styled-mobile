export interface ClothingItemMetadata {
  name?: string;
  brand?: string;
  subcategory?: string;
  color: string;
  style?: string;
  pattern?: string;
  fit?: string;
  neckline?: string;
  material: string;
  notableDetails?: string;
}

const ZONE_MAPS: Record<number, string[]> = {
  1: ["placed in the dead center"],
  2: ["placed in the top-center", "placed in the bottom-center"],
  3: ["placed in the top-center", "placed in the bottom-left", "placed in the bottom-right"],
  4: ["placed in the top-left", "placed in the top-right", "placed in the bottom-left", "placed in the bottom-right"],
  5: ["placed in the top-left", "placed in the top-right", "placed in the dead center", "placed in the bottom-left", "placed in the bottom-right"],
};

const ENVIRONMENT_TAIL =
  "All items are resting perfectly flat on a seamless, soft warm beige background. " +
  "There is perfect, even spacing between each garment so absolutely nothing overlaps. " +
  "Illuminated by soft, diffused natural studio lighting casting gentle, realistic shadows beneath each item. " +
  "Minimalist, clean, high-end e-commerce editorial product photography, ultra-sharp focus, perfect composition.";

function buildItemDescription(item: ClothingItemMetadata, zone: string): string {
  const garmentType = item.subcategory ?? item.name ?? "garment";
  const core = `${zone} is exactly one ${item.color} ${item.material} ${garmentType}`;

  const details: string[] = [
    item.neckline ? `${item.neckline}-neck` : "",
    item.pattern && item.pattern.toLowerCase() !== "solid" ? item.pattern : "",
    item.fit ? `fit: ${item.fit}` : "",
    item.style ?? "",
    item.notableDetails ?? "",
  ].filter(Boolean);

  return details.length > 0 ? `${core} (${details.join(", ")})` : core;
}

export function buildTextToImageFlatLayPrompt(items: ClothingItemMetadata[]): string {
  const capped = items.slice(0, 5);
  const zones = ZONE_MAPS[capped.length] ?? [];

  const itemDescriptions = capped
    .map((item, i) => buildItemDescription(item, zones[i]))
    .join(". ");

  const middle = itemDescriptions ? `${itemDescriptions}. ` : "";

  return `A fashion flat lay photograph. ${middle}${ENVIRONMENT_TAIL}`;
}
