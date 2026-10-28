import { describe, expect, it } from 'vitest'
import { formatMoney } from './format'

describe('formatMoney', () => {
  it('formats rupees', () => {
    expect(formatMoney(500)).toBe('₹500.00')
  })

  it('uses Indian digit grouping', () => {
    expect(formatMoney(123456.5)).toBe('₹1,23,456.50')
  })

  it('handles non-finite input as zero', () => {
    expect(formatMoney(Number.NaN)).toBe('₹0.00')
  })
})
