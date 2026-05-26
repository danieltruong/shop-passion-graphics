import { motion } from 'framer-motion'
import { fadeIn, VIEWPORTS } from '../utils/animations'

const visitorCount = Math.floor(Math.random() * 900000) + 100000

export default function Footer() {

  return (
    <motion.footer
      className="site-footer"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORTS.default}
      variants={fadeIn}
    >
      <p className="footer-counter">
        🌐 You are visitor #{visitorCount.toLocaleString()} 🌐
      </p>

      <div style={{ margin: '1rem 0', fontSize: '1.5rem' }}>
        🚧 ⚠️ Site under construction ⚠️ 🚧
      </div>

      <p className="footer-text">
        © {new Date().getFullYear()} shop.passion.graphics — All rights reserved
      </p>

      <p className="footer-passion wordart-glow">
        ✨ made with passion ✨
      </p>

      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <span style={{ animation: 'blink 1s infinite' }}>Best viewed in Netscape Navigator 4.0</span>
      </div>
    </motion.footer>
  )
}
