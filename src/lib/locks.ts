import type { TripLock } from './crypto'
import type { Trip } from './storage'

export interface RemoteLock {
  id: string
  lock: TripLock
}

/**
 * Cloud wins on sign-in, with one exception: a trip locked on this device but
 * not yet in the cloud (offline lock, or a failed upload) keeps its encrypted
 * copy. Otherwise the next hydrate would replace it with stale plaintext and
 * silently drop the lock.
 */
export function mergeRemoteWithLocalLocks(remote: Trip[], local: Trip[]): Trip[] {
  const lockedLocally = new Map(
    local.filter((trip) => trip.lock).map((trip) => [trip.id, trip])
  )
  if (lockedLocally.size === 0) return remote

  const seen = new Set(remote.map((trip) => trip.id))
  const merged = remote.map((trip) => {
    const localLocked = lockedLocally.get(trip.id)
    if (localLocked && !trip.lock) return localLocked
    return trip
  })
  for (const [id, trip] of lockedLocally) {
    if (!seen.has(id)) merged.push(trip)
  }
  return merged
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
