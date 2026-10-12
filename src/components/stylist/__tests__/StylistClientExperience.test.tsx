import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import { StylistMemoryCard } from '../StylistMemoryCard';
import { StylistEditorialFrame } from '../StylistEditorialFrame';
import { isResponseBlock } from '../../../features/stylist/responseBlocks';
const mockMutate = jest.fn();
jest.mock('../../../hooks/useStylistMemory', () => ({ useEditStylistMemory: () => ({ mutateAsync: mockMutate, isPending: false, isError: false }) }));
afterEach(() => jest.clearAllMocks());
test('memory correction preserves draft after failure and retries without auto saving', async () => {
  mockMutate.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
  let view!: ReactTestRenderer;
  const memory = { id: 'memory:1', statement: 'Likes wool', kind: 'inferred' as const, source: 'conversation' as const, confidence: .4, occurredAt: null, sourceQuote: 'I like this wool coat' };
  await act(async () => { view = create(<StylistMemoryCard memory={memory} />); });
  expect(mockMutate).not.toHaveBeenCalled();
  const press = (label: string) => view.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0].props.onPress();
  act(() => press('Correct: Likes wool'));
  act(() => view.root.findByType(TextInput).props.onChangeText('Only soft merino'));
  await act(async () => press('Save memory correction'));
  expect(view.root.findByType(TextInput).props.value).toBe('Only soft merino');
  await act(async () => press('Save memory correction'));
  expect(mockMutate).toHaveBeenLastCalledWith({ id: 'memory:1', statement: 'Only soft merino' });
  expect(view.root.findAllByType(TextInput)).toHaveLength(0);
  act(() => view.unmount());
});
test('editorial action is local to its recommendation and only fires on tap', () => {
  const refine = jest.fn(); let view!: ReactTestRenderer;
  act(() => { view = create(<StylistEditorialFrame unit={{ version: 1, kind: 'products', origin: 'shopping', actions: [{ label: 'Compare these', prompt: 'Compare the shown shoes for walking.' }] }} onRefine={refine}><Text>Selected shoes</Text></StylistEditorialFrame>); });
  expect(refine).not.toHaveBeenCalled();
  act(() => view.root.findAll(n => n.props.accessibilityLabel === 'Compare these' && typeof n.props.onPress === 'function')[0].props.onPress());
  expect(refine).toHaveBeenCalledWith('Compare the shown shoes for walking.');
  act(() => view.unmount());
});
test('history supports old blocks and rejects unsafe editorial metadata', () => {
  expect(isResponseBlock({ type: 'text', text: 'Simple advice' })).toBe(true);
  expect(isResponseBlock({ type: 'text', text: 'Advice', editorial: { version: 1, kind: 'script', origin: 'owned', actions: [] } })).toBe(false);
  expect(isResponseBlock({ type: 'text', text: 'Advice', editorial: { version: 1, kind: 'prose', origin: 'conceptual', actions: [{ label: 'Action', prompt: null }] } })).toBe(false);
});

test('a restored checklist retains its content without requiring outfit data', () => {
  const { messageForResponseBlock } = require('../../../features/stylist/responseBlocks');
  const checklist = { title: 'Pack light', intro: 'A suggested list', entries: [{ label: 'Cotton shirts', detail: 'Two breathable options' }] };
  const block = { type: 'card', text: 'Pack light', payload: { mode: 'advice', checklist } };
  expect(isResponseBlock(block)).toBe(true);
  const message = messageForResponseBlock({ id: 'parent', role: 'assistant', text: '', responseVersion: 3 }, block, 0);
  expect(message.checklist).toEqual(checklist);
  const { StylistChecklist } = require('../StylistChecklist');
  let view!: ReactTestRenderer;
  act(() => { view = create(<StylistChecklist checklist={checklist} />); });
  expect(view.root.findAllByType(Text).some(n => n.props.children === 'Cotton shirts')).toBe(true);
  act(() => view.unmount());
});
