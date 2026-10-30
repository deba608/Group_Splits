import type { TripLock } from './crypto'
import type { Trip } from './storage'

export interface RemoteLock {
  id: string
  lock: TripLock
}

/**
 * A lock set on another device has to reach this one even if the tab stayed
 * open. Plaintext trips whose cloud row is now locked become the same encrypted
 * shell used by `lockTrip`, so nothing readable stays in memory or storage.
 * Trips already locked, or unlocked on purpose in this session, are left alone.
 */
export function applyRemoteLocks(
  trips: Trip[],
  states: RemoteLock[],
  unlockedIds: string[] = []
): { trips: Trip[]; lockedIds: string[] } {
  if (states.length === 0) return { trips, lockedIds: [] }
  const remote = new Map(states.map((state) => [state.id, state.lock]))
  const unlocked = new Set(unlockedIds)
  const lockedIds: string[] = []

  const next = trips.map((trip) => {
    const lock = remote.get(trip.id)
    if (!lock || trip.lock || unlocked.has(trip.id)) return trip
    lockedIds.push(trip.id)
    return {
      id: trip.id,
      name: 'Locked trip',
      currency: trip.currency,
      members: [],
      expenses: [],
      payments: [],
      createdAt: trip.createdAt,
      lock,
    }
  })

  return lockedIds.length > 0 ? { trips: next, lockedIds } : { trips, lockedIds: [] }
}
