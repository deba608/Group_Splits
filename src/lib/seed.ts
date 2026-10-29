import { HARSHIL_TRIP } from '../data/harshilTrip'
import { saveTrips, type Trip } from './storage'

const SEED_FLAG = 'groupsplits.seed.harshilRishikesh.v1'

/**
 * Adds the imported Harshil–Rishikesh trip the first time the app runs.
 * Deleting the trip sticks: the flag stops it coming back on later loads.
 */
export function ensureSeedTrip(trips: Trip[]): Trip[] {
  if (trips.some((trip) => trip.id === HARSHIL_TRIP.id)) return trips
  try {
    if (localStorage.getItem(SEED_FLAG)) return trips
  } catch {
    // No storage access: fall through and show the trip for this session.
  }
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
  try {
    localStorage.setItem(SEED_FLAG, 'added')
  } catch {
    // Ignore: the trip still renders from memory.
  }
  return next
}
