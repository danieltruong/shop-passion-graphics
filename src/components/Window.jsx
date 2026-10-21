import { useId } from 'react'
import './Window.css'

export default function Window({
  title,
  titleAs: TitleTag = 'span',
  icon,
  controls = false,
  as: Tag = 'div',
  className = '',
  children,
}) {
  const titleId = useId()
  const labelled = Tag === 'section' ? { 'aria-labelledby': titleId } : {}

  return (
    <Tag className={`window bevel ${className}`.trim()} {...labelled}>
      <div className="window__titlebar">
        <TitleTag id={titleId} className="window__title">
          {icon}
          {title}
        </TitleTag>
        {controls && (
          <span className="window__controls" aria-hidden="true">
            <span className="window__control bevel">_</span>
            <span className="window__control bevel">□</span>
            <span className="window__control bevel">×</span>
          </span>
        )}
      </div>
      <div className="window__body">{children}</div>
    </Tag>
  )
}
