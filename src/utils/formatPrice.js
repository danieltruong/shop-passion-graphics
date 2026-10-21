// Stripe amounts are in minor units, and the exponent is per currency (JPY has none), so the
// divisor comes from Intl rather than a hardcoded 100.

const formatters = new Map()

function formatterFor(currency) {
  const key = currency.toUpperCase()
  let fmt = formatters.get(key)
  if (!fmt) {
    // Fixed locale so output is the same on every machine: "$12.00", "€20.00", "¥1,500".
    fmt = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: key,
      currencyDisplay: 'narrowSymbol',
    })
    formatters.set(key, fmt)
  }
  return fmt
}

/** Minor units per major unit: 100 for CAD/USD/EUR, 1 for JPY. */
export function minorUnitsPerMajor(currency) {
  const { maximumFractionDigits } = formatterFor(currency).resolvedOptions()
  return 10 ** maximumFractionDigits
}

/**
 * Format a Stripe minor-unit amount, e.g. formatPrice(1200, 'CAD') -> "$12.00 CAD".
 * Bad amount or currency gives '' rather than throwing during render.
 */
export function formatPrice(amount, currency) {
  if (!Number.isFinite(amount) || typeof currency !== 'string' || !currency) return ''
  const code = currency.toUpperCase()
  try {
    return `${formatterFor(code).format(amount / minorUnitsPerMajor(code))} ${code}`
  } catch {
    return ''
  }
}
