# shop.passion.graphics — redesign handoff

Implementation brief for the redesign mocked up on the claude.ai design canvas.
Put this folder at `docs/redesign/` in the repo. The `mockups/` folder holds the
source of every artboard (`*.dc.html`) — open them in a text editor for exact
copy, colours, spacing and structure. They are design references, not code to
copy in: they use a canvas-only runtime (`<x-dc>`, `<sc-for>`, `<dc-import>`,
`{{holes}}`), so rebuild them as React components.

## Direction

A very small handmade arts & crafts shop. The 1998 / Windows-98 / WordArt look
stays as the brand, but the store must read and work like a real shop:

- Parody lives in **decoration**: Papyrus headings, rainbow logo, beveled grey
  "windows" with navy title bars, gold beveled buttons, rotated price stickers,
  starburst badges, the frog mascot.
- Anything people need to **read or act on** is plain and legible: Tahoma for
  body, product info, forms, cart and prices; clear labels; real buttons/links.
- Copy is plain and friendly. The only jokes left: the "graphic design is my
  passion" hero line, the About page's last line, the FAQ's "Yes.", and
  "Best viewed in Netscape Navigator 4.0" in the footer. Don't add new puns.

## Design tokens (update `src/theme.css`)

| Token | Value | Use |
|---|---|---|
| bg | `#0d0d1a` + existing radial/linear gradient | page |
| panel | `rgba(30,30,60,0.92)` | product cards, tiles |
| text | `#ffffff`; secondary `#c9c9e6` / `#d6d6ee` | body on dark |
| gold | `#ffd700` | headings on dark, card border (`4px outset`) |
| link | `#7fe9ff`, hover `#ffd700` | links on dark |
| win-grey | `#c0c0c0`; pressed `#dcdcdc` | windows, secondary buttons |
| win-title | `linear-gradient(90deg,#000080,#1084d0)` white bold text | window title bars, accordion headers |
| ink on grey | `#000`, links `#000080` | text inside windows |
| primary btn | `linear-gradient(180deg,#ffff66 0%,#ffb11a 55%,#ff6a00 100%)`, `3–4px outset #ffd700`, `box-shadow: 3–4px 3–4px 0 rgba(0,0,0,.5)`, black Impact uppercase | Add to cart, Checkout, Shop |
| badge | `#ff2d95` starburst (clip-path in mockups) | NEW! |
| success | `#8dff7a` | "In stock" |
| rainbow | `#ff5c5c,#ff9a1f,#ffd700,#39ff14,#00bfff,#b98cff,#ff69b4` | logo + page H1 only (brighter than the current purple stop, for contrast) |

Bevel recipe (raised): `border:2px solid; border-color:#fff #404040 #404040 #fff; box-shadow: inset 1px 1px #dfdfdf, inset -1px -1px #808080`. Sunken: swap the border colours.

Fonts:
- Display: `Papyrus, 'Segoe Print', fantasy` — logo, page titles, section titles only (≥22px).
- Accent: `Impact, Anton, sans-serif` — prices, primary button labels, step numbers.
- Flavour: `'Comic Sans MS', 'Comic Neue', cursive` — marquee, small kicker lines.
- UI/body: `Tahoma, Verdana, 'Segoe UI', sans-serif` — everything else.
- Load Comic Neue + Anton from Google Fonts as fallbacks.

Remove `--font-body: Comic Sans` as the body default; body becomes Tahoma.

## Components to build

| Component | Mockup reference | Notes |
|---|---|---|
| `Window` | many (e.g. Cart, FAQ) | grey bevel frame + title bar; props `title`, optional controls |
| `Button` | header, cards | `variant="primary"` (gold) / `"win"` (grey bevel); ≥44px tall; pressed = translate 2px + smaller shadow |
| `PriceSticker` | cards, product | rotated 5°, gold gradient, Impact |
| `Starburst` | cards, product | "NEW!" badge |
| `SiteHeader` | `SiteHeader.dc.html` | marquee strip, logo + frog, nav (Shop / About / FAQ / Shipping & returns, `aria-current`), search, cart button with count; mobile: hamburger + logo + cart icon w/ badge (`MobileHome.dc.html`) |
| `SiteFooter` | `SiteFooter.dc.html` | 4 columns (Shop, Help, About, Mailing list) + bottom row; drop the random visitor counter |
| `ProductCard` | `Main.dc.html` | photo 1:1, price sticker, NEW!/SOLD OUT states, name links to product page, Add to cart / Notify me |
| `FilterBar` | `Main.dc.html` | category toggle buttons (`aria-pressed`), item count, sort select |
| `CartDrawer` | `Cart.dc.html`, `CartEmpty.dc.html` | right-side dialog, free-shipping progress bar (Win98 blocks), line items w/ qty stepper + remove, subtotal, Checkout |
| `Accordion` | `Product.dc.html`, `FAQ.dc.html` | native `<details>/<summary>` styled as Win98 |

## Pages / routes

`react-router` in `src/App.jsx` serves these routes. The S3/CloudFront SPA fallback
keeps working because CloudFront serves `index.html` for unknown paths
(`CustomErrorResponses` in `infra/template.yaml`).

