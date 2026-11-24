# Gavel

The calm way to chair Model UN: roll call with flags, speakers lists and timers, caucuses, motions, recorded votes and a live projector view.

- `index.html` — website
- `login.html` — Google sign-in
- `onboarding.html` — first-time setup
- `app/` — the Gavel app (`app/cloud.js` syncs sessions to your account)
- `view.html` — delegate page opened from the QR code (a snapshot packed into the link)
- `privacy.html`, `terms.html`
- `config.js` — Firebase keys (empty = demo mode)
- `pricing.html` — plans and prices
- `assets/plans.js` — prices, trial length and the Free limit (one place for site and app)
- `firestore.rules` — database rules (plans can only be written by the billing worker)
- `billing-worker/` — Cloudflare Worker that turns Lemon Squeezy payments into Pro (deployed separately)
- `SETUP.md` — how to go live

A static site: no build step. Deploy the repository root as it is (Cloudflare Workers or Pages, no build command).
