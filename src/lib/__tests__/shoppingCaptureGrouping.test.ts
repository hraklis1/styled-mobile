import {
  AUTO_ATTACH_WINDOW_MS,
  buildRegroupUpdates,
  findPreviousCapture,
  shouldAutoAttachTag,
  type CaptureGroupingCandidate,
} from '../shoppingCaptureGrouping';

const start = Date.parse('2026-08-24T14:00:00.000Z');

function capture(overrides: Partial<CaptureGroupingCandidate> = {}): CaptureGroupingCandidate {
  return {
    id: 'capture-a',
    shoppingSessionId: 'visit-1',
    captureGroupId: 'group-a',
    captureRole: 'garment',
    captureSequence: 1,
    timestamp: start,
    ...overrides,
  };
}

describe('findPreviousCapture', () => {
  it('returns the capture taken immediately before, by time', () => {
    const captures = [
      capture({ id: 'first', captureGroupId: 'group-a', captureSequence: 1, timestamp: start }),
      capture({ id: 'second', captureGroupId: 'group-b', captureSequence: 2, timestamp: start + 5_000 }),
      capture({ id: 'third', captureGroupId: 'group-c', captureSequence: 3, timestamp: start + 9_000 }),
    ];

    expect(findPreviousCapture(captures, 'third')?.id).toBe('second');
    expect(findPreviousCapture(captures, 'second')?.id).toBe('first');
  });

  it('returns null for the earliest capture and for unknown ids', () => {
    const captures = [capture({ id: 'only' })];

    expect(findPreviousCapture(captures, 'only')).toBeNull();
    expect(findPreviousCapture(captures, 'missing')).toBeNull();
  });

  it('never crosses shopping sessions', () => {
    const captures = [
      capture({ id: 'other-visit', shoppingSessionId: 'visit-2', timestamp: start }),
      capture({ id: 'mine', shoppingSessionId: 'visit-1', timestamp: start + 1_000 }),
    ];

    expect(findPreviousCapture(captures, 'mine')).toBeNull();
  });

  it('treats a null session as its own bucket rather than a wildcard', () => {
    const captures = [
      capture({ id: 'sessionless', shoppingSessionId: null, timestamp: start }),
      capture({ id: 'in-visit', shoppingSessionId: 'visit-1', timestamp: start + 1_000 }),
    ];

    expect(findPreviousCapture(captures, 'in-visit')).toBeNull();
    expect(findPreviousCapture(captures, 'sessionless')).toBeNull();
  });
});

describe('shouldAutoAttachTag', () => {
  const garment = capture({ id: 'garment', captureGroupId: 'group-a', captureRole: 'garment' });

  it('attaches a tag shot right after a garment', () => {
    const tag = capture({
      id: 'tag',
      captureGroupId: 'group-b',
      captureRole: 'tag',
      timestamp: start + 4_000,
    });

    expect(shouldAutoAttachTag(tag, garment)).toBe(true);
  });

  it('attaches at the window boundary but not past it', () => {
    const atBoundary = capture({
      id: 'tag',
      captureGroupId: 'group-b',
      captureRole: 'tag',
      timestamp: start + AUTO_ATTACH_WINDOW_MS,
    });
    const pastBoundary = { ...atBoundary, timestamp: start + AUTO_ATTACH_WINDOW_MS + 1 };

    expect(shouldAutoAttachTag(atBoundary, garment)).toBe(true);
    expect(shouldAutoAttachTag(pastBoundary, garment)).toBe(false);
  });

  it('leaves garment and unknown captures in their own group', () => {
    const nextGarment = capture({ id: 'next', captureGroupId: 'group-b', captureRole: 'garment', timestamp: start + 2_000 });
    const unknown = capture({ id: 'unknown', captureGroupId: 'group-b', captureRole: 'unknown', timestamp: start + 2_000 });

    expect(shouldAutoAttachTag(nextGarment, garment)).toBe(false);
    expect(shouldAutoAttachTag(unknown, garment)).toBe(false);
  });

  it('does not chain a tag onto another tag', () => {
    const firstTag = capture({ id: 'tag-1', captureGroupId: 'group-a', captureRole: 'tag' });
    const secondTag = capture({
      id: 'tag-2',
      captureGroupId: 'group-b',
      captureRole: 'tag',
      timestamp: start + 2_000,
    });

    expect(shouldAutoAttachTag(secondTag, firstTag)).toBe(false);
  });

  it('is a no-op when there is no previous capture or the group already matches', () => {
    const tag = capture({ id: 'tag', captureGroupId: 'group-b', captureRole: 'tag', timestamp: start + 1_000 });

    expect(shouldAutoAttachTag(tag, null)).toBe(false);
    expect(shouldAutoAttachTag({ ...tag, captureGroupId: 'group-a' }, garment)).toBe(false);
  });
});

