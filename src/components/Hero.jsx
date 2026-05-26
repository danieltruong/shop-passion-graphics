import { motion } from 'framer-motion'
import { fadeIn, scaleIn, VIEWPORTS, DELAYS, withDelay } from '../utils/animations'

export default function Hero() {
  return (
    <motion.section
      className="hero"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORTS.default}
      variants={fadeIn}
    >
      <motion.div
        className="decoration decoration--wobble"
        style={{ fontSize: '4rem', marginBottom: '1rem' }}
        variants={withDelay(scaleIn, DELAYS.short)}
      >
        🐸
      </motion.div>

      <motion.h2
        className="hero-tagline rainbow-text"
        variants={withDelay(fadeIn, DELAYS.medium)}
      >
        graphic design is my passion
      </motion.h2>

      <motion.p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '1.1rem',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-md)'
        }}
        variants={withDelay(fadeIn, DELAYS.long)}
      >
        Premium products, crafted with unmatched artistic vision
      </motion.p>

      <div className="hero-marquee">
        <span>
          ★ FREE SHIPPING ★ AMAZING DEALS ★ WOW ★ SUCH GRAPHICS ★ VERY DESIGN ★ FREE SHIPPING ★ AMAZING DEALS ★ WOW ★ SUCH GRAPHICS ★ VERY DESIGN ★
        </span>
      </div>

      <motion.div
        style={{ display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '2rem' }}
        variants={withDelay(fadeIn, DELAYS.long)}
      >
        <span className="decoration--float" style={{ animationDelay: '0s' }}>💎</span>
        <span className="decoration--float" style={{ animationDelay: '0.5s' }}>🌟</span>
        <span className="decoration--float" style={{ animationDelay: '1s' }}>💎</span>
      </motion.div>
    </motion.section>
  )
}
