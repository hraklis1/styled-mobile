import { sanitizeStylistResponseText } from '../stylistResponseText';

describe('sanitizeStylistResponseText', () => {
  it('extracts the human response from a raw structured reply', () => {
    expect(sanitizeStylistResponseText('{"response":"A clean, easy look.","lookName":"City Ease"}'))
      .toBe('A clean, easy look.');
  });

  it('keeps preflight copy when structured JSON was appended to it', () => {
    expect(sanitizeStylistResponseText(
      'Your casual foundation is strong, but it is not event-ready yet. {"response":"Model copy","outfit":{}}',
    )).toBe('Your casual foundation is strong, but it is not event-ready yet.');
  });

  it('hides an incomplete structured object while it is streaming', () => {
    expect(sanitizeStylistResponseText('{"response":"A partial'))
      .toBe('');
  });

  it('leaves normal stylist copy unchanged', () => {
    expect(sanitizeStylistResponseText('Pair the shirt with dark denim for an easy afternoon look.'))
      .toBe('Pair the shirt with dark denim for an easy afternoon look.');
  });
});
