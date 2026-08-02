import { describe, it, expect } from 'vitest'
import { formatPrice, minorUnitsPerMajor } from '../utils/formatPrice'

describe('minorUnitsPerMajor', () => {
  it('is 100 for two-decimal currencies', () => {
    expect(minorUnitsPerMajor('CAD')).toBe(100)
    expect(minorUnitsPerMajor('USD')).toBe(100)
    expect(minorUnitsPerMajor('EUR')).toBe(100)
  })

  it('is 1 for zero-decimal currencies', () => {
    // The old `/100` made ¥1500 render as "15.00" — a 100× error.
    expect(minorUnitsPerMajor('JPY')).toBe(1)
    expect(minorUnitsPerMajor('KRW')).toBe(1)
  })

  it('is case-insensitive', () => {
    expect(minorUnitsPerMajor('jpy')).toBe(1)
  })
})

describe('formatPrice', () => {
  it('never emits a bare dollar sign next to the ISO code', () => {
    // The regression this replaces rendered the live CAD catalog as "CAD $100.00".
    const formatted = formatPrice(10000, 'CAD')
    expect(formatted).not.toMatch(/CAD\s*\$/)
    expect(formatted).toContain('100.00')
  })

  it('formats two-decimal currencies with their minor units', () => {
    expect(formatPrice(3499, 'CAD')).toContain('34.99')
    expect(formatPrice(10000, 'USD')).toContain('100.00')
    expect(formatPrice(2000, 'EUR')).toContain('20.00')
  })

  it('does not divide zero-decimal currencies', () => {
    const yen = formatPrice(1500, 'JPY')
    expect(yen).toContain('1,500')
    expect(yen).not.toContain('15.00')
  })

  it('handles zero', () => {
    expect(formatPrice(0, 'CAD')).toContain('0.00')
  })

  it('returns an empty string for non-numeric input rather than NaN', () => {
    expect(formatPrice(undefined, 'CAD')).toBe('')
    expect(formatPrice(null, 'CAD')).toBe('')
  })

  it('defaults to USD when no currency is given', () => {
    expect(formatPrice(500)).toContain('5.00')
  })
})
