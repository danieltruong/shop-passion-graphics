import './Starburst.css'

/** "NEW!" badge, absolutely placed: the parent needs `position: relative`. */
export default function Starburst({ size = 'md', className = '' }) {
  return <span className={`starburst starburst--${size} ${className}`.trim()}>NEW!</span>
}
