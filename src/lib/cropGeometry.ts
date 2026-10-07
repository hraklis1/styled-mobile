/**
 * One mapping between a photo's percent boxes and the screen, shared by the
 * crop editor and the review photo's markers so the two always agree.
 *
 * Boxes are percent (0–100) of the decoded image. Every image here has been
 * through expo-image-manipulator, which bakes EXIF orientation into the
 * pixels, so the decoded size, the displayed image and `cropImage` share
 * one upright frame.
 */
export type Box = { x: number; y: number; width: number; height: number };

/** Where a `contain`-fitted image lands inside its container. */
export function displayBounds(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number) {
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { x: (containerWidth - width) / 2, y: (containerHeight - height) / 2, width, height };
}

type Bounds = ReturnType<typeof displayBounds>;

/** A percent box in screen points within the container. */
export function boxToScreen(box: Box, bounds: Bounds): Box {
  return {
    x: bounds.x + (box.x / 100) * bounds.width,
    y: bounds.y + (box.y / 100) * bounds.height,
    width: (box.width / 100) * bounds.width,
    height: (box.height / 100) * bounds.height,
  };
}

/** The inverse of `boxToScreen`. */
export function screenToBox(rect: Box, bounds: Bounds): Box {
  return {
    x: ((rect.x - bounds.x) / bounds.width) * 100,
    y: ((rect.y - bounds.y) / bounds.height) * 100,
    width: (rect.width / bounds.width) * 100,
    height: (rect.height / bounds.height) * 100,
  };
}

function overlapArea(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

/** How much of `inner` lies inside `outer`, 0–1. */
export function containedShare(inner: Box, outer: Box): number {
  const area = inner.width * inner.height;
  return area > 0 ? overlapArea(inner, outer) / area : 0;
}

export function iou(a: Box, b: Box): number {
  const overlap = overlapArea(a, b);
  const union = a.width * a.height + b.width * b.height - overlap;
  return union > 0 ? overlap / union : 0;
}
