import './StepList.css'

/** Numbered steps as an ordered list; `text` may hold links. */
export default function StepList({ steps, className = '', itemClassName = '', padNumbers = true }) {
  return (
    <ol className={`step-list ${className}`.trim()}>
      {steps.map((step, i) => (
        <li key={step.title} className={`step-list__item ${itemClassName}`.trim()}>
          <span className="step-list__number">{padNumbers ? String(i + 1).padStart(2, '0') : i + 1}</span>
          <strong className="step-list__title">{step.title}</strong>
          <span className="step-list__text">{step.text}</span>
        </li>
      ))}
    </ol>
  )
}
