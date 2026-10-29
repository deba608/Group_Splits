import { describe, expect, it } from 'vitest'
import { isUuid, uid } from './id'

describe('uid', () => {
  it('returns an RFC 4122 v4 uuid', () => {
    expect(uid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('returns unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => uid()))
    expect(ids.size).toBe(50)
  })
})

describe('isUuid', () => {
  it('accepts generated ids', () => {
    expect(isUuid(uid())).toBe(true)
  })

  it('rejects legacy ids and junk', () => {
    expect(isUuid('ex66ogq2zmvs5k189')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(false)
  })
})
