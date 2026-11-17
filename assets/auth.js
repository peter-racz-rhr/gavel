/*
 * Accounts and cloud storage for Gavel → window.GavelAuth
 * Real mode: Supabase (Google sign-in + Postgres with row-level security).
 * Demo mode (no keys in config.js): a local demo account, nothing leaves the browser.
 * A plain script (not a module) so the site also works when opened straight from disk.
 */
window.GavelAuth = (() => {
  const C = window.GAVEL_CONFIG || {};
  const DEMO = !C.supabaseUrl || !C.supabaseAnonKey;
  const BASE = new URL('..', document.currentScript.src).href;      // site root, works in a sub-folder too
  const href = path => new URL(path, BASE).href;

  let clientP = null;
  const client = () => DEMO ? Promise.resolve(null) : clientP ||= import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm')
    .then(m => m.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }));

  const DEMO_USER = 'gavel.demoUser', DEMO_PROFILE = 'gavel.demoProfile';
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { } };

  /** The signed-in user as { id, email, name, avatar } or null. */
  async function getUser() {
    if (DEMO) return read(DEMO_USER);
    const sb = await client();
    const { data } = await sb.auth.getSession();
    const u = data.session?.user; if (!u) return null;
    const m = u.user_metadata || {};
    return { id: u.id, email: u.email, name: m.full_name || m.name || (u.email || '').split('@')[0], avatar: m.avatar_url || m.picture || '' };
  }
  async function signInWithGoogle() {
    if (DEMO) { write(DEMO_USER, { id: 'demo', email: 'demo@gavel.local', name: 'Demo Chair', avatar: '' }); location.href = href('login.html?next=1'); return; }
    const sb = await client();
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: href('login.html?next=1'), queryParams: { prompt: 'select_account' } } });
    if (error) throw error;
  }
  async function signOut() {
    try { localStorage.removeItem('gavel.uid'); } catch { }
    if (DEMO) write(DEMO_USER, null);
    else { const sb = await client(); await sb.auth.signOut(); }
    location.href = href('index.html');
  }
  async function getProfile(user) {
    if (DEMO) return read(DEMO_PROFILE);
    const sb = await client();
    const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    return data;
  }
  async function saveProfile(user, patch) {
    const row = { id: user.id, ...patch, updated_at: new Date().toISOString() };
    if (DEMO) { write(DEMO_PROFILE, { ...(read(DEMO_PROFILE) || {}), ...row }); return; }
    const sb = await client();
    const { error } = await sb.from('profiles').upsert(row);
    if (error) throw error;
  }
  /** Where a signed-in person should land next. */
  async function nextPage(user) {
    const p = await getProfile(user).catch(() => null);
    return p?.onboarded ? href('app/index.html') : href('onboarding.html');
  }
  /** Sends people who are not signed in to the sign-in page. */
  async function requireUser() {
    const u = await getUser();
    if (!u) { location.replace(href('login.html')); return new Promise(() => { }); }
    try { localStorage.setItem('gavel.uid', u.id); } catch { }
    return u;
  }

  /* sessions in the cloud */
  async function pullSessions(user) {
    if (DEMO) return [];
    const sb = await client();
    const { data, error } = await sb.from('sessions').select('id,data,deleted,updated_at').eq('user_id', user.id);
    if (error) throw error;
    return data || [];
  }
  async function pushSession(user, s) {
    if (DEMO) return;
    const sb = await client();
    const { error } = await sb.from('sessions').upsert({ user_id: user.id, id: s.id, data: s, deleted: false, updated_at: new Date(s.updated || Date.now()).toISOString() });
    if (error) throw error;
  }
  async function removeSession(user, id) {
    if (DEMO) return;
    const sb = await client();
    const { error } = await sb.from('sessions').upsert({ user_id: user.id, id, data: {}, deleted: true, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  async function watchSessions(user, onRow) {
    if (DEMO) return () => { };
    const sb = await client();
    const ch = sb.channel('sessions-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `user_id=eq.${user.id}` }, p => p.new && onRow(p.new))
      .subscribe();
    return () => sb.removeChannel(ch);
  }
  return { DEMO, BASE, href, client, getUser, signInWithGoogle, signOut, getProfile, saveProfile, nextPage, requireUser, pullSessions, pushSession, removeSession, watchSessions };
})();
