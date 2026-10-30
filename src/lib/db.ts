import { supabase } from './supabase'
import type { Expense } from './splits'
import type { TripLock } from './crypto'
import type { Trip } from './storage'

export interface TripRecord {
  id: string
  user_id: string
  name: string
  members: string[]
  expenses: Expense[]
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

// Probed once per session: older databases predate the lock_data column.
let lockColumnSupport: Promise<boolean> | null = null

function hasLockColumn(): Promise<boolean> {
  if (!lockColumnSupport) {
    lockColumnSupport = supabase
      .from('trips')
      .select('lock_data')
      .limit(1)
      .then(({ error }) => !error || !isMissingColumn(error))
      .catch(() => true)
  }
  return lockColumnSupport
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
 */
export async function syncTrips(userId: string, trips: Trip[]): Promise<void> {
  await Promise.all(trips.map((trip) => saveTrip(trip, userId)))

  const { data, error } = await supabase.from('trips').select('id').eq('user_id', userId)
  if (error) throw error

  const localIds = new Set(trips.map((trip) => trip.id))
  const staleIds = ((data ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((id) => !localIds.has(id))

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('trips')
      .delete()
      .eq('user_id', userId)
      .in('id', staleIds)
    if (deleteError) throw deleteError
  }
}
