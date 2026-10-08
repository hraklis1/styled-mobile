import { act, create } from 'react-test-renderer';
import { createElement } from 'react';

import { useSelection, type Selection } from '../useSelection';

jest.mock('../../../lib/haptics', () => ({
  impactAsync: jest.fn(), selectionAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' },
}));

type Entry = { id: number };
let current: Selection<Entry>;
function Harness({ visible }: { visible: Entry[] }) {
  current = useSelection(visible);
  return null;
}

const all = [{ id: 1 }, { id: 2 }, { id: 3 }];

function mount(visible: Entry[]) {
  let renderer!: ReturnType<typeof create>;
  act(() => { renderer = create(createElement(Harness, { visible })); });
  return renderer;
}

it('enters empty from the menu and toggles pieces', () => {
  mount(all);
  act(() => current.enter());
  expect(current.active).toBe(true);
  expect(current.count).toBe(0);
  act(() => current.toggle(2));
  expect([...current.ids]).toEqual([2]);
  act(() => current.toggle(2));
  expect(current.count).toBe(0);
});

it('ignores the press that follows a long-press entry', () => {
  mount(all);
  act(() => current.enter(1));
  act(() => current.toggle(1));
  expect([...current.ids]).toEqual([1]);
  act(() => current.toggle(1));
  expect(current.count).toBe(0);
});

it('does not swallow a tap on another card after a long-press entry', () => {
  mount(all);
  act(() => current.enter(1));
  act(() => current.toggle(2));
  expect([...current.ids].sort()).toEqual([1, 2]);
});

it('selects all of the visible list and reports it', () => {
  mount(all);
  act(() => current.enter());
  act(() => current.selectAll());
  expect(current.isAllSelected).toBe(true);
  expect(current.selected).toEqual(all);
  act(() => current.clear());
  expect(current.count).toBe(0);
  expect(current.active).toBe(true);
});

it('drops ids a filter hides', () => {
  const renderer = mount(all);
  act(() => current.enter());
  act(() => current.selectAll());
  act(() => renderer.update(createElement(Harness, { visible: [all[0]] })));
  expect([...current.ids]).toEqual([1]);
  expect(current.isAllSelected).toBe(true);
});

it('exits and clears', () => {
  mount(all);
  act(() => current.enter(3));
  act(() => current.exit());
  expect(current.active).toBe(false);
  expect(current.count).toBe(0);
});
