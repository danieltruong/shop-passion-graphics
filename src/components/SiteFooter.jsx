import { Link } from 'react-router'
import Button from './Button'
import { SITE_NAME, jokes, placeholders } from '../content/site'
import './SiteFooter.css'

export default function SiteFooter() {
  return (
    <footer className="spg-footer">
      <div className="spg-footer__grid">
        <nav aria-label="Footer" className="spg-footer__nav">
          <div className="spg-footer__col">
            <h2>Shop links</h2>
            <ul>
              <li><Link to="/">All products</Link></li>
              <li><Link to="/?badge=new#shop">New arrivals</Link></li>
              <li><Link to="/faq#products">Custom orders</Link></li>
            </ul>
          </div>

          <div className="spg-footer__col">
            <h2>Help</h2>
            <ul>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/shipping">Shipping &amp; returns</Link></li>
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><a href={placeholders.emailHref}>Contact: {placeholders.email}</a></li>
            </ul>
          </div>

          <div className="spg-footer__col">
            <h2>About</h2>
            <ul>
              <li><Link to="/about">About the shop</Link></li>
              <li><a href={placeholders.instagramHref}>{placeholders.instagram}</a></li>
            </ul>
          </div>
        </nav>

        {/* Disabled until a mailing list provider exists, so no address is taken and dropped. */}
        <form id="mailing-list" className="spg-footer__col spg-footer__signup">
          <h2>Mailing list</h2>
          <p id="mailing-list-tagline" className="spg-footer__tagline">
            New drops, straight to your inbox.
          </p>
          <div className="spg-footer__signup-row">
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="sunken"
              aria-label="Email address"
              aria-describedby="mailing-list-tagline mailing-list-note"
              disabled
            />
            <Button variant="win" type="submit" disabled>
              Sign up
            </Button>
          </div>
          <p id="mailing-list-note" className="spg-footer__note">
            {placeholders.mailingListProvider}
          </p>
        </form>
      </div>

      <div className="spg-footer__bottom">
        <span>
          © {new Date().getFullYear()} {SITE_NAME} · Secure checkout by Stripe
        </span>
        <span className="spg-footer__netscape">{jokes.footer}</span>
      </div>
    </footer>
  )
}
