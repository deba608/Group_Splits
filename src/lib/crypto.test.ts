import { describe, expect, it } from 'vitest'
import { lockTrip, openTrip, removeLock, sealTrip } from './crypto'
import type { Trip } from './storage'

const trip: Trip = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Goa Trip',
  currency: 'INR',
  members: ['Asha', 'Ravi'],
  createdAt: '2026-10-01T00:00:00.000Z',
  expenses: [
    {
      id: 'e1',
      title: 'Cab from airport',
      amount: 900,
      paidBy: 'Asha',
      participants: ['Asha', 'Ravi'],
      splitMode: 'equal',
    },
  ],
}

describe('trip lock', () => {
  it('seals the whole trip into an opaque shell', async () => {
    const { trip: locked } = await lockTrip(trip, 'trip-pass')
    expect(locked.name).toBe('Locked trip')
    expect(locked.members).toEqual([])
    expect(locked.expenses).toEqual([])
    expect(locked.lock?.v).toBe(1)
    expect(locked.lock?.data).not.toContain('Goa')
    expect(JSON.stringify(locked)).not.toContain('Cab from airport')
  })

  it('opens with the right passcode', async () => {
    const { trip: locked } = await lockTrip(trip, 'trip-pass')
    const { trip: opened } = await openTrip(locked, 'trip-pass')
    expect(opened.name).toBe('Goa Trip')
    expect(opened.members).toEqual(['Asha', 'Ravi'])
    expect(opened.expenses).toHaveLength(1)
    expect(opened.expenses[0].title).toBe('Cab from airport')
    expect(opened.lock).toBeDefined()
  })

  it('rejects a wrong passcode', async () => {
    const { trip: locked } = await lockTrip(trip, 'trip-pass')
    await expect(openTrip(locked, 'nope')).rejects.toThrow('Wrong passcode')
  })

  it('re-seals with a fresh nonce and the same key', async () => {
    const { trip: locked, key, salt } = await lockTrip(trip, 'trip-pass')
    const edited: Trip = { ...trip, name: 'Goa Trip 2027' }
    const resealed = await sealTrip(edited, key, salt)
    expect(resealed.lock?.iv).not.toBe(locked.lock?.iv)
    const { trip: opened } = await openTrip(resealed, 'trip-pass')
    expect(opened.name).toBe('Goa Trip 2027')
  })

  it('removes the lock and keeps the readable trip', async () => {
    const { trip: locked } = await lockTrip(trip, 'trip-pass')
    const { trip: opened } = await openTrip(locked, 'trip-pass')
    const clear = removeLock(opened)
    expect(clear.lock).toBeUndefined()
    expect(clear.name).toBe('Goa Trip')
  })
})
