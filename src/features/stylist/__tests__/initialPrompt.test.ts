import { buildInitialStylistSendOptions } from '../initialPrompt';

describe('buildInitialStylistSendOptions', () => {
  it('keeps explicit advice mode with a prepared shopping photo', () => {
    expect(buildInitialStylistSendOptions({
      text: 'Should I buy this?',
      mode: 'advice',
      attachmentUri: 'file:///candidate.jpg',
      photoData: 'data:image/jpeg;base64,abc',
    })).toEqual({
      text: 'Should I buy this?',
      mode: 'advice',
      photoData: 'data:image/jpeg;base64,abc',
      attachment: { type: 'photo', label: 'Shopping find', uri: 'file:///candidate.jpg' },
    });
  });

  it('keeps explicit advice mode when image preparation falls back to metadata only', () => {
    expect(buildInitialStylistSendOptions({ text: 'Should I buy this?', mode: 'advice' })).toEqual({
      text: 'Should I buy this?',
      mode: 'advice',
    });
  });

  it('does not add a mode to existing implicit launches', () => {
    expect(buildInitialStylistSendOptions({ text: 'What should I wear?' })).toEqual({
      text: 'What should I wear?',
    });
  });
});
