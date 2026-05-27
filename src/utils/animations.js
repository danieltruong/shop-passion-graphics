/**
 * Animation configuration for shop.passion.graphics
 * "Graphic Design is My Passion" aesthetic — bouncy, spinny, over-the-top
 */

// ===== TIMING CONSTANTS =====
export const DURATIONS = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.5,
  slow: 0.8,
  verySlow: 1.2
}

export const DELAYS = {
  none: 0,
  short: 0.2,
  medium: 0.5,
  long: 0.8
}

// ===== VIEWPORT CONFIGURATIONS =====
export const VIEWPORTS = {
  default: { once: true },
  withMargin: { once: true, margin: "-100px" },
  repeat: { once: false }
}

// ===== ANIMATION VARIANTS =====

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATIONS.normal }
  }
}

export const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.normal, ease: "easeOut" }
  }
}

export const fadeInDown = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.normal, ease: "easeOut" }
  }
}

export const scaleIn = {
  hidden: { scale: 0 },
  visible: {
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20, duration: DURATIONS.normal }
  }
}

// Stagger container
export const staggerContainer = (stagger = 0.15, delayChildren = 0.1) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren
    }
  }
})

// ===== UTILITY FUNCTIONS =====

export const withDelay = (variant, delay) => ({
  ...variant,
  visible: {
    ...variant.visible,
    transition: {
      ...variant.visible.transition,
      delay
    }
  }
})
