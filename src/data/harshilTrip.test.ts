import { describe, expect, it } from 'vitest'
import { HARSHIL_TRIP, HARSHIL_TRIP_TOTAL } from './harshilTrip'
import { splitAmount, tripTotal, round2 } from '../lib/splits'

const SHEET_TOTALS: Record<string, number> = {
  Akshay: 11702,
  Chinta: 10230,
  Debashish: 10226,
  Bibhu: 9954,
  Ashish: 10263,
  Ayush: 9375,
}

function sharesByMember() {
  const totals: Record<string, number> = Object.fromEntries(
    HARSHIL_TRIP.members.map((member) => [member, 0])
  )
  for (const expense of HARSHIL_TRIP.expenses) {
    const shares = splitAmount(
      expense.amount,
      expense.participants,
      expense.splitMode,
      expense.customShares
    )
    for (const [member, share] of Object.entries(shares)) {
      totals[member] = round2(totals[member] + share)
    }
  }
  return totals
}

describe('imported Harshil–Rishikesh trip', () => {
  it('has the six travellers from the sheet', () => {
    expect(HARSHIL_TRIP.members).toEqual(Object.keys(SHEET_TOTALS))
  })

  it('reproduces the sheet per-member totals', () => {
    expect(sharesByMember()).toEqual(SHEET_TOTALS)
  })

  it('sums every expense to its itemised shares', () => {
    for (const expense of HARSHIL_TRIP.expenses) {
      const shares = splitAmount(
        expense.amount,
        expense.participants,
        expense.splitMode,
        expense.customShares
      )
      const sum = round2(Object.values(shares).reduce((a, b) => a + b, 0))
      expect(sum, `${expense.title} (#${expense.id})`).toBe(round2(expense.amount))
    }
  })

  it('totals ₹61,750 across 72 expense rows', () => {
    expect(HARSHIL_TRIP.expenses).toHaveLength(72)
    expect(tripTotal(HARSHIL_TRIP.expenses)).toBe(HARSHIL_TRIP_TOTAL)
    expect(HARSHIL_TRIP_TOTAL).toBe(61750)
  })

  it('assigns a payer who is a trip member for every row', () => {
    for (const expense of HARSHIL_TRIP.expenses) {
      expect(HARSHIL_TRIP.members).toContain(expense.paidBy)
    }
  })

  it('credits the uncoloured sheet rows to Debashish', () => {
    for (const id of ['sheet-3', 'sheet-4', 'sheet-58', 'sheet-64', 'sheet-74']) {
      const expense = HARSHIL_TRIP.expenses.find((e) => e.id === id)
      expect(expense?.paidBy, id).toBe('Debashish')
    }
    const paidRows = HARSHIL_TRIP.expenses.filter((e) => e.paidBy === 'Debashish')
    const akshayRows = HARSHIL_TRIP.expenses.filter((e) => e.paidBy === 'Akshay')
    expect(paidRows).toHaveLength(30)
    expect(akshayRows).toHaveLength(21)
  })
})
