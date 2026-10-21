import { Link, useSearchParams } from 'react-router'
import Button from '../components/Button'
import StepList from '../components/StepList'
import Window from '../components/Window'
import { IconFrog } from '../components/icons'
import { placeholders, policies } from '../content/site'
import usePageTitle from '../hooks/usePageTitle'
import './status.css'

const STEPS = [
  { title: 'Order received', text: 'Payment confirmed.' },
  { title: 'Packed & shipped', text: `Within ${policies.dispatchTime}. You'll get tracking by email.` },
  {
    title: 'Delivered',
    text: (
      <>
        Depends on where you are. <Link to="/shipping">See delivery times</Link>.
      </>
    ),
  },
]

// Display only, not proof of payment: session_id comes from the URL and is forgeable.
// Fulfilment must come from a checkout.session.completed webhook.
export default function SuccessPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  usePageTitle('Thank you')

  return (
    <div className="status">
      <div className="status__hero">
        <IconFrog size={110} />
        <h1 className="status__title rainbow-text">Thank you!</h1>
        <p className="status__lead">Your order is in. A receipt from Stripe is on its way to your email.</p>
      </div>

      <Window as="section" titleAs="h2" title={`Order ${placeholders.orderNumber}`}>
        <div className="status__order">
          {sessionId && (
            <p className="status__reference">
              Checkout reference: <code>{sessionId}</code>
            </p>
          )}
          <StepList steps={STEPS} className="status__steps" itemClassName="sunken" padNumbers={false} />
          <div className="status__contact">
            <span>
              Questions about your order? <a href={placeholders.emailHref}>{placeholders.email}</a>
            </span>
            <Button to="/" size="lg">Keep shopping</Button>
          </div>
        </div>
      </Window>
    </div>
  )
}
