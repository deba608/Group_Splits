import { describe, expect, it } from 'vitest'
import { applyRemoteLocks } from './locks'
import type { Trip } from './storage'
import type { TripLock } from './crypto'

const lock: TripLock = { v: 1, salt: 'salt', iv: 'iv', data: 'cipher' }

function trip(id: string, overrides: Partial<Trip> = {}): Trip {
  return {
    id,
    name: 'Goa Trip',
    members: ['Asha', 'Ravi'],
    expenses: [
      {
        id: 'e1',
        title: 'Cab',
        amount: 100,
        paidBy: 'Asha',
        participants: ['Asha', 'Ravi'],
        splitMode: 'equal',
      },
    ],
    payments: [{ id: 'p1', from: 'Ravi', to: 'Asha', amount: 50 }],
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('applyRemoteLocks', () => {
  it('turns a plaintext trip into the encrypted shell', () => {
    const plain = trip('a')
    const { trips, lockedIds } = applyRemoteLocks([plain], [{ id: 'a', lock }])

    expect(lockedIds).toEqual(['a'])
    expect(trips[0]).toMatchObject({
      id: 'a',
      name: 'Locked trip',
      members: [],
      expenses: [],
      payments: [],
      lock,
    })
    expect(JSON.stringify(trips[0])).not.toContain('Cab')
  })

  it('leaves trips without a remote lock untouched', () => {
    const plain = trip('a')
    const { trips, lockedIds } = applyRemoteLocks([plain], [{ id: 'b', lock }])
    expect(lockedIds).toEqual([])
    expect(trips).toEqual([plain])
  })

  it('does not touch a trip already locked here', () => {
    const sealed = trip('a', { name: 'Locked trip', members: [], expenses: [], lock })
    const { trips } = applyRemoteLocks([sealed], [{ id: 'a', lock }])
    expect(trips[0]).toBe(sealed)
  })

  it('keeps a trip unlocked on purpose in this session', () => {
    const open = trip('a', { lock })
    const { trips } = applyRemoteLocks([open], [], ['a'])
    expect(trips[0]).toBe(open)
  })

  it('returns the same array when there is nothing to do', () => {
    const trips = [trip('a')]
    const result = applyRemoteLocks(trips, [])
    expect(result.trips).toBe(trips)
    expect(result.lockedIds).toEqual([])
  })
})
