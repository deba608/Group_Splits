import { describe, it, expect } from 'vitest'
import {
  splitAmount,
  computeTripBalances,
  simplifyDebts,
  customShareSummary,
  tripTotal,
} from './splits'

describe('splitAmount', () => {
  it('splits equally', () => {
    expect(splitAmount(90, ['A', 'B', 'C'], 'equal')).toEqual({ A: 30, B: 30, C: 30 })
  })

  it('handles rounding remainder on last participant', () => {
    expect(splitAmount(10, ['A', 'B'], 'equal')).toEqual({ A: 5, B: 5 })
    expect(splitAmount(10, ['A', 'B', 'C'], 'equal')).toEqual({ A: 3.33, B: 3.33, C: 3.34 })
  })

  it('supports custom splits with remainder handling', () => {
    expect(splitAmount(100, ['A', 'B', 'C'], 'custom', { A: 50, B: 30 })).toEqual({ A: 50, B: 30, C: 20 })
    expect(splitAmount(100, ['A', 'B', 'C'], 'custom', { A: 60, B: 40 })).toEqual({ A: 60, B: 40, C: 0 })
  })

  it('returns empty shares for no participants', () => {
    expect(splitAmount(50, [], 'equal')).toEqual({})
  })
})

describe('customShareSummary', () => {
  it('reports the unassigned remainder', () => {
    expect(customShareSummary(100, ['A', 'B', 'C'], { A: 50, B: 30 })).toEqual({
      assigned: 80,
      remaining: 20,
    })
  })

  it('reports an over-assigned total as negative remainder', () => {
    expect(customShareSummary(100, ['A', 'B'], { A: 70, B: 50 })).toEqual({
      assigned: 120,
      remaining: -20,
    })
  })

  it('ignores participants left out of the shares map', () => {
    expect(customShareSummary(100, ['A', 'B'], { A: 100 })).toEqual({
      assigned: 100,
      remaining: 0,
    })
  })
})

describe('tripTotal', () => {
  it('sums expense amounts to two decimals', () => {
    expect(
      tripTotal([
        { id: '1', title: 'Hotel', amount: 90.1, paidBy: 'A', participants: ['A'], splitMode: 'equal' },
        { id: '2', title: 'Taxi', amount: 10.2, paidBy: 'B', participants: ['B'], splitMode: 'equal' },
      ])
    ).toBe(100.3)
  })

  it('returns 0 for no expenses', () => {
    expect(tripTotal([])).toBe(0)
  })
})

describe('computeTripBalances', () => {
  it('applies custom shares when computing balances', () => {
    const balances = computeTripBalances(['A', 'B'], [
      {
        id: '1',
        title: 'Hotel',
        amount: 100,
        paidBy: 'A',
        participants: ['A', 'B'],
        splitMode: 'custom',
        customShares: { A: 70, B: 30 },
      },
    ])
    expect(balances).toEqual([
      { member: 'A', balance: 30 },
      { member: 'B', balance: -30 },
    ])
  })

  it('computes net balances', () => {
    const expenses = [
      { id: '1', title: 'Hotel', amount: 90, paidBy: 'A', participants: ['A', 'B', 'C'], splitMode: 'equal' as const },
      { id: '2', title: 'Dinner', amount: 30, paidBy: 'B', participants: ['A', 'B'], splitMode: 'equal' as const },
    ]
    const balances = computeTripBalances(['A', 'B', 'C'], expenses)
    expect(balances).toEqual([
      { member: 'A', balance: 45 },
      { member: 'B', balance: -15 },
      { member: 'C', balance: -30 },
    ])
  })
})

describe('simplifyDebts', () => {
  it('settles up simple debts', () => {
    const settlements = simplifyDebts([
      { member: 'A', balance: 60 },
      { member: 'B', balance: -30 },
      { member: 'C', balance: -30 },
    ])
    expect(settlements).toEqual([
      { from: 'B', to: 'A', amount: 30 },
      { from: 'C', to: 'A', amount: 30 },
    ])
  })

  it('handles single debtor creditor pair', () => {
    const settlements = simplifyDebts([
      { member: 'A', balance: 10 },
      { member: 'B', balance: -10 },
    ])
    expect(settlements).toEqual([{ from: 'B', to: 'A', amount: 10 }])
  })
})
