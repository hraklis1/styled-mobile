import { addDaysYmd, daysBetween, formatSpan, openLoanStatus, pastLoanRange } from '../lending';

describe('lending dates', () => {
  it('adds days across month ends', () => {
    expect(addDaysYmd('2026-01-28', 7)).toBe('2026-02-04');
    expect(daysBetween('2026-10-01', '2026-10-09')).toBe(8);
  });

  it('formats spans', () => {
    expect(formatSpan(0)).toBe('same day');
    expect(formatSpan(1)).toBe('1 day');
    expect(formatSpan(21)).toBe('3 weeks');
    expect(formatSpan(95)).toBe('3 months');
  });

  it('describes open loans relative to today', () => {
    expect(openLoanStatus({ lentAt: '2026-10-01', dueBack: null }, '2026-10-09')).toEqual({ text: 'Since Oct 1', overdue: false });
    expect(openLoanStatus({ lentAt: '2026-10-01', dueBack: '2026-10-09' }, '2026-10-09').text).toBe('Since Oct 1 · due back today');
    expect(openLoanStatus({ lentAt: '2026-10-01', dueBack: '2026-10-15' }, '2026-10-09').text).toBe('Since Oct 1 · back by Oct 15');
    expect(openLoanStatus({ lentAt: '2026-10-01', dueBack: '2026-10-06' }, '2026-10-09')).toEqual({ text: 'Since Oct 1 · 3 days overdue', overdue: true });
  });

  it('summarises a returned loan', () => {
    expect(pastLoanRange({ lentAt: '2026-10-01', returnedAt: '2026-10-09' })).toBe('Oct 1 – Oct 9 · 8 days');
  });
});
