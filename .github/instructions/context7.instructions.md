---
applyTo: '**'
description: 'Always use Context7 MCP for up-to-date library documentation.'
---

# Context7 — Library Documentation

Always use the `context7` MCP server when working with any library, framework, or API. Context7 provides current, version-accurate docs — never rely on training data alone for API signatures, config options, or changelogs.

## When to use Context7

- Looking up any library API, hook, component, or config option
- Verifying that a pattern is current (not deprecated)
- Checking migration guides between versions
- Any doubt about whether a third-party API still works as remembered

## How to use

Call `resolve-library-id` first to get the correct library ID, then `get-library-docs` with a focused topic query.

```
resolve-library-id: "framer-motion"
get-library-docs: library_id="/framer-motion/motion" topic="useScroll"
```

Prioritize Context7 docs over training knowledge for: React, Vite, Framer Motion, Stripe, Tailwind, and any other dependency in `package.json`.
