# TODO

- Self-host Anton and Comic Neue instead of the render-blocking Google Fonts link in `index.html`, and name Google Fonts in the privacy page once the policy text exists.
- Build the HANDOFF animation plan "Add:" items left out of Phase 1: frog blink and hop, sparkle twinkle, grid entrance, card hover lift with sticker 5°→2°, `layout` + `AnimatePresence` on filtering, thumbnail crossfade, accordion chevron transition, success-page hop.
- Phase 2: pass `onAddToCart` from the ProductPage route in `src/App.jsx` to `src/pages/ProductPage.jsx` and its BuyAction, and let the ProductPage stock line accept `stripePriceId`.
- Phase 2: delete or reuse `src/components/CartIcon.jsx`, its `src/App.css` rules `.cart-icon-btn` and `.cart-badge`, and `src/test/CartIcon.test.jsx`; dead since SiteHeader renders its own cart button.
- Point the cart rules in `src/App.css` at current tokens, then delete the alias tokens in `src/theme.css` (`--font-heading` to `--border-gold`) and `--color-tile`.
- Rewrite the SPA fallback comment at `infra/template.yaml` line 252: `src/App.jsx` routes every path with react-router, not on `window.location.pathname === '/success'`.
