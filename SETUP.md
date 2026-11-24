# Going live with Firebase

The whole site already works in **demo mode** (no keys): the Google button signs you in to a local demo account and everything stays in the browser. After these steps you get real Google sign-in and sessions saved to each account, synced between devices.

About **15 minutes**. Follow the steps in order.

---

## 1. Add a web app to your Firebase project (3 min)

1. Open **https://console.firebase.google.com** and pick your project.
2. On the project overview page, click the **`</>`** (Web) icon under "Get started by adding Firebase to your app".
3. App nickname: `Gavel web`. Leave **Firebase Hosting unticked** (the site is on Cloudflare). Click **Register app**.
4. You see a code block with `const firebaseConfig = { … }`. Keep this page open for step 4.
   (You can find it again any time: ⚙️ **Project settings** → **General** → **Your apps**.)

## 2. Turn on Google sign-in (2 min)

1. Left menu: **Build** → **Authentication** → **Get started**.
2. **Sign-in method** tab → **Google** → switch **Enable** on.
3. Pick your email as **Project support email** → **Save**.
4. **Settings** tab → **Authorized domains** → **Add domain** and add:
   - `gavel.peter-racz-rhr.workers.dev`
   - your own domain later, if you get one
   (`localhost` is already there, so testing on your computer works.)

## 3. Create the database (3 min)

1. Left menu: **Build** → **Firestore Database** → **Create database**.
2. Location: **eur3 (Europe)** or **europe-west3 (Frankfurt)**. This matters for GDPR and **cannot be changed later**.
3. Choose **Start in production mode** → **Create**.
4. Open the **Rules** tab, delete everything there, paste the full contents of `firestore.rules` from this repo, and click **Publish**.

The rules make sure everyone can read and write only their own profile and sessions.

## 4. Paste the keys into `config.js` (1 min)

Copy the values from the `firebaseConfig` block of step 1 into `config.js`:

```js
window.GAVEL_CONFIG = {
  firebase: {
    apiKey: 'AIza...',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project',
    storageBucket: 'your-project.firebasestorage.app',
    messagingSenderId: '1234567890',
    appId: '1:1234567890:web:abc123',
  },
  contactEmail: 'you@example.com',
};
```

These keys are **not secret**. Firebase web keys are designed to sit in public code; the rules from step 3 protect the data.

## 5. Publish (2 min)

Commit and push to the `gavel` repo on GitHub (or ask Claude to). Cloudflare redeploys automatically within about a minute.

## 6. Try it

1. Open `https://gavel.peter-racz-rhr.workers.dev` → **Start free with Google** → a Google window opens → pick your account.
2. Go through onboarding → your first committee is created → Gavel opens.
3. The **green dot** on your profile picture (top right) means your sessions are saved to your account.
4. Open the site on your phone and sign in with the same Google account: your sessions are there.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| "This web address is not allowed yet" | Firebase → Authentication → Settings → **Authorized domains**: add the address you opened the site from. |
| "Google sign-in is not switched on yet" | Firebase → Authentication → Sign-in method → Google → **Enable**. |
| Nothing happens when you click the Google button | The browser blocked the pop-up. Allow pop-ups for the site, or try again: Gavel then falls back to a full-page sign-in. |
| Orange dot on the profile picture | No internet, the rules weren't published, or a key in `config.js` is wrong. Everything stays on the device and syncs later. |
| Sign-in works on the computer but not when opening the file directly | Sign-in needs a real web address (`https://…` or `localhost`), not `file://`. |

## Taking payments (when you are ready to sell)

Until you do this, everything already works: Free, the 14-day trial (no card), and the paywall. The "Continue" button just says payments open soon.

**Prices** are in `assets/plans.js` (Pro €4/month or €29/year, Conference Pass €6 for 7 days, Secretariat from €79). Change them there and the site and the app follow.

1. **Lemon Squeezy store (~20 min).** Sign up at https://lemonsqueezy.com (an adult must own the account; they handle VAT and invoices as merchant of record). Create one product **Gavel Pro** with two subscription variants (**Monthly** €4, **Yearly** €29) and one product **Conference Pass** (single payment €6). For each, under *Confirmation modal → Button link*, put `https://gavel.peter-racz-rhr.workers.dev/app/`.
2. **Checkout links.** For each variant copy its *Share* link (`https://….lemonsqueezy.com/buy/…`) into `config.js` → `billing.monthly`, `billing.yearly`, `billing.pass`. Note each variant's **ID** too.
3. **Service account.** Firebase → ⚙️ Project settings → **Service accounts** → **Generate new private key**. It downloads a JSON file. It **is secret**: never commit it.
4. **Deploy the billing worker** (from this repo, needs Node):
   ```
   cd billing-worker
   npx wrangler login
   npx wrangler secret put FIREBASE_SA        (paste the whole JSON file)
   npx wrangler secret put LS_SIGNING_SECRET  (make up a long random string)
   ```
   Put the three variant IDs into `billing-worker/wrangler.toml`, then `npx wrangler deploy`. It prints the worker address, e.g. `https://gavel-billing.<you>.workers.dev`.
5. **Webhook.** Lemon Squeezy → Settings → **Webhooks** → add the worker address, the same signing secret, and tick `order_created`, `order_refunded`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`.
6. Push. Buy a plan in Lemon Squeezy's **test mode** with card `4242 4242 4242 4242`: Pro unlocks in the open app within a second or two.

## Free limits (Spark plan)

Free with no time limit, and the project never pauses. Every day you get 50,000 reads, 20,000 writes and 1 GB of storage. A chaired session uses a few dozen writes, so this is enough for thousands of sessions a month.

## Files

- `index.html`: landing page
- `login.html`: Google sign-in
- `onboarding.html`: first-time setup after the first sign-in
- `app/`: the Gavel app (`app/cloud.js` handles sync and the account menu)
- `view.html`: the delegate page opened from the QR code
- `privacy.html`, `terms.html`
- `config.js`: **the keys go here**
- `firestore.rules`: database rules
- `assets/auth.js`: sign-in and cloud storage (Firebase)
- `tools/build-app.mjs`: after changing the Gavel app, copy the new file over `tools/app-source.html` and run `node tools/build-app.mjs`
