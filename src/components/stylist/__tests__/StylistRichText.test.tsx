import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { StylistRichText } from '../StylistRichText';
import { typography } from '../../../theme';

type Element = React.ReactElement<{ children?: React.ReactNode; style?: any }>;
function children(node: React.ReactNode): Element[] {
  return React.Children.toArray(node).filter(React.isValidElement) as Element[];
}
function content(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(content).join('');
  return React.isValidElement(node) ? content((node as Element).props.children) : '';
}
function blocks(text: string, streaming = false) {
  const tree = StylistRichText({ text, streaming });
  return children(tree.props.children).flatMap(node => node.type === React.Fragment ? children(node.props.children) : [node]);
}

describe('Stylist prose hierarchy', () => {
  it('preserves paragraphs and only gives the first prose block the editorial face', () => {
    const result = blocks('\nA considered **first** paragraph.\n\nA second paragraph.');
    expect(result.map(node => content(node))).toEqual(['A considered first paragraph.', 'A second paragraph.']);
    expect(StyleSheet.flatten(result[0].props.style).fontFamily).toBe(typography.family.editorialRegular);
    expect(StyleSheet.flatten(result[1].props.style).fontFamily).toBeUndefined();
  });

  it('does not consume the lead style for a bullet before the first paragraph', () => {
    const result = blocks('- Keep this item\nThe first prose paragraph.\nA follow-up.');
    expect(content(result[0])).toBe('•Keep this item');
    expect(result[1].type).toBe(Text);
    expect(StyleSheet.flatten(result[1].props.style).fontFamily).toBe(typography.family.editorialRegular);
    expect(StyleSheet.flatten(result[2].props.style).fontFamily).toBeUndefined();
  });

  it('keeps emphasis in subsequent prose and bullets in the body face', () => {
    const result = blocks('Lead.\nA **strong** follow-up.\n- A **useful** piece');
    const emphasis = children(result[1].props.children).find(node => content(node) === 'strong')!;
    expect(StyleSheet.flatten(emphasis.props.style)).toEqual({ fontWeight: '600' });
    const bulletText = children(result[2].props.children)[1];
    const bulletEmphasis = children(bulletText.props.children).find(node => content(node) === 'useful')!;
    expect(StyleSheet.flatten(bulletEmphasis.props.style).fontFamily).toBeUndefined();
  });

  it('retains the streaming cursor and handles an empty reply', () => {
    expect(blocks('')).toHaveLength(0);
    expect(blocks('', true).map(content)).toEqual(['▍']);
  });
});
