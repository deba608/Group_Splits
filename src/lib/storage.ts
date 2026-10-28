import type { Expense } from './splits'

export interface Trip {
  id: string
  name: string
  members: string[]
  expenses: Expense[]
  createdAt?: string
}

interface AppState {
  version: 1
  trips: Trip[]
}

const STORAGE_KEY = 'groupsplits.v1'

function isExpense(value: unknown): value is Expense {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Partial<Expense>
  return (
    typeof e.id === 'string' &&
    typeof e.title === 'string' &&
    typeof e.amount === 'number' &&
    typeof e.paidBy === 'string' &&
    Array.isArray(e.participants) &&
    (e.splitMode === 'equal' || e.splitMode === 'custom') &&
    (e.date === undefined || typeof e.date === 'string')
  )
}

function isTrip(value: unknown): value is Trip {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Partial<Trip>
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    Array.isArray(t.members) &&
    Array.isArray(t.expenses) &&
    t.expenses.every(isExpense)
  )
}

export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<AppState>
    return Array.isArray(parsed.trips) ? parsed.trips.filter(isTrip) : []
  } catch {
    return []
  }
}

export function saveTrips(trips: Trip[]): void {
  try {
    const state: AppState = { version: 1, trips }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable: keep the in-memory session working.
  }
}
