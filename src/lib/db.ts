import { supabase } from './supabase'
import type { Expense, Payment } from './splits'
import type { TripLock } from './crypto'
import type { Trip } from './storage'

export interface TripRecord {
  id: string
  user_id: string
  name: string
  members: string[]
  expenses: Expense[]
  payments?: Payment[]
  created_at?: string
  currency?: string
  lock_data?: TripLock | null
}

function toTrip(record: TripRecord): Trip {
  return {
    id: record.id,
    name: record.name,
    members: record.members,
    expenses: record.expenses,
    payments: record.payments ?? [],
    createdAt: record.created_at,
    currency: record.currency ?? 'INR',
    ...(record.lock_data ? { lock: record.lock_data } : {}),
  }
}

function isTripRecord(value: unknown): value is TripRecord {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Partial<TripRecord>
  return (
    typeof r.id === 'string' &&
    typeof r.name === 'string' &&
    Array.isArray(r.members) &&
    Array.isArray(r.expenses)
  )
}

function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

// Probed once per session: older databases predate the lock_data / payments columns.
const columnSupport = new Map<string, Promise<boolean>>()

function hasColumn(column: 'lock_data' | 'payments'): Promise<boolean> {
  let probe = columnSupport.get(column)
  if (!probe) {
    probe = (async () => {
      try {
        const { error } = await supabase.from('trips').select(column).limit(1)
        return !error || !isMissingColumn(error)
      } catch {
        return true
      }
    })()
    columnSupport.set(column, probe)
  }
  return probe
}

function hasLockColumn(): Promise<boolean> {
  return hasColumn('lock_data')
}

export async function fetchTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown[]).filter(isTripRecord).map(toTrip)
}

/** Lock metadata for every cloud trip, so other devices can re-lock immediately. */
export async function fetchLockStates(
  userId: string
): Promise<{ id: string; lock: TripLock }[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('id, lock_data')
    .eq('user_id', userId)
  if (error) {
    if (isMissingColumn(error)) return []
    throw error
  }
  return ((data ?? []) as { id: string; lock_data?: TripLock | null }[])
    .filter((row): row is { id: string; lock_data: TripLock } => Boolean(row.lock_data))
    .map((row) => ({ id: row.id, lock: row.lock_data }))
}

async function upsertTrip(
  userId: string,
  trip: Trip,
  withCurrency: boolean
): Promise<void> {
  const supportsLock = await hasLockColumn()
  if (trip.lock && !supportsLock) {
    // Never upload a locked trip's shell without its lock metadata: it would
    // come back empty on the next device.
    throw new Error('trips.lock_data is missing. Run supabase/schema.sql, then sync again.')
  }
  const supportsPayments = await hasColumn('payments')

  const payload: Record<string, unknown> = {
    user_id: userId,
    id: trip.id,
    name: trip.name,
    members: trip.members,
    expenses: trip.expenses,
    created_at: trip.createdAt ?? new Date().toISOString(),
  }
  // null clears a removed lock, so only send the column when it exists.
  if (supportsLock) payload.lock_data = trip.lock ?? null
  // Payments are additive: older schemas just keep them local.
  if (supportsPayments) payload.payments = trip.payments ?? []
  if (withCurrency) payload.currency = trip.currency ?? 'INR'

  const { error } = await supabase.from('trips').upsert(payload, { onConflict: 'id' })
  if (error && withCurrency && isMissingColumn(error)) {
    // Older schema without the currency column: keep syncing the core data.
    await upsertTrip(userId, trip, false)
    return
  }
  if (error) throw error
}

export async function saveTrip(trip: Trip, userId: string): Promise<void> {
  await upsertTrip(userId, trip, true)
}

export async function deleteTripRecord(userId: string, tripId: string): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('user_id', userId)
    .eq('id', tripId)
  if (error) throw error
}

/**
 * Push local trips to the cloud and drop rows that no longer exist locally.
 * Deleting remote rows is what makes deletions stick across devices.
 *
 * A trip locked on another device must not be overwritten by a stale plaintext
 * copy from this one: such rows are skipped until they are unlocked again.
 */
export async function syncTrips(userId: string, trips: Trip[]): Promise<void> {
  let remote: { id: string; lock_data?: TripLock | null }[] = []
  const { data, error } = await supabase
    .from('trips')
    .select('id, lock_data')
    .eq('user_id', userId)
  if (error && !isMissingColumn(error)) throw error
  if (!error) {
    remote = (data ?? []) as { id: string; lock_data?: TripLock | null }[]
  } else {
    // Older schema without lock_data: ids are enough for the stale sweep.
    const fallback = await supabase.from('trips').select('id').eq('user_id', userId)
    if (fallback.error) throw fallback.error
    remote = ((fallback.data ?? []) as { id: string }[]).map((row) => ({ id: row.id }))
  }

  const lockedIds = new Set(remote.filter((row) => row.lock_data).map((row) => row.id))
  const uploadable = trips.filter(
    (trip) => !trip.cloudHidden && !(lockedIds.has(trip.id) && !trip.lock)
  )
  await Promise.all(uploadable.map((trip) => saveTrip(trip, userId)))

  // Trips hidden from the cloud keep their local copy but lose the remote row.
  const hiddenIds = trips.filter((trip) => trip.cloudHidden).map((trip) => trip.id)
  if (hiddenIds.length > 0) {
    const { error: hideError } = await supabase
      .from('trips')
      .delete()
      .eq('user_id', userId)
      .in('id', hiddenIds)
    if (hideError) throw hideError
  }

  const localIds = new Set(trips.map((trip) => trip.id))
  const staleIds = remote.map((row) => row.id).filter((id) => !localIds.has(id))

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('trips')
      .delete()
      .eq('user_id', userId)
      .in('id', staleIds)
    if (deleteError) throw deleteError
  }
}
