import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
}));

jest.mock('expo-image', () => ({
  Image: 'ExpoImage',
}));

import { CaptureStackRail } from '../CaptureStackRail';
import type { CaptureStack } from '../CaptureStackRail';

const preview = (id: string, captureGroupId: string) => ({
  id,
  shoppingSessionId: 'visit-1',
  captureGroupId,
  captureSequence: 1,
  localFileUri: `file:///${id}.jpg`,
  previewUri: null,
  captureRole: 'garment' as const,
  ocrStatus: 'complete' as const,
  syncStatus: 'pending' as const,
  storagePath: null,
  timestamp: 1,
});

function renderRail(overrides: Partial<React.ComponentProps<typeof CaptureStackRail>> = {}) {
  const stacks: CaptureStack[] = [
    { groupId: 'group-1', previews: [preview('one', 'group-1')] },
    { groupId: 'group-2', previews: [preview('two-a', 'group-2'), preview('two-b', 'group-2')] },
  ];

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <CaptureStackRail
        stacks={stacks}
        activeGroupId="group-1"
        showEmptyItem
        disabled={false}
        onSelect={jest.fn()}
        {...overrides}
      />,
    );
  });
  return renderer;
}

function railButtons(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAllByType(TouchableOpacity);
}

describe('CaptureStackRail', () => {
  beforeEach(() => {
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => undefined) as typeof cancelAnimationFrame;
  });

  it('renders multiple items with one active selection and an empty item affordance', () => {
    const renderer = renderRail();
    const buttons = railButtons(renderer);
    const labels = renderer.root.findAllByType(Text).map((node) => node.props.children);

    expect(buttons).toHaveLength(3);
    expect(buttons[0].props.accessibilityState).toEqual({ selected: true, disabled: false });
    expect(buttons[1].props.accessibilityState).toEqual({ selected: false, disabled: false });
    expect(labels).toContain('Empty');
  });

  it('marks the empty item as active when no group is selected', () => {
    const renderer = renderRail({ activeGroupId: null });
    const buttons = railButtons(renderer);

    expect(buttons[0].props.accessibilityState.selected).toBe(false);
    expect(buttons[2].props.accessibilityState.selected).toBe(true);
    expect(buttons[2].props.accessibilityLabel).toBe('New item 3, empty');
  });

  it('propagates disabled state to every item', () => {
    const renderer = renderRail({ disabled: true });
    const buttons = railButtons(renderer);

    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.props.accessibilityState.disabled)).toBe(true);
  });
});
