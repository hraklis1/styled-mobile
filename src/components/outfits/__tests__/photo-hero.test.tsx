import TestRenderer, { act } from 'react-test-renderer';

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

import { PhotoHero } from '../wear-review/PhotoHero';
import { detection } from '../../../features/wear-log/__fixtures__/review';

const long = { ...detection('d0'), bbox_pct: { x: 20, y: 30, width: 40, height: 30 }, attributes: { ...detection('d0').attributes, name: 'Brown Quarter-Zip Pullover Sweatshirt' } };

describe('photo tag', () => {
  it('wraps long names instead of cutting them, and reads as opening the matcher', () => {
    const onOpen = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => { tree = TestRenderer.create(<PhotoHero uri="file:///o.jpg" width={400} height={500} detections={[long]} activeId="d0" dimmedIds={new Set()} onSelect={jest.fn()} onOpen={onOpen} />); });
    // Markers are placed once the photo's own size is known.
    act(() => tree.root.find((n) => (n.type as unknown) === 'Image').props.onLoad({ source: { width: 800, height: 1000 } }));
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

describe('marker placement', () => {
  it('keeps crowded markers at least a marker apart and on the photo', () => {
    const { markerPositions } = jest.requireActual('../../wardrobe/scan-review/MarkedPhoto');
    const box = { x: 40, y: 40, width: 20, height: 20 };
    const marks = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, box, label: id }));
    const pts: { x: number; y: number }[] = markerPositions(marks, { x: 0, y: 0, width: 300, height: 400 });
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThan(20);
    }
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(11); expect(p.x).toBeLessThanOrEqual(289);
      expect(p.y).toBeGreaterThanOrEqual(11); expect(p.y).toBeLessThanOrEqual(389);
    }
  });
});
