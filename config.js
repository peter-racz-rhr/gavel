/*
 * Gavel configuration.
 *
 * Paste your Firebase web app config below (see SETUP.md). While apiKey is
 * empty the whole site runs in DEMO MODE: sign-in uses a local demo account and
 * sessions stay in this browser, so you can try every page before connecting anything.
 *
 * These values are not secret: Firebase web keys are meant to be public.
 * Your data is protected by the rules in firestore.rules.
 */
window.GAVEL_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyBOeKk49Ike58L1i4Tc74fAPKEJpaKJC3s',   // Firebase → Project settings → General → Your apps → Gavel web
    authDomain: 'gavel-mun-e80c5.firebaseapp.com',
    projectId: 'gavel-mun-e80c5',
    storageBucket: 'gavel-mun-e80c5.firebasestorage.app',
    messagingSenderId: '607539536449',
    appId: '1:607539536449:web:89fb6a0f52f1901ca7dcc0',
  },
  // Lemon Squeezy checkout links (Store → Products → Share). Empty = "payments open soon".
  // The free trial works without these. Prices are in assets/plans.js.
  billing: {
    monthly: '',             // e.g. 'https://gavel.lemonsqueezy.com/buy/xxxxxxxx'
    yearly: '',
    pass: '',
  },
  contactEmail: '',          // shown on the privacy, terms and pricing pages, e.g. 'hello@gavel-mun.com'
};