| Route | Mockup |
|---|---|
| `/` | `Main.dc.html` (desktop), `MobileHome.dc.html` (phone) |
| `/products/:slug` | `Product.dc.html`, `MobileProduct.dc.html` (sticky add-to-cart bar on phone) |
| `/about` | `About.dc.html` |
| `/faq` | `FAQ.dc.html` |
| `/shipping` | `Shipping.dc.html` |
| `/success` | `ThankYou.dc.html` (Stripe success URL) |
| cart | drawer over any page, not a route |

All pages must work at 390px wide (mobile boards show the intent).

## Product data

`scripts/generate-products.js` writes `name, description, price (cents), currency,
imageUrl, images, slug, category, badge, paymentLink, productId`. The design reads
these from Stripe product **metadata** and fields (set metadata in the Stripe dashboard):

- `category` — for the filter chips
- `badge` — `new` | `sold_out` | empty
- `slug` — for `/products/:slug` (or derive from name)
- multiple images (`product.images` already holds up to 8) for the gallery
- options (e.g. colour) only if products need them — otherwise hide the option picker

Prices display as `$12.00 CAD`.

## Checkout: two phases

The site is static (S3 + CloudFront) and each product has its own Stripe
**Payment Link**, which only buys one product per checkout.

1. **Phase 1 — ship the redesign on Payment Links.** Product page button =
   "Buy now" → product's `paymentLink` (adjustable quantity already enabled).
   Hide the cart drawer and cart count. Set each Payment Link's success URL to
   `/success`.
2. **Phase 2 — multi-item cart.** Cart state in React (persist to
   `localStorage`). Add a small backend endpoint (AWS Lambda function URL or API
   Gateway in `ca-central-1`) that receives `[{priceId, quantity}]`, validates
   prices server-side, creates a Stripe **Checkout Session**
   (`success_url=/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url=/`,
   shipping rates + allowed countries CA/US) and returns the URL. Never trust
   prices from the client; the secret key lives only in the Lambda. See
   `.agents/skills/stripe-best-practices`.

## Policies (final copy is in the mockups)

- Ships from BC, Canada within 3–5 business days, tracked mail, Canada + US only.
- Free shipping in Canada over $[XX].
- Returns: unused items within 14 days of delivery; customer pays return
  shipping unless it was our mistake; custom/personalized/final-sale excluded.
- Damaged: photo within 7 days → replacement or refund, no need to return it.
- Refunds to original payment method within 5 business days of receiving the return.
- Orders can be changed/cancelled until shipped.
- Replies to email within 2 business days.

Still placeholders (`[...]`) — leave visible TODOs, don't invent: owner names,
city, contact email, Instagram link, free-shipping threshold, shipping costs and
delivery times, product copy. Also needed before launch: a short privacy policy
page (mailing list + Stripe) linked from the footer.

## Animation plan (Framer Motion is already installed)

Wrap the app in `<MotionConfig reducedMotion="user">`. With reduced motion:
no marquee scroll, no gradient drift, no entrances/loops; state changes instant.

Retune / remove in `theme.css` and components:
- Rainbow drift 3s → ~12s, logo + H1 only. Marquee 15s → 18s, pause on hover.
- Delete: spinning `✦` decorations, floating/wobbling emoji, blinking footer text,
  `scaleIn` bouncy section titles, whole-card `scale: 1.03` hover.

Add:
- Frog logo blinks every 6–8s (eyes scaleY, 120ms); click → one hop.
- Sparkle SVGs twinkle (opacity/scale) with staggered delays.
- NEW! starburst: very slow rotation (~30s/turn) or rotate on card hover only.
- Grid entrance: opacity 0→1, y 12→0, 400ms ease-out, stagger ~50ms, `once`.
- Card hover: translateY(-2px), shadow 4→6px, image scale 1.03 inside frame,
  price sticker 5°→2°. ~120ms.
- Filtering: `layout` + `AnimatePresence` on grid items (~250ms).
- Add to cart: button shows "Added ✓" + 3–4 tiny stars for ~1.5s; header cart
  count bumps (spring scale 1→1.25→1).
- Cart drawer: slide from right ~250ms ease-out, backdrop fade; close ~200ms
  ease-in. Removing a line: height collapse + fade.
- Free-shipping bar fills block-by-block (stepped).
- Product page: thumbnail crossfade 200ms; qty number rolls; accordion height
  transition + chevron rotate; mobile sticky bar slides up after the main CTA
  scrolls out of view.
- Success page: frog hops twice + a few stars once on load; steps fade in in sequence.

Rules: 120ms micro, 200–250ms UI, ~400ms entrances; ease-out in, ease-in out;
animate only transform/opacity; ≤2–3 looping animations visible at once. The
header's "Pause animations" toggle stops every loop (WCAG 2.2.2).

## Accessibility checks

- Text contrast ≥4.5:1 (the brighter rainbow stops and secondary text colours
  above were chosen for the dark background).
- Touch targets ≥44px; real `<button>`/`<a>`/`<label>`; cart drawer is a focus-
  trapped dialog that closes on Esc; filter chips use `aria-pressed`;
  `aria-current="page"` on nav; decorative SVGs `aria-hidden`.
- Remove emoji used as decoration from headings/buttons (the mockups use SVG icons).

## Suggested order

1. Tokens, fonts, global styles; strip old animations.
2. Header, footer, shared components.
3. Home + product grid (with metadata from Stripe).
4. Router + product page, About, FAQ, Shipping, Success.
5. Animations + reduced motion.
6. Tests (Vitest is set up) and a mobile pass.
7. Phase 2 cart + Checkout Session Lambda (separate PR).
