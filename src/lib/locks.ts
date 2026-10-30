import type { TripLock } from './crypto'
import type { Trip } from './storage'

export interface RemoteLock {
  id: string
  lock: TripLock
}

/**
 * Cloud wins on sign-in, with two exceptions kept from this device:
 * - a trip locked here but not yet in the cloud (offline lock, failed upload);
 * - a trip hidden from the cloud (`cloudHidden`), which sync must not re-upload.
 * Without this the next hydrate would replace them with stale cloud data.
 */
export function mergeRemoteWithLocal(remote: Trip[], local: Trip[]): Trip[] {
  const keepLocal = new Map(
    local
      .filter((trip) => trip.lock || trip.cloudHidden)
      .map((trip) => [trip.id, trip])
  )
  if (keepLocal.size === 0) return remote

  const seen = new Set(remote.map((trip) => trip.id))
  const merged = remote.map((trip) => {
    const localCopy = keepLocal.get(trip.id)
    if (!localCopy) return trip
    if (localCopy.cloudHidden) return localCopy
    if (localCopy.lock && !trip.lock) return localCopy
    return trip
  })
  for (const [id, trip] of keepLocal) {
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
