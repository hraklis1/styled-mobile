export interface ClothingItemMetadata {
  name?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  color: string;
  style?: string;
  pattern?: string;
  fit?: string;
  neckline?: string;
  sleeveLength?: string;
  material: string;
  notableDetails?: string[];
}

const ZONE_MAPS: Record<number, string[]> = {
  1: ["placed in the dead center"],
  2: ["placed in the top-center", "placed in the bottom-center"],
  3: ["placed in the top-center", "placed in the bottom-left", "placed in the bottom-right"],
  4: ["placed in the top-left", "placed in the top-right", "placed in the bottom-left", "placed in the bottom-right"],
  5: ["placed in the top-left", "placed in the top-right", "placed in the dead center", "placed in the bottom-left", "placed in the bottom-right"],
  6: ["placed in the top-left", "placed in the top-center", "placed in the top-right", "placed in the bottom-left", "placed in the bottom-center", "placed in the bottom-right"],
};

const ENVIRONMENT_TAIL =
  "All items are resting perfectly flat on a seamless, soft warm beige background. " +
  "There is perfect, even spacing between each garment so absolutely nothing overlaps. " +
  "Illuminated by soft, diffused natural studio lighting casting gentle, realistic shadows beneath each item. " +
  "Minimalist, clean, high-end e-commerce editorial product photography, ultra-sharp focus, perfect composition.";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function buildCategoryHints(item: ClothingItemMetadata): string[] {
  const sub = (item.subcategory ?? "").toLowerCase();
  const cat = (item.category ?? "").toLowerCase();

  if (sub.includes("baseball") || (sub.includes("cap") && !sub.includes("bucket"))) {
    return ["curved brim, structured low crown"];
  }
  if (sub.includes("bucket")) {
    return ["soft wide floppy brim"];
  }
  if (sub.includes("beanie") || sub.includes("knit hat") || sub.includes("toque")) {
    return ["no brim, knit"];
  }
  if (cat === "shoes") {
    return ["shown as a pair, viewed from above"];
  }
  if (sub.includes("sock") || sub.includes("belt") || sub.includes("tie") || sub.includes("pocket square")) {
    return ["laid flat, small scale"];
  }
  return [];
}

function buildItemDescription(item: ClothingItemMetadata, zone: string): string {
  const garmentType = item.subcategory ?? item.name ?? "garment";
  const core = `${zone} is exactly one ${item.color} ${item.material} ${garmentType}`;

  const details: string[] = [];

  // Include name when it carries info beyond what subcategory already says (e.g. "Short Sleeve")
  if (item.name && item.subcategory && !normalize(item.name).includes(normalize(item.subcategory))) {
    details.push(item.name);
  }

  if (item.neckline) details.push(`${item.neckline}-neck`);
  if (item.pattern && item.pattern.toLowerCase() !== "solid") details.push(item.pattern);
  if (item.fit) details.push(`fit: ${item.fit}`);
  if (item.style) details.push(item.style);
  if (item.notableDetails && item.notableDetails.length > 0) details.push(item.notableDetails.join(", "));

  details.push(...buildCategoryHints(item));

  return details.length > 0 ? `${core} (${details.join(", ")})` : core;
}

export function buildTextToImageFlatLayPrompt(items: ClothingItemMetadata[]): string {
  const capped = items.slice(0, 6);
  const zones = ZONE_MAPS[capped.length] ?? [];

  const itemDescriptions = capped
    .map((item, i) => buildItemDescription(item, zones[i]))
    .join(". ");

  const middle = itemDescriptions ? `${itemDescriptions}. ` : "";

  return `A fashion flat lay photograph. Render each garment exactly as described — do not substitute or change item silhouettes or brim styles. ${middle}${ENVIRONMENT_TAIL}`;
}
