/*
 * Gavel app ↔ account. Runs after the app script:
 * checks the sign-in, applies the onboarding choices, adds the account menu,
 * and keeps sessions in sync with the cloud (offline-first: this device saves
 * first, the cloud catches up when it can). A plain script so it also runs from disk.
 */
(async () => {
const { DEMO, href, requireUser, getProfile, watchProfile, startTrial, pullSessions, pushSession, removeSession, watchSessions, signOut } = window.GavelAuth;
const user = await requireUser();
if (window.GAVEL_STORE !== 'gavel.v1:' + user.id) {
  // first visit on this device for this account: reopen with the right local store
  if (!sessionStorage.getItem('gavel.reloaded')) { sessionStorage.setItem('gavel.reloaded', '1'); location.reload(); return; }
}
sessionStorage.removeItem('gavel.reloaded');
if (PJ.role === 'projector') {   // a projector window only shows what the chair's window sends it
  document.documentElement.classList.remove('auth-wait');
  return;
}
const profile = await getProfile(user).catch(() => null);
if (!profile?.onboarded && !DEMO) { location.replace(href('onboarding.html')); return; }
if (!profile?.onboarded && DEMO && !db.sessions.length) { location.replace(href('onboarding.html')); return; }

window.GAVEL_USER = { name: profile?.full_name || user.name || '', email: user.email || '', avatar: user.avatar || '' };
window.GAVEL_SYNC = !DEMO;

/* plan: Free, a 14-day Pro trial, or Pro (paid, written to the profile by the billing worker) */
const PL = window.GAVEL_PLANS, BILL = (window.GAVEL_CONFIG || {}).billing || {};
const ms = v => !v ? 0 : typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : Date.parse(v) || 0;
function planOf(p) {
  const now = Date.now(), until = ms(p?.plan_until), trial = ms(p?.trial_started), trialEnd = trial + PL.trialDays * 864e5;
  if (p?.plan === 'pro' && (!until || until > now)) return { state: 'pro', pro: true, kind: p.plan_kind || 'yearly', until: until || null, portal: p.billing?.portal || null, trialUsed: true };
  if (trial && trialEnd > now) return { state: 'trial', pro: true, kind: 'trial', until: trialEnd, trialUsed: true };
  return { state: 'free', pro: false, trialUsed: !!trial || p?.plan === 'pro', expired: p?.plan === 'pro' };
}
const checkoutUrl = kind => {
  const base = BILL[kind]; if (!base) return '';
  const u = new URL(base);
  u.searchParams.set('checkout[custom][uid]', user.id);
  if (user.email && !DEMO) u.searchParams.set('checkout[email]', user.email);
  if (window.GAVEL_USER.name) u.searchParams.set('checkout[name]', window.GAVEL_USER.name);
  return u.href;
};
function setPlan(p) {
  window.GAVEL_PLAN = Object.assign(planOf(p), {
    pricingUrl: href('pricing.html'),
    checkout(kind) { const url = checkoutUrl(kind); if (!url) return false; const w = window.open(url, '_blank', 'noopener'); if (!w) location.href = url; return true; },
    startTrial: () => startTrial(user).then(np => { if (DEMO && np) setPlan(np); }),
  });
  window.dispatchEvent(new CustomEvent('gavel-plan'));
}
setPlan(profile);
watchProfile(user, p => { if (p) { window.GAVEL_LAST_PROFILE = p; setPlan(p); } }).catch(() => { });
setInterval(() => { const p = window.GAVEL_PLAN; if (p?.until && p.until < Date.now()) setPlan(window.GAVEL_LAST_PROFILE || profile); }, 60000);

/* delegations picked during onboarding */
for (const s of db.sessions) {
  if (!s._preset) continue;
  const list = s._preset === 'all' ? COUNTRIES.filter(c => !OBS.includes(c.code)).map(c => c.code) : (PRESETS[s._preset] || []);
  list.forEach(c => { if (!s.delegates.some(d => d.code === c)) addDelegate(s, c); });
  delete s._preset; s.updated = Date.now();
}
justAdded.clear();

/* account button + menu */
let status = DEMO ? 'demo' : 'syncing';
const initials = (window.GAVEL_USER.name || window.GAVEL_USER.email || 'G').trim()[0].toUpperCase();
window.acctHTML = () => `<button class="acct" data-a="acct" data-sync="${status}" aria-label="Account and sync" title="${esc(window.GAVEL_USER.email)}">${window.GAVEL_USER.avatar ? `<img alt="" src="${esc(window.GAVEL_USER.avatar)}" referrerpolicy="no-referrer">` : `<span>${esc(initials)}</span>`}<i></i></button>`;
const STATUS = { synced: 'All sessions are saved to your account', syncing: 'Syncing…', offline: 'Offline — saved on this device, will sync when you are back online', demo: 'Demo mode — saved in this browser only' };
A.acct = () => openModal(`<div class="acct-card">
    <div class="acct-av">${window.GAVEL_USER.avatar ? `<img alt="" src="${esc(window.GAVEL_USER.avatar)}" referrerpolicy="no-referrer">` : esc(initials)}</div>
    <h2>${esc(window.GAVEL_USER.name || 'Your account')}</h2><p class="muted">${esc(window.GAVEL_USER.email)}</p>
    <div class="acct-sync" data-sync="${status}"><i></i><span>${STATUS[status]}</span></div>${planCard()}
  </div>
  <div class="mfoot"><a class="btn ghost" href="${href('index.html')}">Website</a><span class="grow"></span><button class="btn soft" data-m="out">Sign out</button></div>`,
  m => {
    m.querySelector('[data-m="out"]').addEventListener('click', () => signOut());
    m.querySelector('[data-m="up"]')?.addEventListener('click', () => { closeModal(); setTimeout(() => A.paywall(), 200); });
  }, { label: 'Account', cls: 'narrow' });
const fmtDate = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
function planCard() {
  const p = window.GAVEL_PLAN; if (!p) return '';
  const KIND = { monthly: 'Pro monthly', yearly: 'Pro yearly', pass: 'Conference Pass' };
  if (p.state === 'pro') return `<div class="acct-plan pro"><b>${ic('spark', 15)} ${KIND[p.kind] || 'Gavel Pro'}</b><span>${p.until ? (p.kind === 'pass' ? 'Until ' : 'Paid until ') + fmtDate(p.until) : 'Active'}</span>${p.portal ? `<a class="btn sm soft" href="${esc(p.portal)}" target="_blank" rel="noopener">Manage billing</a>` : ''}</div>`;
  if (p.state === 'trial') return `<div class="acct-plan"><b>${ic('spark', 15)} Pro trial</b><span>${plural(daysLeft(p.until), 'day')} left · ends ${fmtDate(p.until)}</span><button class="btn sm primary" data-m="up">Choose a plan</button></div>`;
  return `<div class="acct-plan"><b>Free plan</b><span>${Math.min(db.sessions.length, window.GAVEL_PLANS.freeSessions)} of ${window.GAVEL_PLANS.freeSessions} sessions used</span><button class="btn sm primary" data-m="up">${ic('spark', 14)} Upgrade to Pro</button></div>`;
}
function setStatus(s) {
  status = s;
  document.querySelectorAll('[data-sync]').forEach(e => { e.dataset.sync = s; const t = e.querySelector('span:not(:first-child)'); if (e.classList.contains('acct-sync') && t) t.textContent = STATUS[s]; });
}

document.documentElement.classList.remove('auth-wait');
save(); render();

/* sync */
if (!DEMO) {
  const pushed = new Map();          // session id → the `updated` time the cloud already has
  let timer = null, busy = false;
  const push = async () => {
    if (busy) { schedule(800); return; }
    busy = true; setStatus('syncing');
    try {
      for (const s of db.sessions) {
        if ((s.updated || 0) > (pushed.get(s.id) || 0)) { await pushSession(user, s); pushed.set(s.id, s.updated || 0); }
      }
      setStatus('synced');
    } catch { setStatus('offline'); schedule(15000); }
    finally { busy = false; }
  };
  const schedule = ms => { clearTimeout(timer); timer = setTimeout(push, ms); };
  window.onGavelSave = () => schedule(1500);
  window.onGavelDelete = id => { pushed.set(id, Infinity); removeSession(user, id).catch(() => setStatus('offline')); };
  addEventListener('online', () => schedule(200));

  const merge = (r, quiet) => {
    const loc = db.sessions.find(s => s.id === r.id), ts = Date.parse(r.updated_at) || 0;
    if (r.deleted) {
      pushed.set(r.id, Infinity);
      if (loc && (loc.updated || 0) <= ts) { db.sessions = db.sessions.filter(s => s !== loc); if (route.id === r.id && !quiet) go('#/'); return true; }
      return false;
    }
    const remoteUpdated = r.data?.updated || ts;
    if (!loc) { db.sessions.push(normalize(r.data)); pushed.set(r.id, remoteUpdated); return true; }
    if (remoteUpdated > (loc.updated || 0)) { db.sessions[db.sessions.indexOf(loc)] = normalize(r.data); pushed.set(r.id, remoteUpdated); return true; }
    pushed.set(r.id, Math.max(pushed.get(r.id) || 0, remoteUpdated));
    return false;
  };
  const busyTyping = () => document.activeElement?.matches?.('input,textarea,select') || !!modal;
  let deferred = false;
  try {
    const rows = await pullSessions(user);
    let changed = false;
    for (const r of rows) changed = merge(r, true) || changed;
    if (changed) { save(); render(); }
    push();
    watchSessions(user, r => {
      if (!merge(r)) return;
      save();
      if (busyTyping()) deferred = true; else render();
    }).catch(() => { });
    document.addEventListener('focusout', () => { if (deferred && !busyTyping()) { deferred = false; render(); } });
    addEventListener('focus', async () => { try { let ch = false; for (const r of await pullSessions(user)) ch = merge(r) || ch; if (ch) { save(); if (!busyTyping()) render(); } } catch { } });
  } catch { setStatus('offline'); schedule(10000); }
}
})();
