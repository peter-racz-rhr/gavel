/*
 * Gavel plans and prices — one place for the website and the app.
 * Change a price here and it changes everywhere. Checkout links live in config.js.
 */
window.GAVEL_PLANS = {
  trialDays: 14,          // every new account gets Pro free for this long, no card
  freeSessions: 3,        // the Free plan keeps this many saved sessions
  monthly: { price: 4 },
  yearly: { price: 29 },
  pass: { price: 6, days: 7 },     // one-off Conference Pass
  secretariat: { from: 79 },       // whole-conference licence, by email
};
