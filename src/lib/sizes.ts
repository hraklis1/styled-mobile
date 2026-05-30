export type AlphaSizeValue = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";
export type HatAlpha = "S" | "M" | "L" | "XL";
export type InCm = "in" | "cm";
export type ShoeRegion = "US" | "EU" | "UK";
export type RingRegion = "US" | "EU";
export type SizeProfileVariant =
  | "alpha"
  | "bottom"
  | "footwear"
  | "watch"
  | "eyewear"
  | "belt"
  | "hat"
  | "chain"
  | "ring"
  | "outerwear_formal";

export type SizeProfile =
  | {
      type: "alpha";
      alpha: AlphaSizeValue;
      neck?: number | null;
      neckUnit?: InCm;
      sleeve?: number | null;
      sleeveUnit?: InCm;
    }
  | {
      type: "outerwear_formal";
      mode: "alpha" | "numeric";
      alpha?: AlphaSizeValue;
      chest?: number | null;
      unit?: InCm;
    }
  | {
      type: "bottom";
      mode?: "alpha" | "numeric";
      waist?: number | null;
      waistUnit?: InCm;
      inseam?: number | null;
      inseamUnit?: InCm;
      alpha?: AlphaSizeValue;
    }
  | { type: "footwear"; numericSize: number; region: ShoeRegion }
  | { type: "watch"; caseDiameter: number; unit: "mm" }
  | { type: "eyewear"; lens: number; bridge: number; temple: number; unit: "mm" }
  | { type: "belt"; length: number; unit: InCm }
  | {
      type: "hat";
      mode: "circumference" | "alpha";
      circumference?: number | null;
      unit?: InCm;
      alpha?: HatAlpha;
    }
  | { type: "chain"; length: number; unit: InCm }
  | { type: "ring"; ringSize: string | number; region: RingRegion };

export const ALPHA_SIZES: AlphaSizeValue[] = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
export const HAT_ALPHA_SIZES: HatAlpha[] = ["S", "M", "L", "XL"];
export const IN_CM_UNITS: InCm[] = ["in", "cm"];
export const SHOE_REGIONS: ShoeRegion[] = ["US", "EU", "UK"];
export const RING_REGIONS: RingRegion[] = ["US", "EU"];

export const WAIST_VALUES_IN: number[] = Array.from({ length: 24 }, (_, i) => i + 24); // 24–47 in
export const WAIST_VALUES_CM: number[] = Array.from({ length: 60 }, (_, i) => i + 60); // 60–119 cm
export const INSEAM_VALUES_IN: number[] = Array.from({ length: 16 }, (_, i) => i + 24); // 24–39 in
export const INSEAM_VALUES_CM: number[] = Array.from({ length: 30 }, (_, i) => i + 60); // 60–89 cm

export const FOOTWEAR_SIZES_US: number[] = [];
for (let s = 5; s <= 15; s += 0.5) {
  FOOTWEAR_SIZES_US.push(s);
}
export const FOOTWEAR_SIZES_EU: number[] = Array.from({ length: 26 }, (_, i) => i + 35); // 35–60
export const FOOTWEAR_SIZES_UK: number[] = [];
for (let s = 3; s <= 14; s += 0.5) {
  FOOTWEAR_SIZES_UK.push(s);
}

export const US_RING_SIZES: string[] = [];
for (let s = 3; s <= 13; s += 0.5) {
  US_RING_SIZES.push(String(s));
}
export const EU_RING_SIZES: number[] = Array.from({ length: 27 }, (_, i) => i + 44); // 44–70

/**
 * Returns the correct SizeProfile variant key for a given category/subcategory/style combo,
 * or null if no size section should be shown.
 */
