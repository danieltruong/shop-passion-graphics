// Decorative only: every icon is aria-hidden, so put the meaning in visible or hidden text.
function Svg({ size = 24, width = size, height = size, viewBox = '0 0 24 24', children, ...props }) {
  return (
    <svg width={width} height={height} viewBox={viewBox} {...props} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

const stroke = (strokeWidth) => ({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

export function IconFrog({ size = 40, ...props }) {
  return (
    <Svg viewBox="0 0 64 56" width={size} height={Math.round((size * 56) / 64)} {...props}>
      <circle cx="18" cy="16" r="12" fill="#39c25a" />
      <circle cx="46" cy="16" r="12" fill="#39c25a" />
      <ellipse cx="32" cy="36" rx="28" ry="18" fill="#39c25a" />
      <circle cx="18" cy="16" r="6" fill="#fff" />
      <circle cx="46" cy="16" r="6" fill="#fff" />
      <circle cx="19" cy="17" r="3" fill="#111" />
      <circle cx="47" cy="17" r="3" fill="#111" />
      <path d="M18 38 Q32 48 46 38" stroke="#14532d" strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
  )
}

export function IconSparkle(props) {
  return (
    <Svg fill="currentColor" {...props}>
      <path d="M12 1 L14 10 L23 12 L14 14 L12 23 L10 14 L1 12 L10 10 Z" />
    </Svg>
  )
}

export function IconCart({ size = 20, ...props }) {
  return (
    <Svg size={size} {...stroke(2.4)} {...props}>
      <path d="M2 3h3l2.5 12h11L21 7H6.5" />
      <circle cx="9" cy="20" r="1.6" />
      <circle cx="18" cy="20" r="1.6" />
    </Svg>
  )
}

export function IconChevron({ size = 12, ...props }) {
  return (
    <Svg size={size} fill="currentColor" {...props}>
      <path d="M8 4l10 8-10 8z" />
    </Svg>
  )
}

export function IconLock({ size = 18, ...props }) {
  return (
    <Svg size={size} {...stroke(2)} {...props}>
      <rect x="4" y="11" width="16" height="10" rx="1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  )
}

export function IconTruck({ size = 30, ...props }) {
  return (
    <Svg size={size} {...stroke(2)} {...props}>
      <path d="M1 6h13v10H1zM14 10h5l3 3v3h-8z" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Svg>
  )
}

export function IconGift({ size = 30, ...props }) {
  return (
    <Svg size={size} {...stroke(2)} {...props}>
      <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </Svg>
  )
}

export function IconCheck({ size = 16, ...props }) {
  return (
    <Svg size={size} {...stroke(3)} {...props}>
      <path d="M4 12l5 5L20 6" />
    </Svg>
  )
}

export function IconMenu({ size = 22, ...props }) {
  return (
    <Svg size={size} {...stroke(2.6)} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  )
}

export function IconSearch({ size = 16, ...props }) {
  return (
    <Svg size={size} {...stroke(2.5)} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </Svg>
  )
}

export function IconWarning({ size = 16, ...props }) {
  return (
    <Svg size={size} {...stroke(2.5)} {...props}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18h.01" />
    </Svg>
  )
}

export function IconArrowDown({ size = 18, ...props }) {
  return (
    <Svg size={size} {...stroke(3)} {...props}>
      <path d="M12 4v16M5 13l7 7 7-7" />
    </Svg>
  )
}
