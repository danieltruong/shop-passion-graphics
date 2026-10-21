import StepList from '../components/StepList'
import Window from '../components/Window'
import { IconWarning } from '../components/icons'
import { placeholders, policies } from '../content/site'
import usePageTitle from '../hooks/usePageTitle'
import './content.css'

const TITLE = 'Shipping & returns'

const COLUMNS = ['Destination', 'Method', 'Delivery time', 'Cost']

const RATES = [
  {
    destination: 'Canada',
    method: policies.carrier,
    time: placeholders.deliveryTime,
    cost: `${placeholders.shippingCost} · free over ${placeholders.freeShippingThreshold}`,
  },
  {
    destination: 'United States',
    method: policies.carrier,
    time: placeholders.deliveryTime,
    cost: placeholders.shippingCost,
  },
  {
    destination: 'Everywhere else',
    method: 'Not available yet',
    time: (
      <>
        <span aria-hidden="true">—</span>
        <span className="visually-hidden">Not available</span>
      </>
    ),
    cost: <a href={placeholders.emailHref}>Email us</a>,
  },
]

const RETURN_STEPS = [
  {
    title: 'Email us',
    text: `Send your order number to ${placeholders.email} within ${policies.returnWindowDays} days of delivery.`,
  },
  {
    title: 'Send it back',
    text: "We'll reply with the return address. Return shipping is on you, unless we made a mistake.",
  },
  {
    title: 'Get refunded',
    text: `Once it arrives, we refund your original payment method within ${policies.refundDays} business days. Your bank may take a few more days to show it.`,
  },
]

export default function ShippingPage() {
  usePageTitle(TITLE)

  return (
    <div className="content-page content-page--narrow">
      <div className="content-intro">
        <h1 className="content-title rainbow-text">{TITLE}</h1>
        <p className="content-lead">
          Every order is packed by hand and ships from {policies.shipsFrom} within{' '}
          {policies.dispatchTime}.
        </p>
      </div>

      <Window as="section" title="Shipping rates" titleAs="h2" className="shipping-rates">
        {/* Explicit roles: the stacked mobile layout sets display:block, which drops table semantics. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- keyboard users must reach the scroller */}
        <div className="shipping-table-scroll sunken" tabIndex={0} role="group" aria-label="Shipping rates table">
          <table className="shipping-table" role="table">
            <caption className="visually-hidden">Shipping rates</caption>
            <thead>
              <tr role="row">
                {COLUMNS.map((label) => (
                  <th key={label} scope="col" role="columnheader">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RATES.map((rate) => (
                <tr key={rate.destination} role="row">
                  {[rate.destination, rate.method, rate.time, rate.cost].map((value, i) => (
                    // eslint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role -- see roles note
                    <td key={COLUMNS[i]} data-label={COLUMNS[i]} role="cell">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="shipping-note">
          Shipping is calculated at checkout. US orders may owe import duties or fees on delivery,
          which are paid by the buyer.
        </p>
      </Window>

      <section className="shipping-returns" aria-labelledby="returns-title">
        <h2 id="returns-title" className="content-section-title">Returns</h2>
        <p className="content-prose">
          Changed your mind? Unused items in their original condition can be returned within{' '}
          {policies.returnWindowDays} days of delivery. {policies.returnExclusions}
        </p>
        <StepList steps={RETURN_STEPS} className="content-steps" />
      </section>

      <Window
        as="section"
        title="Damaged or lost order"
        titleAs="h2"
        icon={<IconWarning className="shipping-warning-icon" />}
        className="shipping-damaged"
      >
        <p>
          If something arrives damaged or never shows up, email{' '}
          <a href={placeholders.emailHref}>{placeholders.email}</a> with your order number (and a
          photo, if it&apos;s damaged) within {policies.damageReportDays} days of delivery. We&apos;ll
          send a replacement or a full refund, and you won&apos;t need to send anything back.
        </p>
      </Window>
    </div>
  )
}
