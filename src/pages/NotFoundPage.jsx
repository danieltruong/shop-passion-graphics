import Button from '../components/Button'
import usePageTitle from '../hooks/usePageTitle'
import './status.css'

export default function NotFoundPage() {
  usePageTitle('Page not found')

  return (
    <div className="status">
      <div className="status__hero">
        <h1 className="status__title rainbow-text">Page not found</h1>
        <p className="status__lead">We couldn&apos;t find that page.</p>
        <Button to="/" size="lg">Back to the shop</Button>
      </div>
    </div>
  )
}
