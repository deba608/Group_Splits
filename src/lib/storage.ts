import type { Expense, Payment } from './splits'
import { isUuid, uid } from './id'
import type { TripLock } from './crypto'

export interface Trip {
  id: string
  name: string
  currency?: string
  members: string[]
  expenses: Expense[]
  /** Offline payments already made against the trip. */
  payments?: Payment[]
  /** Kept on this device only: the cloud row is deleted and not re-uploaded. */
  cloudHidden?: boolean
  createdAt?: string
  /** Present when the trip content is encrypted at rest. */
  lock?: TripLock
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
    (e.date === undefined || typeof e.date === 'string') &&
    (e.recurring === undefined ||
      (typeof e.recurring === 'object' &&
        (e.recurring.frequency === 'weekly' || e.recurring.frequency === 'monthly') &&
        Number.isFinite(e.recurring.interval) &&
        typeof e.recurring.nextDate === 'string')) &&
    (e.receipt === undefined || typeof e.receipt === 'string')
  )
}

function isPayment(value: unknown): value is Payment {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Partial<Payment>
  return (
    typeof p.id === 'string' &&
    typeof p.from === 'string' &&
    typeof p.to === 'string' &&
    typeof p.amount === 'number' &&
    Number.isFinite(p.amount) &&
    (p.date === undefined || typeof p.date === 'string') &&
    (p.note === undefined || typeof p.note === 'string')
  )
}

function isTrip(value: unknown): value is Trip {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Partial<Trip>
  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    (t.currency === undefined || typeof t.currency === 'string') &&
    Array.isArray(t.members) &&
    Array.isArray(t.expenses) &&
    t.expenses.every(isExpense) &&
    (t.cloudHidden === undefined || typeof t.cloudHidden === 'boolean') &&
    (t.payments === undefined || (Array.isArray(t.payments) && t.payments.every(isPayment))) &&
    (t.lock === undefined ||
      (typeof t.lock === 'object' &&
        t.lock !== null &&
        t.lock.v === 1 &&
        typeof t.lock.salt === 'string' &&
        typeof t.lock.iv === 'string' &&
        typeof t.lock.data === 'string'))
  )
}

export function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<AppState>
    if (!Array.isArray(parsed.trips)) return []
    // Trip ids double as cloud primary keys (uuid), so legacy local ids get upgraded.
    return parsed.trips.filter(isTrip).map((trip) =>
      isUuid(trip.id) ? trip : { ...trip, id: uid() }
    )
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
