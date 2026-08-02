import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, scaleIn, VIEWPORTS, DELAYS, withDelay } from '../utils/animations'

// Hoisted: withDelay is a factory, and Framer propagates variants by reference. Calling it
// inline produced a fresh variant tree on every render.
const FROG_IN = withDelay(scaleIn, DELAYS.short)
const TAGLINE_IN = withDelay(fadeIn, DELAYS.medium)
const BLURB_IN = withDelay(fadeIn, DELAYS.long)

export default function Hero() {
  const [marqueePaused, setMarqueePaused] = useState(false)

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
        variants={FROG_IN}
        aria-hidden="true"
      >
        🐸
      </motion.div>

      <motion.h2 className="hero-tagline rainbow-text" variants={TAGLINE_IN}>
        graphic design is my passion
      </motion.h2>

      <motion.p className="hero-blurb" variants={BLURB_IN}>
        Premium products, crafted with unmatched artistic vision
      </motion.p>

      {/*
        WCAG 2.2.2 — content that moves for more than five seconds needs a pause mechanism.
        The animation is also stopped entirely under prefers-reduced-motion (see App.css).
      */}
      <div className="hero-marquee-wrap">
        <div className={`hero-marquee${marqueePaused ? ' hero-marquee--paused' : ''}`}>
          <span>
            ★ FREE SHIPPING ★ AMAZING DEALS ★ WOW ★ SUCH GRAPHICS ★ VERY DESIGN ★ FREE SHIPPING
            ★ AMAZING DEALS ★ WOW ★ SUCH GRAPHICS ★ VERY DESIGN ★
          </span>
        </div>
        <button
          className="marquee-toggle"
          onClick={() => setMarqueePaused((p) => !p)}
          aria-pressed={marqueePaused}
        >
          {marqueePaused ? 'Resume scrolling banner' : 'Pause scrolling banner'}
        </button>
      </div>

      <motion.div className="hero-gems" variants={BLURB_IN} aria-hidden="true">
        <span className="decoration--float" style={{ animationDelay: '0s' }}>
          💎
        </span>
        <span className="decoration--float" style={{ animationDelay: '0.5s' }}>
          🌟
        </span>
        <span className="decoration--float" style={{ animationDelay: '1s' }}>
          💎
        </span>
      </motion.div>
    </motion.section>
  )
}
