import { AppText } from '../AppText';
import { colors, typography } from '../../../theme';

describe('AppText', () => {
  it('defaults to readable body text with the primary tone', () => {
    const element = AppText({ children: 'Hello' });
    const styles = element.props.style as unknown[];

    expect(styles[0]).toEqual(typography.text.body);
    expect(styles[1]).toEqual({ color: colors.foreground });
  });

  it('selects the Newsreader face for editorial roles', () => {
    const element = AppText({ variant: 'editorialTitle', children: 'A considered look' });
    const styles = element.props.style as unknown[];

    expect(styles[0]).toMatchObject({
      fontFamily: typography.family.editorialMedium,
      fontSize: typography.text.editorialTitle.fontSize,
      lineHeight: typography.text.editorialTitle.lineHeight,
    });
  });

  it('maps tones and merges caller styles last', () => {
    const element = AppText({
      variant: 'caption',
      tone: 'action',
      style: { color: '#123456', marginTop: 8 },
      children: 'Read more',
    });
    const styles = element.props.style as unknown[];

    expect(styles[1]).toEqual({ color: colors.action });
    expect(styles[2]).toEqual({ color: '#123456', marginTop: 8 });
  });
});
