import { addDaysYmd, daysBetween, formatSpan, lentPiecesIn, lentPiecesLine, openLoanStatus, pastLoanRange, pastLoanSummary } from '../lending';

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

describe('pastLoanSummary', () => {
  it('adds the note after the range, and leaves it out when there is none', () => {
    expect(pastLoanSummary({ lentAt: '2026-10-01', returnedAt: '2026-10-09', note: 'for the wedding' }))
      .toBe(`${pastLoanRange({ lentAt: '2026-10-01', returnedAt: '2026-10-09' })} · for the wedding`);
    expect(pastLoanSummary({ lentAt: '2026-10-01', returnedAt: '2026-10-09', note: null }))
      .toBe(pastLoanRange({ lentAt: '2026-10-01', returnedAt: '2026-10-09' }));
  });
});

describe('lentPiecesIn / lentPiecesLine', () => {
  const coat = { id: 1, name: 'Wool Coat', availability: 'lent', openLoan: { id: 9, contactId: 2, contactName: 'Maya', contactRelationship: 'friend', lentAt: '2026-10-01', dueBack: null } };
  const scarf = { id: 2, name: 'Scarf', availability: 'lent', openLoan: null };
  const shirt = { id: 3, name: 'Shirt', availability: 'available' };
  const items = [coat, scarf, shirt] as unknown as import('../../types/item').Item[];

  it('picks out the planned pieces someone else has right now', () => {
    expect(lentPiecesIn([1, 3], items)).toEqual([{ id: 1, name: 'Wool Coat', contactName: 'Maya' }]);
    expect(lentPiecesIn([3], items)).toEqual([]);
    expect(lentPiecesIn(null, items)).toEqual([]);
  });

  it('says who has one piece, or how many are out', () => {
    expect(lentPiecesLine([{ name: 'Wool Coat', contactName: 'Maya' }])).toBe('Wool Coat is with Maya');
    expect(lentPiecesLine([{ name: 'Scarf', contactName: null }])).toBe('Scarf is lent out');
    expect(lentPiecesLine([{ name: 'A', contactName: null }, { name: 'B', contactName: 'Maya' }])).toBe('2 pieces are lent out');
    expect(lentPiecesLine([])).toBeNull();
  });
});
