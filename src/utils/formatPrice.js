/**
 * Currency formatting for Stripe amounts.
 *
 * Stripe quotes amounts in the currency's *minor unit*. That is NOT always 1/100 of the major
 * unit: JPY and KRW are zero-decimal (¥1500 is 1500 yen, not ¥15.00), and a few currencies use
 * three decimals. The previous code hardcoded `{currency} $${(price / 100).toFixed(2)}`, which
 * rendered the live CAD catalog as "CAD $100.00" and would render ¥1500 as "JPY $15.00".
 *
 * Intl.NumberFormat knows each currency's exponent and its correct symbol and placement, so we
 * derive the divisor from it rather than assuming 100.
 */

/** Cache formatters — constructing Intl.NumberFormat is comparatively expensive. */
const formatters = new Map()

function formatterFor(currency) {
  const key = currency.toUpperCase()
  let fmt = formatters.get(key)
  if (!fmt) {
    fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: key })
    formatters.set(key, fmt)
  }
  return fmt
}

/**
 * Number of minor units per major unit for a currency (100 for USD/CAD/EUR, 1 for JPY).
 * Read from Intl rather than hardcoded so we stay correct for currencies we've never sold in.
 */
export function minorUnitsPerMajor(currency) {
  const { maximumFractionDigits } = formatterFor(currency).resolvedOptions()
  return 10 ** maximumFractionDigits
}

/**
 * Format a Stripe minor-unit amount for display.
 *
 * @param {number} amount   Integer amount in minor units (e.g. 10000 for CA$100.00)
 * @param {string} currency ISO 4217 code, e.g. "CAD"
 * @returns {string} e.g. "CA$100.00"
 */
export function formatPrice(amount, currency = 'USD') {
  if (!Number.isFinite(amount)) return ''
  return formatterFor(currency).format(amount / minorUnitsPerMajor(currency))
}
