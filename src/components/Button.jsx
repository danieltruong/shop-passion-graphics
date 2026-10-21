import { Link } from 'react-router'
import './Button.css'

export default function Button({
  variant = 'primary',
  size = 'md',
  href,
  to,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const bevel = variant === 'win' ? ' bevel' : ''
  const classes = `btn btn--${variant} btn--${size}${bevel} ${className}`.trim()

  if (to !== undefined) {
    return <Link to={to} className={classes} {...rest}>{children}</Link>
  }
  if (href !== undefined) {
    return <a href={href} className={classes} {...rest}>{children}</a>
  }
  return <button type={type} className={classes} {...rest}>{children}</button>
}
