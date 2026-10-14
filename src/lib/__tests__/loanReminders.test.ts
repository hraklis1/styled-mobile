import { nudgeMessage, planLoanReminders, type LoanForReminder } from '../loanReminders';

const loan = (over: Partial<LoanForReminder>): LoanForReminder => ({
  loanId: 1, itemName: 'Wool Coat', contactName: 'Maya Lee', note: null, lentAt: '2026-10-01', dueBack: null, ...over,
});

describe('planLoanReminders', () => {
  it('schedules the back-by day and one follow-up three days later', () => {
    const plan = planLoanReminders([loan({ dueBack: '2026-10-20' })], '2026-10-13');
    expect(plan.map((r) => [r.kind, r.day])).toEqual([['due', '2026-10-20'], ['overdue', '2026-10-23']]);
    expect(plan[0].title).toBe('Wool Coat is due back today');
    expect(plan[0].body).toBe('Maya Lee has it. A quick nudge?');
    expect(plan[1].body).toContain('still has it');
    expect(plan[0].url).toBe('styled://lent-out?nudge=1');
  });

  it('checks in a month after a loan with no back-by date', () => {
    const plan = planLoanReminders([loan({})], '2026-10-13');
    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual(expect.objectContaining({ kind: 'longOut', day: '2026-10-31' }));
    expect(plan[0].title).toBe('Wool Coat has been out a month');
  });

  it('only keeps the follow-up once the back-by day has passed, and nothing after that', () => {
    expect(planLoanReminders([loan({ dueBack: '2026-10-11' })], '2026-10-13').map((r) => r.kind)).toEqual(['overdue']);
    expect(planLoanReminders([loan({ dueBack: '2026-10-01' })], '2026-10-13')).toEqual([]);
  });

  it('shares one notification per day and kind, linking to the list', () => {
    const plan = planLoanReminders([
      loan({ loanId: 1, dueBack: '2026-10-20' }),
      loan({ loanId: 2, itemName: 'Scarf', contactName: null, dueBack: '2026-10-20' }),
    ], '2026-10-13');
    expect(plan[0].title).toBe('2 lent pieces are due back today');
    expect(plan[0].body).toBe('Wool Coat (Maya Lee), Scarf');
    expect(plan[0].url).toBe('styled://lent-out');
  });

  it('puts the note in a single-loan reminder', () => {
    const [due] = planLoanReminders([loan({ dueBack: '2026-10-20', note: 'for the wedding' })], '2026-10-13');
    expect(due.body).toBe('Maya Lee has it (for the wedding). A quick nudge?');
  });

  it('keeps the soonest ones under the cap', () => {
    const loans = Array.from({ length: 30 }, (_, i) => loan({ loanId: i, dueBack: `2026-11-${String(i + 1).padStart(2, '0')}` }));
    const plan = planLoanReminders(loans, '2026-10-13', 5);
    expect(plan).toHaveLength(5);
    expect(plan[0].day).toBe('2026-11-01');
  });
});

describe('nudgeMessage', () => {
  it('asks for one piece back by its date, first name only', () => {
    expect(nudgeMessage('Maya Lee', [{ name: 'Wool Coat', dueBack: '2026-10-20' }], '2026-10-13'))
      .toBe("Hi Maya! Just a reminder that you've got my wool coat. Could I have it back by Oct 20? Thanks!");
  });

  it('lists several pieces and says when a date has passed', () => {
    expect(nudgeMessage('Maya', [{ name: 'Wool Coat', dueBack: '2026-10-10' }, { name: 'Scarf' }], '2026-10-13'))
      .toBe("Hi Maya! Just a reminder that you've got my wool coat and my scarf. It was due back Oct 10. Could you get them back to me soon? Thanks!");
  });

  it('has no date or name to work with', () => {
    expect(nudgeMessage(null, [{ name: 'Scarf' }], '2026-10-13'))
      .toBe("Hi! Just a reminder that you've got my scarf. Could I have it back when you get a chance? Thanks!");
  });
});
