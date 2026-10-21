import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router'
import Button from './Button'
import { IconCart, IconFrog, IconMenu, IconSearch } from './icons'
import { SITE_NAME, marquee, marqueeShort } from '../content/site'
import { totalItems } from '../utils/cart'
import './SiteHeader.css'

const NAV = [
  { to: '/', label: 'Shop' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/shipping', label: 'Shipping & returns' },
]

const Star = () => <span aria-hidden="true">★</span>

// Stars are decoration: screen readers hear only the items.
function StarLine({ items }) {
  return (
    <>
      {items.map((item) => (
        <Fragment key={item}>
          <Star /> {item}{' '}
        </Fragment>
      ))}
      <Star />
    </>
  )
}

export default function SiteHeader({
  cartEnabled = false,
  cart = [],
  onCartOpen,
  animationsPaused = false,
  onToggleAnimations,
}) {
  const menuButtonRef = useRef(null)
  const menuId = useId()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const onHome = pathname === '/'
  const onProductPage = pathname.startsWith('/products/')

  // Any navigation closes the menu, links and back/forward alike.
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(pathname)
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setMenuOpen(false)
  }

  // The box mirrors ?q= on the home page; typing edits a draft until the URL changes again.
  const query = onHome ? (searchParams.get('q') ?? '') : ''
  const [search, setSearch] = useState(query)
  const [searchFor, setSearchFor] = useState(query)
  if (searchFor !== query) {
    setSearchFor(query)
    setSearch(query)
  }

  useEffect(() => {
    if (!menuOpen) return undefined
    function onKeyDown(event) {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  function handleSearch(event) {
    event.preventDefault()
    const term = search.trim()
    // On the home page the search keeps the current filters; the #shop hash scrolls to the grid.
    const params = new URLSearchParams(onHome ? searchParams : undefined)
    if (term) params.set('q', term)
    else params.delete('q')
    const qs = params.toString()
    // Re-submitting the same term still scrolls, without stacking a duplicate history entry.
    navigate(`/${qs ? `?${qs}` : ''}#shop`, { replace: onHome && term === query })
    closeMenu()
  }

  const itemCount = totalItems(cart)

  return (
    <header className="spg-header">
      <div className="spg-marquee">
        <div className="spg-marquee__viewport">
          <div className="spg-marquee__track">
            <span className="spg-marquee__copy">
              <StarLine items={marquee} />
            </span>
            <span className="spg-marquee__copy" aria-hidden="true">
              <StarLine items={marquee} />
            </span>
          </div>
          <span className="spg-marquee__short">
            <StarLine items={[marqueeShort]} />
          </span>
        </div>
        {/* WCAG 2.2.2: one control stops every loop (marquee, rainbow, starfield) at every width. */}
        <button
          type="button"
          className={`pause-toggle ${animationsPaused ? 'sunken' : 'bevel'}`}
          aria-pressed={animationsPaused}
          onClick={onToggleAnimations}
        >
          Pause<span className="visually-hidden"> animations</span>
        </button>
      </div>

      <div className="spg-header__row">
        <button
          ref={menuButtonRef}
          type="button"
          className="spg-header__menu-btn bevel"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <IconMenu />
        </button>

        <Link to="/" className="spg-header__logo" onClick={closeMenu}>
          <IconFrog />
          <span className="spg-header__name rainbow-text">{SITE_NAME}</span>
        </Link>

        <div id={menuId} className={`spg-header__menu${menuOpen ? ' is-open' : ''}`}>
          <nav aria-label="Main" className="spg-nav">
            {NAV.map(({ to, label }) =>
              // NavLink matches "/" exactly; product pages sit inside Shop but are not that page.
              to === '/' && onProductPage ? (
                <Link key={to} to={to} className="spg-nav__link" aria-current="true" onClick={closeMenu}>
                  {label}
                </Link>
              ) : (
                <NavLink key={to} to={to} end className="spg-nav__link" onClick={closeMenu}>
                  {label}
                </NavLink>
              ),
            )}
          </nav>

          <form role="search" className="spg-search" action="/" onSubmit={handleSearch}>
            <label htmlFor="site-search" className="visually-hidden">
              Search products
            </label>
            <div className="spg-search__box sunken">
              <IconSearch />
              <input
                id="site-search"
                name="q"
                type="search"
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </form>
        </div>

        {cartEnabled && (
          <Button
            className="spg-header__cart"
            onClick={onCartOpen}
            aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
          >
            <IconCart />
            <span className="spg-header__cart-text" aria-hidden="true">
              CART ({itemCount})
            </span>
            {itemCount > 0 && (
              <span className="spg-header__cart-badge" aria-hidden="true">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Button>
        )}
      </div>
    </header>
  )
}
