# TODO

- Self-host Anton and Comic Neue instead of the render-blocking Google Fonts link in `index.html`, and name Google Fonts in the privacy page once the policy text exists.
- Build the HANDOFF animation plan "Add:" items left out of Phase 1: frog blink and hop, sparkle twinkle, grid entrance, card hover lift with sticker 5°→2°, `layout` + `AnimatePresence` on filtering, thumbnail crossfade, accordion chevron transition, success-page hop.
- Rewrite the SPA fallback comment at `infra/template.yaml` line 252: `src/App.jsx` routes every path with react-router, not on `window.location.pathname === '/success'`.
