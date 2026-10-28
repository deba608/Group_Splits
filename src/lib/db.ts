import { supabase } from './supabase'
import type { Expense } from './splits'
import type { Trip } from './storage'

export interface TripRecord {
  id: string
  user_id: string
  name: string
  members: string[]
  expenses: Expense[]
  created_at?: string
}

export async function fetchTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('id, user_id, name, members, expenses, created_at')
    .eq('user_id', userId)
  if (error) throw error
  const rows = (data ?? []) as TripRecord[]
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    members: r.members,
    expenses: r.expenses,
    createdAt: r.created_at,
  }))
}

export async function saveTrip(trip: Trip, userId: string): Promise<void> {
  const { error } = await supabase.from('trips').upsert({
    user_id: userId,
    id: trip.id,
    name: trip.name,
    members: trip.members,
    expenses: trip.expenses,
    created_at: trip.createdAt ?? new Date().toISOString(),
  })
  if (error) throw error
}

export async function saveAllTrips(userId: string, trips: Trip[]): Promise<void> {
  await Promise.all(trips.map((t) => saveTrip(t, userId)))
}
