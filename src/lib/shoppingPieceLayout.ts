/**
 * Where each photo of a piece sits, in the organizer.
 *
 * The first photo is the garment as the shopper saw it on the rack, so it is
 * the hero: a tall plate on the left. The next two — usually the tag and a
 * detail — stack beside it at a third of the width. Anything past three wraps
 * into rows of three underneath, so a piece with eight photos still reads as
 * one garment with its paperwork rather than a contact sheet.
 *
 * Pure geometry, so the grid can animate a tile between the hero slot and a
 * side slot when the shopper reorders, and so it can be tested without a
 * layout pass.
 */
export type PieceFrame = { x: number; y: number; width: number; height: number };

export type PieceLayout = { frames: PieceFrame[]; height: number };

/** The hero plate is a little taller than wide: the aspect of a hanging garment. */
const HERO_ASPECT = 1.12;
/** Share of the row the side column takes. */
const SIDE_SHARE = 0.36;
/** How many photos stack beside the hero before the rest wrap underneath. */
const SIDE_SLOTS = 2;
/** Overflow rows use portrait tiles, three across. */
const OVERFLOW_COLUMNS = 3;
const OVERFLOW_ASPECT = 1.2;

export function heroPieceLayout(count: number, width: number, gap: number): PieceLayout {
  if (count <= 0 || width <= 0) return { frames: [], height: 0 };

  const sideWidth = Math.round((width - gap) * SIDE_SHARE);
  const heroWidth = width - gap - sideWidth;
  const heroHeight = Math.round(heroWidth * HERO_ASPECT);
  const frames: PieceFrame[] = [{ x: 0, y: 0, width: heroWidth, height: heroHeight }];

  const sideCount = Math.min(SIDE_SLOTS, count - 1);
  if (sideCount > 0) {
    const sideHeight = Math.round((heroHeight - gap * (sideCount - 1)) / sideCount);
    for (let index = 0; index < sideCount; index += 1) {
      frames.push({
        x: heroWidth + gap,
        y: index * (sideHeight + gap),
        width: sideWidth,
        // The last side tile absorbs rounding so the column bottoms out level
        // with the hero.
        height: index === sideCount - 1 ? heroHeight - index * (sideHeight + gap) : sideHeight,
      });
    }
  }

  let height = heroHeight;
  const overflow = count - 1 - sideCount;
  if (overflow > 0) {
    const tileWidth = Math.floor((width - gap * (OVERFLOW_COLUMNS - 1)) / OVERFLOW_COLUMNS);
    const tileHeight = Math.round(tileWidth * OVERFLOW_ASPECT);
    for (let index = 0; index < overflow; index += 1) {
      const row = Math.floor(index / OVERFLOW_COLUMNS);
      const column = index % OVERFLOW_COLUMNS;
      frames.push({
        x: column * (tileWidth + gap),
        y: heroHeight + gap + row * (tileHeight + gap),
        width: tileWidth,
        height: tileHeight,
      });
    }
    const rows = Math.ceil(overflow / OVERFLOW_COLUMNS);
    height = heroHeight + gap + rows * tileHeight + (rows - 1) * gap;
  }

  return { frames, height };
}

/**
 * The frame whose centre is nearest a point — where a dragged tile would land.
 * Called from the drag gesture on the UI thread, hence the worklet directive.
 */
export function nearestFrameIndex(frames: PieceFrame[], x: number, y: number): number {
  'worklet';
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  frames.forEach((frame, index) => {
    const dx = frame.x + frame.width / 2 - x;
    const dy = frame.y + frame.height / 2 - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}