export function getSizeProfileType(
  category: string | null | undefined,
  subcategory: string | null | undefined,
  style: string | null | undefined,
  formalityStyles: string[] | null | undefined,
): SizeProfileVariant | null {
  const cat = (category ?? "").toLowerCase().trim();
  const sub = (subcategory ?? "").trim();
  const sty = (style ?? "").trim();
  const formal = Array.isArray(formalityStyles) ? formalityStyles : [];

  if (cat === "top") return "alpha";
  if (cat === "bottom") return "bottom";
  if (cat === "full_body") return "alpha";

  if (cat === "shoes") return "footwear";

  if (cat === "outerwear") {
    const isCoatOrBlazer = sub === "Coats" || sty === "Blazer";
    const isFormal = formal.includes("Formal");
    if (isCoatOrBlazer && isFormal) return "outerwear_formal";
    return "alpha";
  }

  if (cat === "accessory") {
    if (sub === "Belts") return "belt";
    if (sub === "Hats & Headwear") return "hat";
    if (sub === "Sunglasses") return "eyewear";
    if (sub === "Jewelry") {
      if (sty === "Ring") return "ring";
      if (sty === "Necklace" || sty === "Bracelet" || sty === "Anklet") return "chain";
      return null;
    }
    return null;
  }

  if (cat === "valuables") {
    if (sub === "Watches") return "watch";
    if (sub === "Sunglasses") return "eyewear";
    if (sub === "Fine Jewelry") return "ring";
    return null;
  }

  return null;
}

/**
 * Formats a stored SizeProfile into a human-readable display string.
 */
export function formatSizeProfile(profile: SizeProfile | null | undefined): string | null {
  if (!profile) return null;
  switch (profile.type) {
    case "alpha": {
      const parts: string[] = [profile.alpha];
      if (profile.neck != null && profile.neckUnit) parts.push(`neck ${profile.neck} ${profile.neckUnit}`);
      if (profile.sleeve != null && profile.sleeveUnit) parts.push(`sleeve ${profile.sleeve} ${profile.sleeveUnit}`);
      return parts.join(" · ");
    }
    case "outerwear_formal": {
      if (profile.mode === "alpha") return profile.alpha ?? null;
      if (profile.chest != null && profile.unit) return `${profile.chest} ${profile.unit} chest`;
      return null;
    }
    case "bottom": {
      // Mirror SizeProfileInput.renderBottom backward-compat precedence:
      // 1. Explicit mode field (new records)
      // 2. waist/inseam present → numeric (legacy records saved without mode)
      // 3. alpha present → alpha (legacy alpha records saved without mode)
      // 4. default → numeric
      let bMode: "alpha" | "numeric";
      if (profile.mode) {
        bMode = profile.mode;
      } else if (profile.waist != null || profile.inseam != null) {
        bMode = "numeric";
      } else if (profile.alpha) {
        bMode = "alpha";
      } else {
        bMode = "numeric";
      }
      if (bMode === "alpha") return profile.alpha ?? null;
      if (profile.waist != null && profile.waistUnit && profile.inseam != null && profile.inseamUnit)
        return `${profile.waist} ${profile.waistUnit} × ${profile.inseam} ${profile.inseamUnit}`;
      return null;
    }
    case "footwear":
      return `${profile.region} ${profile.numericSize}`;
    case "watch":
      return `${profile.caseDiameter} mm`;
    case "eyewear":
      return `${profile.lens}-${profile.bridge}-${profile.temple} mm`;
    case "belt":
      return `${profile.length} ${profile.unit}`;
    case "hat": {
      if (profile.mode === "circumference" && profile.circumference != null && profile.unit)
        return `${profile.circumference} ${profile.unit}`;
      return profile.alpha ?? null;
    }
    case "chain":
      return `${profile.length} ${profile.unit}`;
    case "ring":
      return `${profile.region} ${profile.ringSize}`;
    default:
      return null;
  }
}

/**
 * Best-effort parser: converts an OpenAI-returned size string into a typed SizeProfile
 * using the category/subcategory/style/formalityStyles context to select the right variant.
 * Returns null when parsing is not possible or no variant applies.
 */
