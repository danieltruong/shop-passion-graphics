// Shared site copy from docs/redesign/HANDOFF.md and its mockups. Bracketed values are
// placeholders the owners fill in once here; do not invent them.

import { formatPrice } from '../utils/formatPrice'

export const SITE_NAME = 'shop.passion.graphics'

// CAD minor units; null until the owners set it, which hides the cart's progress bar and shows
// the bracketed placeholder wherever the threshold is printed.
const FREE_SHIPPING_THRESHOLD_CENTS = null

export const placeholders = {
  ownerNames: '[your names]',
  city: '[your city]',
  email: '[your email]',
  emailHref: 'mailto:[email]',
  instagram: '[Instagram]',
  instagramHref: '[instagram]',
  freeShippingThreshold:
    typeof FREE_SHIPPING_THRESHOLD_CENTS === 'number' ? formatPrice(FREE_SHIPPING_THRESHOLD_CENTS, 'CAD') : '$[XX]',
  shippingCost: '$[00]',
  deliveryTime: '[X–Y] business days',
  orderNumber: '[#ORDER-NUMBER]',
  workspacePhoto: 'PHOTO OF YOUR WORKSPACE',
  productDetails: '[Size, materials and care for this piece.]',
  designStory: '[What inspired this piece, in a sentence or two.]',
  privacyPolicy: '[Privacy policy: what the mailing list collects, and how Stripe handles payment.]',
  mailingListProvider: '[mailing list provider]',
}

// The only jokes the handoff keeps. Add no new ones.
export const jokes = {
  hero: 'graphic design is my passion',
  faqQuestion: 'Is graphic design really your passion?',
  faqAnswer: 'Yes.',
  footer: 'Best viewed in Netscape Navigator 4.0',
}

export const hero = {
  kicker: 'Handmade in small batches',
  title: jokes.hero,
  lead: 'A very small arts and crafts shop. Everything here is made by hand, a few at a time.',
}

export const policies = {
  shipsFrom: 'BC, Canada',
  dispatchTime: '3–5 business days',
  carrier: 'Tracked mail',
  returnWindowDays: 14,
  returnExclusions: "Custom, personalized and final-sale items can't be returned.",
  damageReportDays: 7,
  refundDays: 5,
  replyTime: '2 business days',
  freeShippingThresholdCents: FREE_SHIPPING_THRESHOLD_CENTS,
}

export const marquee = [
  'HANDMADE IN SMALL BATCHES',
  `SHIPS IN ${policies.dispatchTime.toUpperCase()}`,
  `FREE SHIPPING IN CANADA OVER ${placeholders.freeShippingThreshold}`,
  'SECURE CHECKOUT BY STRIPE',
]

// Shown instead of the scrolling marquee on narrow screens.
export const marqueeShort = `FREE SHIPPING OVER ${placeholders.freeShippingThreshold}`
