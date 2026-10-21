import Button from './Button'

/** A failed catalog fetch is not an empty shop: say so and offer a retry. */
export default function LoadError({ className }) {
  return (
    <div className={className}>
      <p role="alert">We couldn&apos;t load the shop just now.</p>
      <Button variant="win" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </div>
  )
}
