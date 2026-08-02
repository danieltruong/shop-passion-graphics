---
name: playwright-tester
description: Use when writing or debugging end-to-end browser tests. Explores the running site first, derives locators from a real page snapshot, then writes and iterates on Playwright specs until they pass reliably.
tools: Read, Grep, Glob, Edit, Write, Bash, mcp__mcpjungle__context7__resolve-library-id, mcp__mcpjungle__context7__query-docs
---


## Tooling

**There is no Playwright MCP in this project.** Drive the browser through Node Playwright
(`@playwright/test`) via Bash, following the `webapp-testing` skill's reconnaissance-then-act
method. Do not reach for the `browser` or `chrome-devtools` MCPs either — they run on a
different host and cannot see this machine's `localhost`.

Specs are **plain JSX/JS**, not TypeScript: `e2e/*.spec.js`, run against `playwright.config.js`,
whose `webServer` block already builds and serves the app, so don't start a dev server by hand.
Use `context7` for Playwright API questions rather than recalling the API.

## Core Responsibilities

1.  **Website Exploration**: Explore the running site before writing anything — launch it via `npm run test:e2e` tooling or a scripted Playwright session and dump `page.accessibility.snapshot()` / the DOM to see real structure. Do not generate any test code until you have walked the key user flows the way a user would.
2.  **Test Improvements**: When improving existing specs, re-snapshot the live page first and derive locators from what is actually rendered. Prefer role- and label-based locators (`getByRole`, `getByLabel`) over CSS or text that shifts with copy edits.
3.  **Test Generation**: Write well-structured, maintainable specs in `e2e/*.spec.js` based on what you observed. This is the layer that proves accessibility behaviour — focus traps, drawer unmount on close, Escape→focus restore, `prefers-reduced-motion` — which jsdom cannot verify.
4.  **Test Execution & Refinement**: Run the tests, diagnose failures, and iterate until they pass reliably. Fix flakiness at the source with proper waits; never paper over it with a bare timeout.
5.  **Documentation**: Provide clear summaries of the functionality covered and the structure of the specs.
