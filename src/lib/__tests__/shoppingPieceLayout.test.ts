import { heroPieceLayout, nearestFrameIndex } from '../shoppingPieceLayout';

describe('heroPieceLayout', () => {
  it('gives a lone photo the hero slot', () => {
    const layout = heroPieceLayout(1, 353, 8);
    expect(layout.frames).toHaveLength(1);
    expect(layout.frames[0].x).toBe(0);
    expect(layout.frames[0].width).toBeLessThan(353);
    expect(layout.height).toBe(layout.frames[0].height);
  });

  it('stacks up to two photos beside the hero, level with its bottom', () => {
    const layout = heroPieceLayout(3, 353, 8);
    const [hero, top, bottom] = layout.frames;
    expect(top.x).toBe(hero.width + 8);
    expect(bottom.x).toBe(top.x);
    expect(top.width + hero.width + 8).toBe(353);
    expect(bottom.y + bottom.height).toBe(hero.height);
    expect(layout.height).toBe(hero.height);
  });

  it('wraps further photos into rows of three underneath', () => {
    const layout = heroPieceLayout(7, 353, 8);
    expect(layout.frames).toHaveLength(7);
    const overflow = layout.frames.slice(3);
    expect(new Set(overflow.slice(0, 3).map((frame) => frame.y)).size).toBe(1);
    expect(overflow[3].y).toBeGreaterThan(overflow[0].y);
    expect(overflow[3].x).toBe(0);
    expect(layout.height).toBe(overflow[3].y + overflow[3].height);
  });

  it('is empty for no photos', () => {
    expect(heroPieceLayout(0, 353, 8)).toEqual({ frames: [], height: 0 });
  });
});

describe('nearestFrameIndex', () => {
  it('picks the slot whose centre is closest', () => {
    const { frames } = heroPieceLayout(3, 353, 8);
    expect(nearestFrameIndex(frames, 10, 10)).toBe(0);
    expect(nearestFrameIndex(frames, 340, 10)).toBe(1);
    expect(nearestFrameIndex(frames, 340, frames[0].height - 5)).toBe(2);
  });
});
