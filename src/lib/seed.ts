import { HARSHIL_TRIP, HARSHIL_TRIP_VERSION } from '../data/harshilTrip'
import { saveTrips, type Trip } from './storage'

const SEED_FLAG = 'groupsplits.seed.harshilRishikesh.v1'
const PAYER_FIX_FLAG = `groupsplits.seed.harshilRishikesh.payers.v${HARSHIL_TRIP_VERSION}`

const EXPECTED_PAYERS = new Map(
  HARSHIL_TRIP.expenses.map((expense) => [expense.id, expense.paidBy])
)

function readFlag(key: string): boolean {
  try {
    return Boolean(localStorage.getItem(key))
  } catch {
    return false
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, 'added')
  } catch {
    // Ignore: the trip still renders from memory.
  }
}

/**
 * Sheet rows without a fill colour are Debashish's. Earlier builds credited
 * them to Akshay, so the imported trip gets the corrected payer.
 * Only rows the importer now assigns to Debashish are touched, which leaves
 * payers the user set by hand (or on coloured rows) alone.
 */
export function withSeedPayers(trip: Trip): Trip {
  if (trip.id !== HARSHIL_TRIP.id) return trip
  let changed = false
  const expenses = trip.expenses.map((expense) => {
    const payer = EXPECTED_PAYERS.get(expense.id)
    if (payer !== 'Debashish' || expense.paidBy !== 'Akshay') return expense
    changed = true
    return { ...expense, paidBy: payer }
  })
  return changed ? { ...trip, expenses } : trip
}

/**
 * Adds the imported Harshil–Rishikesh trip the first time the app runs.
 * Deleting the trip sticks: the flag stops it coming back on later loads.
 */
export function ensureSeedTrip(trips: Trip[]): Trip[] {
  const existing = trips.find((trip) => trip.id === HARSHIL_TRIP.id)

  if (existing) {
    if (readFlag(PAYER_FIX_FLAG)) return trips
    const next = trips.map(withSeedPayers)
    // A locked trip carries no expenses until it is unlocked: retry on the
    // next load instead of marking the fix done. Unlocking applies it too.
    const readable = !existing.lock || existing.expenses.length > 0
    if (readable) writeFlag(PAYER_FIX_FLAG)
    if (next.every((trip, index) => trip === trips[index])) return trips
    saveTrips(next)
    return next
  }

  if (readFlag(SEED_FLAG)) return trips

  const seeded: Trip = {
    ...HARSHIL_TRIP,
    expenses: HARSHIL_TRIP.expenses.map((expense) => ({
      ...expense,
      customShares: expense.customShares ? { ...expense.customShares } : undefined,
    })),
  }
  const next = [seeded, ...trips]
  // Persist right away: a second hydrate (auth events) reads it back instead of racing.
  saveTrips(next)
  writeFlag(SEED_FLAG)
  writeFlag(PAYER_FIX_FLAG)
  return next
}
