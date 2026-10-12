import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { StylistRichText } from '../StylistRichText';

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
  it('preserves paragraphs in a consistent conversational face', () => {
    const result = blocks('\nA considered **first** paragraph.\n\nA second paragraph.');
    expect(result.map(node => content(node))).toEqual(['A considered first paragraph.', 'A second paragraph.']);
    expect(StyleSheet.flatten(result[0].props.style).fontFamily).toBeUndefined();
    expect(StyleSheet.flatten(result[1].props.style).fontFamily).toBeUndefined();
  });

  it('keeps paragraphs readable after a leading bullet', () => {
    const result = blocks('- Keep this item\nThe first prose paragraph.\nA follow-up.');
    expect(content(result[0])).toBe('•Keep this item');
    expect(result[1].type).toBe(Text);
    expect(StyleSheet.flatten(result[1].props.style).fontFamily).toBeUndefined();
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

  it('renders numbered steps, section labels and italics', () => {
    const result = blocks('Lead.\n### The edit\n1. Roll the sleeves\n2) Add a *quiet* belt');
    expect(content(result[1])).toBe('The edit');
    expect((result[1].props as { accessibilityRole?: string }).accessibilityRole).toBe('header');
    expect(content(result[2])).toBe('1Roll the sleeves');
    const step = children(result[3].props.children)[1];
    const italic = children(step.props.children).find(node => content(node) === 'quiet')!;
    expect(StyleSheet.flatten(italic.props.style)).toEqual({ fontStyle: 'italic' });
  });

  it('keeps owned mentions inline with the server spacing rule', () => {
    const tree = StylistRichText({ text: 'Start with Olive jacket today.', segments: [{ text: 'Start with' }, { itemId: 7, name: 'Olive jacket' }, { text: 'today.' }] });
    const [paragraph] = children(tree.props.children);
    const parts = children(paragraph.props.children);
    const mention = parts.find(node => (node.props as { mention?: { itemId: number } }).mention)!;
    expect((mention.props as unknown as { mention: { itemId: number } }).mention.itemId).toBe(7);
    expect(parts.map(node => (node.props as { mention?: { name: string } }).mention?.name ?? content(node)).join('')).toBe('Start with Olive jacket today.');
  });
});

