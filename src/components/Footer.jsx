import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeIn, VIEWPORTS } from '../utils/animations'

/** Purely decorative retro flourish — not a real analytics figure. */
function randomVisitorCount() {
  return Math.floor(Math.random() * 900000) + 100000
}

export default function Footer() {
  // Held in state rather than computed at module scope: a module-level Math.random() runs at
  // import time, which makes the component non-deterministic in tests and would produce a
  // server/client hydration mismatch if this app ever pre-renders.
  const [visitorCount] = useState(randomVisitorCount)

  return (
    <motion.footer
      className="site-footer"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORTS.default}
      variants={fadeIn}
    >
      <p className="footer-counter">
        <span aria-hidden="true">🌐</span> You are visitor #{visitorCount.toLocaleString()}{' '}
        <span aria-hidden="true">🌐</span>
      </p>

      <div className="footer-construction">
        <span aria-hidden="true">🚧 ⚠️</span> Site under construction{' '}
        <span aria-hidden="true">⚠️ 🚧</span>
      </div>

      <p className="footer-text">
        © {new Date().getFullYear()} shop.passion.graphics — All rights reserved
      </p>

      <p className="footer-passion wordart-glow">
        <span aria-hidden="true">✨</span> made with passion <span aria-hidden="true">✨</span>
      </p>

      <div className="footer-netscape">
        {/* WCAG 2.2.2: the blink animation is gated on prefers-reduced-motion in theme.css
            and stops on its own after a few cycles rather than running forever. */}
        <span className="blink">Best viewed in Netscape Navigator 4.0</span>
      </div>
    </motion.footer>
  )
}
