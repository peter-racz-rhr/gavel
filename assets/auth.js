/*
 * Accounts and cloud storage for Gavel → window.GavelAuth
 * Real mode: Firebase (Google sign-in + Firestore, protected by firestore.rules).
 * Demo mode (no keys in config.js): a local demo account, nothing leaves the browser.
 * A plain script (not a module) so the site also works when opened straight from disk.
 *
 * Firestore layout:
 *   users/{uid}                 profile: full_name, role, experience, conference, onboarded, updated_at
 *   users/{uid}/sessions/{id}   { data: <session as JSON text>, deleted, updated_at }
 */
window.GavelAuth = (() => {
  const C = window.GAVEL_CONFIG || {}, F = C.firebase || {};
  const DEMO = !F.apiKey || !F.projectId;
  const BASE = new URL('..', document.currentScript.src).href;      // site root, works in a sub-folder too
  const href = path => new URL(path, BASE).href;
  const SDK = 'https://www.gstatic.com/firebasejs/11.10.0/';

  let clientP = null;
  /** Loads Firebase once → { auth, db, A (auth functions), S (Firestore functions) }. */
  const client = () => DEMO ? Promise.resolve(null) : clientP ||= (async () => {
    const [{ initializeApp }, A, S] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
    const app = initializeApp(F);
    const auth = A.getAuth(app);
    let db;
    try { db = S.initializeFirestore(app, { localCache: S.persistentLocalCache() }); } catch { db = S.getFirestore(app); }
    await A.getRedirectResult(auth).catch(() => { });   // finishes a redirect sign-in (used when popups are blocked)
    await auth.authStateReady();
    return { auth, db, A, S };
  })();

  const DEMO_USER = 'gavel.demoUser', DEMO_PROFILE = 'gavel.demoProfile';
  const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { } };
  const ERR = {
    'auth/unauthorized-domain': 'This web address is not allowed yet. Add it in Firebase → Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'Google sign-in is not switched on yet. Turn it on in Firebase → Authentication → Sign-in method.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
  };
  const nice = e => Object.assign(new Error(ERR[e?.code] || e?.message || 'Google sign-in is not available right now.'), { code: e?.code });

  /** The signed-in user as { id, email, name, avatar } or null. */
  async function getUser() {
    if (DEMO) return read(DEMO_USER);
    const { auth } = await client();
    const u = auth.currentUser; if (!u) return null;
    return { id: u.uid, email: u.email || '', name: u.displayName || (u.email || '').split('@')[0], avatar: u.photoURL || '' };
  }
  async function signInWithGoogle() {
    if (DEMO) { write(DEMO_USER, { id: 'demo', email: 'demo@gavel.local', name: 'Demo Chair', avatar: '' }); location.href = href('login.html?next=1'); return; }
    const { auth, A } = await client();
    const provider = new A.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await A.signInWithPopup(auth, provider); }
    catch (e) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') throw Object.assign(new Error('Sign-in was cancelled.'), { code: e.code });
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') { await A.signInWithRedirect(auth, provider); return; }
      throw nice(e);
    }
    location.href = href('login.html?next=1');
  }
  async function signOut() {
    try { localStorage.removeItem('gavel.uid'); } catch { }
    if (DEMO) write(DEMO_USER, null);
    else { const { auth, A, db, S } = await client(); await A.signOut(auth); try { await S.clearIndexedDbPersistence(db); } catch { } }
    location.href = href('index.html');
  }
  async function getProfile(user) {
    if (DEMO) return read(DEMO_PROFILE);
    const { db, S } = await client();
    const snap = await S.getDoc(S.doc(db, 'users', user.id));
    return snap.exists() ? { id: user.id, ...snap.data() } : null;
  }
  async function saveProfile(user, patch) {
    const row = { ...patch, updated_at: new Date().toISOString() };
    if (DEMO) { write(DEMO_PROFILE, { ...(read(DEMO_PROFILE) || {}), id: user.id, ...row }); return; }
    const { db, S } = await client();
    for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
    await S.setDoc(S.doc(db, 'users', user.id), row, { merge: true });
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

  /* sessions in the cloud: rows look like { id, data, deleted, updated_at } */
  const rowOf = d => {
    const v = d.data() || {};
    let data = {}; try { data = typeof v.data === 'string' ? JSON.parse(v.data) : (v.data || {}); } catch { }
    return { id: d.id, data, deleted: !!v.deleted, updated_at: v.updated_at || '' };
  };
  const sessions = (db, S, user) => S.collection(db, 'users', user.id, 'sessions');
  async function pullSessions(user) {
    if (DEMO) return [];
    const { db, S } = await client();
    const snap = await S.getDocs(sessions(db, S, user));
    return snap.docs.map(rowOf);
  }
  async function pushSession(user, s) {
    if (DEMO) return;
    const { db, S } = await client();
    await S.setDoc(S.doc(sessions(db, S, user), s.id), { data: JSON.stringify(s), deleted: false, updated_at: new Date(s.updated || Date.now()).toISOString() });
  }
  async function removeSession(user, id) {
    if (DEMO) return;
    const { db, S } = await client();
    await S.setDoc(S.doc(sessions(db, S, user), id), { data: '{}', deleted: true, updated_at: new Date().toISOString() });
  }
  async function watchSessions(user, onRow) {
    if (DEMO) return () => { };
    const { db, S } = await client();
    return S.onSnapshot(sessions(db, S, user), snap => {
      for (const ch of snap.docChanges()) if (ch.type !== 'removed' && !ch.doc.metadata.hasPendingWrites) onRow(rowOf(ch.doc));
    }, () => { });
  }
  return { DEMO, BASE, href, client, getUser, signInWithGoogle, signOut, getProfile, saveProfile, nextPage, requireUser, pullSessions, pushSession, removeSession, watchSessions };
})();