export function parseSizeProfile(
  sizeStr: string | null | undefined,
  category: string | null | undefined,
  subcategory: string | null | undefined,
  style: string | null | undefined,
  formalityStyles: string[] | null | undefined,
): SizeProfile | null {
  if (!sizeStr) return null;
  const variant = getSizeProfileType(category, subcategory, style, formalityStyles);
  if (!variant) return null;

  const s = sizeStr.trim().toUpperCase();

  if (variant === "alpha" || variant === "outerwear_formal") {
    // Match a leading alpha token: "M", "XL", "L/16/33", "Large", etc.
    const alphaMap: Record<string, AlphaSizeValue> = {
      "XS": "XS", "EXTRA SMALL": "XS",
      "S": "S", "SMALL": "S",
      "M": "M", "MEDIUM": "M",
      "L": "L", "LARGE": "L",
      "XL": "XL", "EXTRA LARGE": "XL", "EXTRA-LARGE": "XL",
      "XXL": "XXL", "2XL": "XXL", "DOUBLE EXTRA LARGE": "XXL",
      "XXXL": "XXXL", "3XL": "XXXL",
    };
    // Try exact match first, then prefix before "/" or " "
    const token = s.split(/[\/\s]/)[0];
    const alpha = alphaMap[s] ?? alphaMap[token];
    if (alpha) {
      if (variant === "outerwear_formal") return { type: "outerwear_formal", mode: "alpha", alpha };
      return { type: "alpha", alpha };
    }
    // For outerwear_formal try chest measurement like "40R", "40 REGULAR", "40"
    if (variant === "outerwear_formal") {
      const chestMatch = s.match(/^(\d+\.?\d*)\s*(CM)?/);
      if (chestMatch) {
        const chest = parseFloat(chestMatch[1]);
        const unit: InCm = chestMatch[2] === "CM" ? "cm" : "in";
        if (chest >= 28 && chest <= 70) return { type: "outerwear_formal", mode: "numeric", chest, unit };
      }
    }
    return null;
  }

  if (variant === "bottom") {
    const alphaMap: Record<string, AlphaSizeValue> = {
      "XS": "XS", "EXTRA SMALL": "XS",
      "S": "S", "SMALL": "S",
      "M": "M", "MEDIUM": "M",
      "L": "L", "LARGE": "L",
      "XL": "XL", "EXTRA LARGE": "XL", "EXTRA-LARGE": "XL",
      "XXL": "XXL", "2XL": "XXL", "DOUBLE EXTRA LARGE": "XXL",
      "XXXL": "XXXL", "3XL": "XXXL",
    };
    // Try numeric waist/inseam first ("32x30", "32/30", "W32 L30", etc.)
    const m = s.match(/W?(\d{2})[Xx\/\s]+L?(\d{2})/) ?? s.match(/(\d{2})[Xx](\d{2})/);
    if (m) {
      const waist = parseInt(m[1]);
      const inseam = parseInt(m[2]);
      if (waist >= 24 && waist <= 47 && inseam >= 24 && inseam <= 39) {
        return { type: "bottom", mode: "numeric", waist, waistUnit: "in", inseam, inseamUnit: "in" };
      }
    }
    // Try metric: "80x76" cm
    const mc = s.match(/(\d{2,3})\s*X\s*(\d{2,3})\s*CM/);
    if (mc) {
      return { type: "bottom", mode: "numeric", waist: parseInt(mc[1]), waistUnit: "cm", inseam: parseInt(mc[2]), inseamUnit: "cm" };
    }
    // Try alpha size — accepted for any bottom (user may toggle to alpha mode)
    const alphaToken = s.split(/[\/\s]/)[0];
    const alphaVal = alphaMap[s] ?? alphaMap[alphaToken];
    if (alphaVal) {
      return { type: "bottom", mode: "alpha", alpha: alphaVal };
    }
    return null;
  }

  if (variant === "footwear") {
    const regionM = s.match(/^(US|EU|UK)\s*(\d+\.?\d*)/);
    if (regionM) {
      return { type: "footwear", numericSize: parseFloat(regionM[2]), region: regionM[1] as ShoeRegion };
    }
    const numM = s.match(/^(\d+\.?\d*)/);
    if (numM) {
      const n = parseFloat(numM[1]);
      if (n >= 35 && n <= 55) return { type: "footwear", numericSize: n, region: "EU" };
      if (n >= 3 && n <= 15) return { type: "footwear", numericSize: n, region: "US" };
    }
    return null;
  }

  if (variant === "watch") {
    const m = s.match(/^(\d+\.?\d*)\s*MM?/);
    if (m) {
      const d = parseFloat(m[1]);
      if (d >= 20 && d <= 60) return { type: "watch", caseDiameter: d, unit: "mm" };
    }
    const numM = s.match(/^(\d+\.?\d*)/);
    if (numM) {
      const d = parseFloat(numM[1]);
      if (d >= 20 && d <= 60) return { type: "watch", caseDiameter: d, unit: "mm" };
    }
    return null;
  }

  if (variant === "eyewear") {
    // "52-19-145" or "52x19x145"
    const m = s.match(/^(\d+)[-xX](\d+)[-xX](\d+)/);
    if (m) {
      return { type: "eyewear", lens: parseInt(m[1]), bridge: parseInt(m[2]), temple: parseInt(m[3]), unit: "mm" };
    }
    return null;
  }

  if (variant === "belt") {
    const mIn = s.match(/^(\d+\.?\d*)\s*(IN|"|INCH)/);
    if (mIn) return { type: "belt", length: parseFloat(mIn[1]), unit: "in" };
    const mCm = s.match(/^(\d+\.?\d*)\s*CM/);
    if (mCm) return { type: "belt", length: parseFloat(mCm[1]), unit: "cm" };
    const numM = s.match(/^(\d+\.?\d*)/);
    if (numM) {
      const n = parseFloat(numM[1]);
      if (n >= 20 && n <= 60) return { type: "belt", length: n, unit: "in" };
    }
    return null;
  }

  if (variant === "hat") {
    const a = (["S", "M", "L", "XL"] as HatAlpha[]).find(h => s === h);
    if (a) return { type: "hat", mode: "alpha", alpha: a };
    const mIn = s.match(/^(\d+\.?\d*)\s*(IN|"|INCH)/);
    if (mIn) return { type: "hat", mode: "circumference", circumference: parseFloat(mIn[1]), unit: "in" };
    const mCm = s.match(/^(\d+\.?\d*)\s*CM/);
    if (mCm) return { type: "hat", mode: "circumference", circumference: parseFloat(mCm[1]), unit: "cm" };
    return null;
  }

  if (variant === "chain") {
    const mIn = s.match(/^(\d+\.?\d*)\s*(IN|"|INCH)/);
    if (mIn) return { type: "chain", length: parseFloat(mIn[1]), unit: "in" };
    const mCm = s.match(/^(\d+\.?\d*)\s*CM/);
    if (mCm) return { type: "chain", length: parseFloat(mCm[1]), unit: "cm" };
    const numM = s.match(/^(\d+\.?\d*)/);
    if (numM) {
      const n = parseFloat(numM[1]);
      if (n >= 4 && n <= 40) return { type: "chain", length: n, unit: "in" };
    }
    return null;
  }

  if (variant === "ring") {
    const numM = s.match(/^(\d+\.?\d*)/);
    if (numM) {
      const n = parseFloat(numM[1]);
      if (n >= 44 && n <= 70) return { type: "ring", ringSize: String(n), region: "EU" };
      if (n >= 3 && n <= 13) return { type: "ring", ringSize: String(n), region: "US" };
    }
    return null;
  }

  return null;
}

/**
 * Returns the default sizing mode for a bottom sub-category.
 * Leggings, sweatpants, and activewear use alpha (S/M/L); everything else uses numeric (waist/inseam).
 */
export function getBottomDefaultMode(subcategory: string | null | undefined): "alpha" | "numeric" {
  const sub = (subcategory ?? "").trim();
  if (sub === "Leggings & Tights" || sub === "Sweatpants & Joggers" || sub === "Activewear Bottoms") {
    return "alpha";
  }
  return "numeric";
}

export function footwearSizesForRegion(region: ShoeRegion): number[] {
  if (region === "EU") return FOOTWEAR_SIZES_EU;
  if (region === "UK") return FOOTWEAR_SIZES_UK;
  return FOOTWEAR_SIZES_US;
}

export function ringSizesForRegion(region: RingRegion): string[] {
  if (region === "EU") return EU_RING_SIZES.map(String);
  return US_RING_SIZES;
}
