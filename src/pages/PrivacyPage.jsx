import { placeholders } from '../content/site'
import usePageTitle from '../hooks/usePageTitle'
import './status.css'

export default function PrivacyPage() {
  usePageTitle('Privacy policy')

  return (
    <div className="status">
      <div className="status__hero">
        <h1 className="status__title rainbow-text">Privacy policy</h1>
        <p className="status__lead">{placeholders.privacyPolicy}</p>
      </div>
    </div>
  )
}
