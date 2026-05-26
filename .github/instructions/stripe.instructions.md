---
applyTo: '**/*.{js,jsx,ts,tsx,json,env,md}'
description: 'Use Stripe AI skills for any payment, billing, or Stripe integration work.'
---

# Stripe Integration Standards

When any work involves Stripe — payments, subscriptions, webhooks, Connect, billing, API keys, or SDK usage — load and follow the relevant Stripe skills:

- **`stripe-best-practices`**: API selection, Connect setup, billing, webhooks, security (API keys, restricted keys, OAuth). Use for any Stripe integration decision.
- **`upgrade-stripe`**: Upgrading Stripe API versions or SDKs. Always target the latest API version (`2026-04-22.dahlia`) unless user specifies otherwise.
- **`stripe-projects`**: Provisioning Stripe accounts or API keys via projects.dev.

## Key Rules

- Always prefer **Restricted API Keys** (`rk_` prefix) over Secret Keys (`sk_` prefix).
- Never hardcode API keys — use environment variables.
- Always verify webhook signatures before processing events.
- Use **Checkout Sessions** for simple flows; **PaymentIntents** when you need full control.
- Keep `STRIPE_SECRET_KEY` server-side only — never expose to client/browser.
