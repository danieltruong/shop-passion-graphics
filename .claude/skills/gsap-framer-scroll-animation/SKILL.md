---
name: gsap-framer-scroll-animation
description: >-
  Use this skill whenever the user wants to build scroll animations, scroll effects,
  parallax, scroll-triggered reveals, pinned sections, horizontal scroll, text animations,
  or any motion tied to scroll position — in vanilla JS, React, or Next.js.
  Covers GSAP ScrollTrigger (pinning, scrubbing, snapping, timelines, horizontal scroll,
  ScrollSmoother, matchMedia) and Framer Motion / Motion v12 (useScroll, useTransform,
  useSpring, whileInView, variants). Use this skill even if the user just says
  "animate on scroll", "fade in as I scroll", "make it scroll like Apple",
  "parallax effect", "sticky section", "scroll progress bar", or "entrance animation".
metadata:
  author: 'Utkarsh Patrikar'
  author_url: 'https://github.com/utkarsh232005'
---

# GSAP & Framer Motion — Scroll Animations Skill

Production-grade scroll animations: ready-to-use code recipes and API notes.

## Quick Library Selector

| Need | Use |
|---|---|
| Vanilla JS, Webflow, Vue | **GSAP** |
| Pinning, horizontal scroll, complex timelines | **GSAP** |
| React / Next.js, declarative style | **Framer Motion** |
| whileInView entrance animations | **Framer Motion** |

This project uses **Framer Motion** (already a dependency). Do not add GSAP — it would
duplicate capability the bundle already pays for.

Note: the upstream skill shipped `references/gsap.md` and `references/framer.md`; neither was
vendored into this repo. Use the quick reference below and the official Framer Motion docs.

## Setup (Always Do First)

### GSAP
```bash
npm install gsap
```
```js
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger); // MUST call before any ScrollTrigger usage
```

### Framer Motion (Motion v12, 2025)
```bash
npm install motion   # new package name since mid-2025
# or: npm install framer-motion  — still works, same API
```
```js
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
// legacy: import { motion } from 'framer-motion'  — also valid
```

## Workflow

1. Interpret the user's intent to identify if GSAP or Framer Motion is the best fit.
3. Suggest the required package installation if not already present.
4. Implement the scaffold for the animation structure, adhering to the requested format (React components, hook requirements, or vanilla JS).
5. Apply the correct tools (scrolling vs in-view elements) ensuring accessibility options are present and hooks don't cause infinite re-renders.

## The 5 Most Common Scroll Patterns

Quick reference.

### 1. Fade-in on enter (GSAP)
```js
gsap.from('.card', {
  opacity: 0, y: 50, stagger: 0.15, duration: 0.8,
  scrollTrigger: { trigger: '.card', start: 'top 85%' }
});
```

### 2. Fade-in on enter (Framer Motion)
```jsx
<motion.div
  initial={{ opacity: 0, y: 40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-80px' }}
  transition={{ duration: 0.6 }}
/>
```

### 3. Scrub / scroll-linked (GSAP)
```js
gsap.to('.hero-img', {
  scale: 1.3, opacity: 0, ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
});
```

### 4. Scroll-linked (Framer Motion)
```jsx
const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
return <motion.div style={{ y }} />;
```

### 5. Pinned timeline (GSAP)
```js
const tl = gsap.timeline({
  scrollTrigger: { trigger: '.section', pin: true, scrub: 1, start: 'top top', end: '+=200%' }
});
tl.from('.title', { opacity: 0, y: 60 }).from('.img', { scale: 0.85 });
```

## Critical Rules (Apply Always)

- **GSAP**: always call `gsap.registerPlugin(ScrollTrigger)` before using it
- **GSAP scrub**: always use `ease: 'none'` — easing feels wrong when scrub is active
- **GSAP React**: use `useGSAP` from `@gsap/react`, never plain `useEffect` — it auto-cleans ScrollTriggers
- **GSAP debug**: add `markers: true` during development; remove before production
- **Framer**: `useTransform` output must go into `style` prop of a `motion.*` element, not a plain div
- **Framer Next.js**: always add `'use client'` at top of any file using motion hooks
- **Both**: animate only `transform` and `opacity` — avoid `width`, `height`, `box-shadow`
- **Accessibility**: always honour `prefers-reduced-motion`. This repo wraps the app in
  `<MotionConfig reducedMotion="user">`, which covers all Framer Motion animations at once
- **Restraint**: animation should enhance, never overwhelm

