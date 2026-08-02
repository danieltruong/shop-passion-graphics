/**
 * Animation configuration for shop.passion.graphics
 * "Graphic Design is My Passion" aesthetic — bouncy, spinny, over-the-top
 *
 * `withDelay` and `staggerContainer` are factories. Framer Motion propagates variants to
 * children by *reference*, so calling them during render hands Framer a new variant tree every
 * time. Always call them at module scope and reuse the constant — see Hero.jsx / ProductSection.jsx.
 */

// ===== TIMING CONSTANTS =====
export const DURATIONS = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.5,
}

export const DELAYS = {
  short: 0.2,
  medium: 0.5,
  long: 0.8,
}

// ===== VIEWPORT CONFIGURATIONS =====
export const VIEWPORTS = {
  default: { once: true },
}

// ===== ANIMATION VARIANTS =====

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATIONS.normal },
  },
}

export const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.normal, ease: 'easeOut' },
  },
}

export const fadeInDown = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.normal, ease: 'easeOut' },
  },
}

export const scaleIn = {
  hidden: { scale: 0 },
  visible: {
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20, duration: DURATIONS.normal },
  },
}

/** Stagger container. Call at module scope, not during render. */
export const staggerContainer = (stagger = 0.15, delayChildren = 0.1) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren,
    },
  },
})

// ===== UTILITY FUNCTIONS =====

/**
 * Return a copy of `variant` whose `visible` state is delayed.
 *
 * Only meaningful for variants with a `visible.transition`. Passing a stagger container would
 * previously drop `staggerChildren`; it now throws rather than silently losing the stagger.
 */
export const withDelay = (variant, delay) => {
  if (!variant?.visible) {
    throw new Error('withDelay expects a variant with a `visible` state')
  }
  return {
    ...variant,
    visible: {
      ...variant.visible,
      transition: {
        ...variant.visible.transition,
        delay,
      },
    },
  }
}
