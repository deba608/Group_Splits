import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HARSHIL_TRIP } from '../data/harshilTrip'
import { ensureSeedTrip, withSeedPayers } from './seed'
import type { Trip } from './storage'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    },
  }
}

function clonedSeed(): Trip {
  return {
    ...HARSHIL_TRIP,
    expenses: HARSHIL_TRIP.expenses.map((expense) => ({ ...expense })),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('seed trip', () => {
  it('adds the trip once and does not duplicate it', () => {
    const first = ensureSeedTrip([])
    expect(first).toHaveLength(1)
    expect(first[0].id).toBe(HARSHIL_TRIP.id)
    expect(ensureSeedTrip(first)).toBe(first)
  })

  it('keeps a deleted seed trip deleted', () => {
    ensureSeedTrip([])
    expect(ensureSeedTrip([])).toEqual([])
  })

  it('fixes Akshay payers on uncoloured rows for installs seeded earlier', () => {
    const legacy = clonedSeed()
    const row = legacy.expenses.find((expense) => expense.id === 'sheet-3')
    if (row) row.paidBy = 'Akshay'

    const [fixed] = ensureSeedTrip([legacy])
    expect(fixed.expenses.find((expense) => expense.id === 'sheet-3')?.paidBy).toBe('Debashish')
    expect(ensureSeedTrip([fixed])).toEqual([fixed])
  })

  it('leaves payers the user set by hand', () => {
    const edited = clonedSeed()
    const row = edited.expenses.find((expense) => expense.id === 'sheet-4')
    if (row) row.paidBy = 'Chinta'

    const [fixed] = ensureSeedTrip([edited])
    expect(fixed.expenses.find((expense) => expense.id === 'sheet-4')?.paidBy).toBe('Chinta')
  })

  it('applies the payer fix when a locked trip is unlocked', () => {
    const legacy = clonedSeed()
    const row = legacy.expenses.find((expense) => expense.id === 'sheet-58')
    if (row) row.paidBy = 'Akshay'

    const fixed = withSeedPayers(legacy)
    expect(fixed.expenses.find((expense) => expense.id === 'sheet-58')?.paidBy).toBe('Debashish')

    const other: Trip = { ...legacy, id: '22222222-2222-4222-8222-222222222222' }
    expect(withSeedPayers(other)).toBe(other)
  })
})
