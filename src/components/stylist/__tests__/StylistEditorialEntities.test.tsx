import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { StylistInsight, StylistTagSuggestions } from '../StylistEditorialEntities';
const mockMutate = jest.fn();
const mockProfile = { stylePreference: ['classic'] };
jest.mock('../../../hooks/useProfile', () => ({ useProfile: () => ({ data: mockProfile }), useUpdateProfile: () => ({ mutateAsync: mockMutate, isPending: false }) }));
afterEach(() => { jest.clearAllMocks(); });
test('insight explanation is available on demand', () => {
  let view!: ReactTestRenderer;
  act(() => { view = create(<StylistInsight insight={{ label: 'Texture', explanation: 'Mix matte and smooth finishes.', supportingItemIds: [1] }} />); });
  const hasExplanation = () => view.root.findAllByType(Text).some(node => node.props.children === 'Mix matte and smooth finishes.');
  expect(hasExplanation()).toBe(false);
  act(() => view.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(hasExplanation()).toBe(true);
  act(() => view.unmount());
});
test('tags save only on tap, preserve existing preferences and allow retry after failure', async () => {
  mockMutate.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({});
  let view!: ReactTestRenderer;
  await act(async () => { view = create(<StylistTagSuggestions suggestion={{ tags: ['minimalist'], rationale: 'Clean shapes suit your brief.' }} />); });
  expect(mockMutate).not.toHaveBeenCalled();
  await act(async () => view.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(mockMutate).toHaveBeenCalledWith({ stylePreference: ['classic', 'minimalist'] });
  expect(view.root.findAllByType(Text).some(node => node.props.accessibilityRole === 'alert')).toBe(true);
  await act(async () => view.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress());
  expect(mockMutate).toHaveBeenCalledTimes(2);
  await act(async () => view.unmount());
});
