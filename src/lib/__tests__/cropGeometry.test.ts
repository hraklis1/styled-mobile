import { boxToScreen, containedShare, displayBounds, iou, screenToBox } from '../cropGeometry';
import { overlapDuplicates } from '../scan-review';

describe('displayBounds', () => {
  it('letterboxes a portrait photo in a wide container', () => {
    expect(displayBounds(400, 300, 600, 900)).toEqual({ x: 100, y: 0, width: 200, height: 300 });
  });
  it('pillarboxes a landscape photo in a tall container', () => {
    expect(displayBounds(300, 400, 900, 600)).toEqual({ x: 0, y: 100, width: 300, height: 200 });
  });
});

it('round-trips a percent box through screen points', () => {
  for (const bounds of [displayBounds(400, 300, 600, 900), displayBounds(300, 400, 900, 600)]) {
    const box = { x: 12.5, y: 40, width: 30, height: 55 };
    const back = screenToBox(boxToScreen(box, bounds), bounds);
    for (const key of ['x', 'y', 'width', 'height'] as const) expect(back[key]).toBeCloseTo(box[key], 6);
  }
});

it('measures overlap', () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  expect(iou(a, a)).toBe(1);
  expect(iou(a, { x: 20, y: 20, width: 5, height: 5 })).toBe(0);
  expect(containedShare({ x: 2, y: 2, width: 4, height: 4 }, a)).toBe(1);
});

describe('overlapDuplicates', () => {
  const piece = (id: string, category: string | null, x: number, width = 40) => ({ id, category, bbox: { x, y: 10, width, height: 40 } });

  it('flags a strong repeat of the same type, keeping the earlier piece', () => {
    expect(overlapDuplicates([piece('a', 'top', 10), piece('b', 'top', 12)]).get('b')).toEqual({ of: 'a', strong: true });
  });
  it('flags a box nested inside another of the same type as strong', () => {
    expect(overlapDuplicates([piece('a', 'top', 0, 80), piece('b', 'top', 10, 20)]).get('b')?.strong).toBe(true);
  });
  it('only notes a moderate overlap', () => {
    expect(overlapDuplicates([piece('a', 'top', 10), piece('b', 'top', 30)]).get('b')).toEqual({ of: 'a', strong: false });
  });
  it('ignores different types and unknown types', () => {
    expect(overlapDuplicates([piece('a', 'top', 10), piece('b', 'bottom', 10)]).size).toBe(0);
    expect(overlapDuplicates([piece('a', null, 10), piece('b', null, 10)]).size).toBe(0);
  });
});
