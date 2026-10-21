import { formatPrice } from '../utils/formatPrice'
import './PriceSticker.css'

export default function PriceSticker({ amount, currency, rotate = 5, size = 'md', className = '' }) {
  return (
    <span
      className={`price-sticker price-sticker--${size} ${className}`.trim()}
      style={{ '--sticker-rotate': `${rotate}deg` }}
    >
      {formatPrice(amount, currency)}
    </span>
  )
}
