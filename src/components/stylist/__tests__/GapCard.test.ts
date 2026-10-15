import { humanizeGeneratedCopy } from '../GapCard';

describe('humanizeGeneratedCopy', () => {
  it('removes model formatting and machine identifiers from gap copy', () => {
    expect(humanizeGeneratedCopy('**navy_chino-shorts**')).toBe('Navy chino shorts');
    expect(humanizeGeneratedCopy('smart_casual')).toBe('Smart casual');
  });
});
