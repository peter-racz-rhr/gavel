/*
 * Gavel billing worker (Cloudflare Worker).
 * Lemon Squeezy sends a webhook when someone pays → this worker checks the signature
 * and writes the plan to that person's Firestore profile (users/{uid}).
 * The app watches the profile, so Pro unlocks live, a second after the payment.
 *
 * Secrets (wrangler secret put …):
 *   LS_SIGNING_SECRET    the webhook signing secret from Lemon Squeezy
 *   FIREBASE_SA          the whole service-account JSON from Firebase → Project settings → Service accounts
 * Vars (wrangler.toml):
 *   VARIANT_MONTHLY, VARIANT_YEARLY, VARIANT_PASS   Lemon Squeezy variant IDs
 *   PASS_DAYS                                       how long a Conference Pass lasts (default 7)
 */
const DAY = 864e5, GRACE = 3 * DAY;   // keep Pro a few days past a renewal date while the card retries

export default {
  async fetch(req, env) {
    if (req.method === 'GET') return new Response('Gavel billing is running.', { status: 200 });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const body = await req.text();
    if (!(await validSignature(body, req.headers.get('X-Signature') || '', env.LS_SIGNING_SECRET))) return new Response('Bad signature', { status: 401 });

    let ev; try { ev = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }
    const name = ev.meta?.event_name, uid = ev.meta?.custom_data?.uid, a = ev.data?.attributes || {};
    if (!uid || !/^[A-Za-z0-9_-]{6,128}$/.test(uid)) return new Response('No uid — ignored', { status: 200 });

    const variant = String(a.variant_id ?? a.first_order_item?.variant_id ?? '');
    const kind = variant === String(env.VARIANT_PASS) ? 'pass' : variant === String(env.VARIANT_MONTHLY) ? 'monthly' : variant === String(env.VARIANT_YEARLY) ? 'yearly' : null;
    const now = Date.now();
    let update = null;

    if (name === 'order_created' && kind === 'pass' && a.status === 'paid') {
      const current = await readUntil(env, uid);
      const from = Math.max(now, current || 0);
      update = { plan: 'pro', plan_kind: 'pass', plan_until: from + (Number(env.PASS_DAYS) || 7) * DAY, billing: { order: String(ev.data.id) } };
    } else if (name?.startsWith('subscription_') && kind && kind !== 'pass') {
      const status = a.status;   // on_trial, active, paused, past_due, unpaid, cancelled, expired
      const renews = Date.parse(a.renews_at || '') || 0, ends = Date.parse(a.ends_at || '') || 0;
      const portal = a.urls?.customer_portal || '';
      if (['active', 'on_trial', 'past_due'].includes(status)) update = { plan: 'pro', plan_kind: kind, plan_until: (renews || now + 31 * DAY) + GRACE, billing: { subscription: String(ev.data.id), portal } };
      else if (status === 'cancelled') update = { plan: 'pro', plan_kind: kind, plan_until: ends || now, billing: { subscription: String(ev.data.id), portal } };
      else if (['expired', 'unpaid', 'paused'].includes(status)) update = { plan: 'free', plan_kind: kind, plan_until: ends || now, billing: { subscription: String(ev.data.id), portal } };
    } else if (name === 'order_refunded') {
      update = { plan: 'free', plan_until: now };
    }
    if (!update) return new Response('Nothing to do', { status: 200 });

    await writeProfile(env, uid, update);
    return new Response('ok', { status: 200 });
  },
};

/* Lemon Squeezy signs the raw body with HMAC-SHA256 (hex) */
async function validSignature(body, sig, secret) {
  if (!secret || !sig) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const hex = [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/* ── Firestore REST with a service account ── */
let cached = { token: '', exp: 0 };
async function token(env) {
  if (cached.token && cached.exp - 60 > Date.now() / 1000) return cached.token;
  const sa = JSON.parse(env.FIREBASE_SA);
  const iat = Math.floor(Date.now() / 1000), exp = iat + 3600;
  const enc = o => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat, exp });
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + b64url(sig) }) });
  const j = await res.json(); if (!j.access_token) throw new Error('Google token failed: ' + JSON.stringify(j));
  cached = { token: j.access_token, exp };
  return j.access_token;
}
const b64url = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const docUrl = (env, uid) => `https://firestore.googleapis.com/v1/projects/${JSON.parse(env.FIREBASE_SA).project_id}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
const val = v => typeof v === 'number' ? { timestampValue: new Date(v).toISOString() } : typeof v === 'string' ? { stringValue: v } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };

async function readUntil(env, uid) {
  const r = await fetch(docUrl(env, uid), { headers: { Authorization: 'Bearer ' + await token(env) } });
  if (!r.ok) return 0;
  const d = await r.json(), f = d.fields || {};
  return f.plan?.stringValue === 'pro' && f.plan_until?.timestampValue ? Date.parse(f.plan_until.timestampValue) : 0;
}
async function writeProfile(env, uid, update) {
  const fields = Object.fromEntries(Object.entries(update).map(([k, v]) => [k, val(v)]));
  const mask = Object.keys(update).map(k => 'updateMask.fieldPaths=' + k).join('&');
  const r = await fetch(docUrl(env, uid) + '?' + mask, { method: 'PATCH', headers: { Authorization: 'Bearer ' + await token(env), 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error('Firestore write failed: ' + r.status + ' ' + await r.text());
}
