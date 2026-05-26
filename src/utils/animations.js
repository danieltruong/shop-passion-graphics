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

// ===== SPRING CONFIGURATIONS =====
export const SPRINGS = {
  default: { type: "spring", stiffness: 100, damping: 10 },
  bouncy: { type: "spring", stiffness: 300, damping: 20 },
  wobbly: { type: "spring", stiffness: 200, damping: 8 },
  gentle: { type: "spring", stiffness: 50, damping: 15 }
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

export const slideInLeft = {
  hidden: { x: -60, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: DURATIONS.normal }
  }
}

export const slideInRight = {
  hidden: { x: 60, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: DURATIONS.normal }
  }
}

export const scaleIn = {
  hidden: { scale: 0 },
  visible: {
    scale: 1,
    transition: { ...SPRINGS.bouncy, duration: DURATIONS.normal }
  }
}

export const scaleInRotate = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: { ...SPRINGS.wobbly, duration: DURATIONS.slow }
  }
}

export const bounceIn = {
  hidden: { scale: 0, y: -50 },
  visible: {
    scale: 1,
    y: 0,
    transition: { ...SPRINGS.bouncy }
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

// ===== HOVER ANIMATIONS =====
export const hoverScale = {
  scale: 1.05,
  transition: { duration: DURATIONS.fast }
}

export const hoverWobble = {
  rotate: [0, -3, 3, -3, 0],
  transition: { duration: 0.4 }
}

export const tapScale = {
  scale: 0.95,
  transition: { duration: DURATIONS.instant }
}

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
