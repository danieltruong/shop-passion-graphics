import { motion } from 'framer-motion'
import { fadeInDown, VIEWPORTS } from '../utils/animations'

export default function Header() {
  return (
    <motion.header
      className="site-header"
      initial="hidden"
      animate="visible"
      variants={fadeInDown}
    >
      <motion.div
        className="decoration decoration--spin"
        style={{ position: 'absolute', top: '10px', left: '20px', fontSize: '2rem' }}
      >
        ✦
      </motion.div>
      <motion.div
        className="decoration decoration--spin"
        style={{ position: 'absolute', top: '10px', right: '20px', fontSize: '2rem', animationDirection: 'reverse' }}
      >
        ✦
      </motion.div>

      <h1 className="site-title rainbow-text">
        shop.passion.graphics
      </h1>
      <p className="site-subtitle wordart-glow">
        ~ where every purchase is a masterpiece ~
      </p>

      <motion.div
        className="decoration decoration--float"
        style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.5rem' }}
      >
        ⭐ ✨ ⭐
      </motion.div>

      <ViewportTrigger />
    </motion.header>
  )
}

function ViewportTrigger() {
  return null
}
