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
    apiKey: '',              // Firebase → Project settings → General → Your apps → Web app → SDK setup and configuration
    authDomain: '',          // e.g. 'gavel-12345.firebaseapp.com'
    projectId: '',           // e.g. 'gavel-12345'
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  contactEmail: '',          // shown on the privacy and terms pages, e.g. 'hello@gavel-mun.com'
};
