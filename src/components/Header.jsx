import { motion } from 'framer-motion'
import { fadeInDown } from '../utils/animations'
import CartIcon from './CartIcon'

/**
 * Header — site header with title, subtitle, decorations, and cart icon.
 *
 * The decorations are plain <div>s: their movement comes from the CSS classes
 * .decoration--spin / .decoration--float, so wrapping them in motion.div pulled in the full
 * Framer component machinery and subscribed them to variant propagation to animate nothing.
 *
 * Props:
 *   cart       [{ product, quantity }]  — passed to CartIcon for badge count
 *   onCartOpen (event) => void          — opens CartDrawer; receives the event so App can
 *                                         remember the trigger and restore focus on close
 */
export default function Header({ cart, onCartOpen }) {
  return (
    <motion.header
      className="site-header"
      initial="hidden"
      animate="visible"
      variants={fadeInDown}
    >
      <div
        className="decoration decoration--spin"
        style={{ position: 'absolute', top: '10px', left: '20px', fontSize: '2rem' }}
        aria-hidden="true"
      >
        ✦
      </div>
      <div
        className="decoration decoration--spin"
        style={{
          position: 'absolute',
          top: '10px',
          right: '20px',
          fontSize: '2rem',
          animationDirection: 'reverse',
        }}
        aria-hidden="true"
      >
        ✦
      </div>

      <h1 className="site-title rainbow-text">shop.passion.graphics</h1>
      <p className="site-subtitle wordart-glow">~ where every purchase is a masterpiece ~</p>

      <div
        className="decoration decoration--float"
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '1.5rem',
        }}
        aria-hidden="true"
      >
        ⭐ ✨ ⭐
      </div>

      <CartIcon cart={cart} onClick={onCartOpen} />
    </motion.header>
  )
}
