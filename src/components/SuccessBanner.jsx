/**
 * SuccessBanner — confirmation shown after returning from Stripe Checkout.
 *
 * Stripe's success_url is `${origin}/success?session_id={CHECKOUT_SESSION_ID}`. There is no
 * router in this app, and on S3/CloudFront that path resolved to a 404 — paying customers
 * landed on an error page. CloudFront now serves index.html for unknown paths, and this
 * component reads the path so the app can respond to it.
 *
 * This is a *display* confirmation only. It is not proof of payment: the session id comes from
 * the URL and is trivially forgeable. Fulfilment must be driven by a `checkout.session.completed`
 * webhook — see docs/AUDIT.md (SEC-07), which is not yet implemented.
 */
export default function SuccessBanner() {
  if (typeof window === 'undefined' || window.location.pathname !== '/success') return null

  const sessionId = new URLSearchParams(window.location.search).get('session_id')
  if (!sessionId) return null

  return (
    <div className="success-banner" role="status">
      <h2 className="rainbow-text">
        <span aria-hidden="true">🎉</span> Thanks for your order!
      </h2>
      <p>Your payment went through. A receipt is on its way to your email.</p>
      <a className="btn-buy" href="/">
        Back to the shop
      </a>
    </div>
  )
}
