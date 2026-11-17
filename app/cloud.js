/*
 * Gavel app ↔ account. Runs after the app script:
 * checks the sign-in, applies the onboarding choices, adds the account menu,
 * and keeps sessions in sync with the cloud (offline-first: this device saves
 * first, the cloud catches up when it can). A plain script so it also runs from disk.
 */
(async () => {
const { DEMO, href, requireUser, getProfile, pullSessions, pushSession, removeSession, watchSessions, signOut } = window.GavelAuth;
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
    <div class="acct-sync" data-sync="${status}"><i></i><span>${STATUS[status]}</span></div>
  </div>
  <div class="mfoot"><a class="btn ghost" href="${href('index.html')}">Website</a><span class="grow"></span><button class="btn soft" data-m="out">Sign out</button></div>`,
  m => { m.querySelector('[data-m="out"]').addEventListener('click', () => signOut()); }, { label: 'Account', cls: 'narrow' });
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
