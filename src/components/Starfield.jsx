import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import './Starfield.css'

// Far to near. `tile` is the background tile edge in px; `k` is the scroll factor.
const LAYERS = [
  { name: 'far', tile: 180, k: 0.02 },
  { name: 'mid', tile: 260, k: 0.05 },
  { name: 'near', tile: 340, k: 0.09 },
]

function StarLayer({ name, tile, k, scrollY, reduce }) {
  // Wrapping at one tile looks identical (the tile repeats) and keeps the shift inside the layer's overhang.
  const y = useTransform(scrollY, (v) => -((v * k) % tile))

  // Outer carries the scroll parallax, inner the CSS drift, so neither overwrites the other's transform.
  // Pause stops only the drift (data-animations-paused in theme.css); parallax follows the user's scroll.
  return (
    <motion.div className="starfield__layer" style={{ '--tile': `${tile}px`, y: reduce ? 0 : y }}>
      <div className={`starfield__stars starfield__stars--${name}`} />
    </motion.div>
  )
}

function Starfield() {
  const { scrollY } = useScroll()
  const reduce = useReducedMotion()

  return (
    <div className="starfield" aria-hidden="true">
      {LAYERS.map((layer) => (
        <StarLayer key={layer.name} {...layer} scrollY={scrollY} reduce={reduce} />
      ))}
    </div>
  )
}

export default Starfield