describe('buildRegroupUpdates', () => {
  const captures = [
    capture({ id: 'a1', captureGroupId: 'group-a', captureSequence: 1, timestamp: start }),
    capture({ id: 'a2', captureGroupId: 'group-a', captureSequence: 2, timestamp: start + 2_000 }),
    capture({
      id: 'b1',
      captureGroupId: 'group-b',
      captureRole: 'tag',
      captureSequence: 3,
      timestamp: start + 4_000,
    }),
  ];

  it('moves the capture and renumbers the destination group', () => {
    const updates = buildRegroupUpdates(captures, 'b1', 'group-a');
    const groupA = updates.filter((update) => update.captureGroupId === 'group-a');

    expect(groupA.map((update) => [update.snapId, update.captureSequence])).toEqual([
      ['a1', 1],
      ['a2', 2],
      ['b1', 3],
    ]);
    expect(groupA.every((update) => update.captureGroupStartedAt === start)).toBe(true);
  });

  it('emits nothing for the group it emptied', () => {
    const updates = buildRegroupUpdates(captures, 'b1', 'group-a');

    expect(updates.some((update) => update.captureGroupId === 'group-b')).toBe(false);
  });

  it('renumbers the source group when it still has members', () => {
    const updates = buildRegroupUpdates(captures, 'a1', 'group-b');
    const groupB = updates.filter((update) => update.captureGroupId === 'group-b');
    const groupA = updates.filter((update) => update.captureGroupId === 'group-a');

    expect(groupB.map((update) => [update.snapId, update.captureSequence])).toEqual([
      ['a1', 1],
      ['b1', 2],
    ]);
    expect(groupB.every((update) => update.captureGroupStartedAt === start)).toBe(true);
    expect(groupA).toEqual([
      {
        snapId: 'a2',
        captureGroupId: 'group-a',
        captureGroupStartedAt: start + 2_000,
        captureRole: 'garment',
        captureSequence: 1,
      },
    ]);
  });

  it('splits a capture out into a group of its own', () => {
    const updates = buildRegroupUpdates(captures, 'a2', 'group-fresh');

    expect(updates).toContainEqual({
      snapId: 'a2',
      captureGroupId: 'group-fresh',
      captureGroupStartedAt: start + 2_000,
      captureRole: 'garment',
      captureSequence: 1,
    });
    expect(updates.filter((update) => update.captureGroupId === 'group-a')).toEqual([
      {
        snapId: 'a1',
        captureGroupId: 'group-a',
        captureGroupStartedAt: start,
        captureRole: 'garment',
        captureSequence: 1,
      },
    ]);
  });

  it('preserves each capture role through the move', () => {
    const updates = buildRegroupUpdates(captures, 'b1', 'group-a');

    expect(updates.find((update) => update.snapId === 'b1')?.captureRole).toBe('tag');
  });

  it('returns nothing when the capture is unknown or already in the target group', () => {
    expect(buildRegroupUpdates(captures, 'missing', 'group-a')).toEqual([]);
    expect(buildRegroupUpdates(captures, 'a1', 'group-a')).toEqual([]);
  });
});
