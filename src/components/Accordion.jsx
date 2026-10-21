import { IconChevron } from './icons'
import './Accordion.css'

// summary may hold one heading; a heading may not hold details, so the heading goes inside.
export default function Accordion({
  title,
  variant = 'sunken',
  headingLevel = 3,
  defaultOpen = false,
  className = '',
  children,
}) {
  const Heading = `h${headingLevel}`
  const sunken = variant === 'sunken' ? ' sunken' : ''

  return (
    <details className={`accordion accordion--${variant}${sunken} ${className}`.trim()} open={defaultOpen}>
      <summary className="accordion__summary">
        <IconChevron className="accordion__chevron" />
        <Heading className="accordion__heading">{title}</Heading>
      </summary>
      <div className="accordion__panel">{children}</div>
    </details>
  )
}
