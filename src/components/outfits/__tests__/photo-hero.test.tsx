import TestRenderer, { act } from 'react-test-renderer';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

import { PhotoHero } from '../wear-review/PhotoHero';
import { detection } from '../../../features/wear-log/__fixtures__/review';

const long = { ...detection('d0'), bbox_pct: { x: 20, y: 30, width: 40, height: 30 }, attributes: { ...detection('d0').attributes, name: 'Brown Quarter-Zip Pullover Sweatshirt' } };

describe('photo tag', () => {
  it('wraps long names instead of cutting them, and reads as opening the matcher', () => {
    const onOpen = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(<PhotoHero uri="file:///o.jpg" width={400} height={500} detections={[long]} activeId="d0" dimmedIds={new Set()} onSelect={jest.fn()} onOpen={onOpen} />); });
    const tag = tree.root.find((n) => n.props.accessibilityLabel === 'Match Brown Quarter-Zip Pullover Sweatshirt' && typeof n.props.onPress === 'function');
    expect(tag.props.accessibilityHint).toBe('Opens the matcher');
    const name = tree.root.find((n) => (n.type as unknown) === 'Text' && n.props.children === 'Brown Quarter-Zip Pullover Sweatshirt');
    expect(name.props.numberOfLines).toBe(2);
    expect(tree.root.findAll((n) => (n.type as unknown) === 'Text' && n.props.children === 'Match')).toHaveLength(1);
    act(() => tag.props.onPress());
    expect(onOpen).toHaveBeenCalledWith('d0');
    act(() => tree.unmount());
  });
});
