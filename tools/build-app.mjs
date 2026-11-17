// Builds app/index.html from the Gavel app source.
// Usage (from the gavel-web folder):  node tools/build-app.mjs
// After changing the app, copy the new single-file app over tools/app-source.html and run this again.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
let s = readFileSync(root + 'tools/app-source.html', 'utf8');
const R = (a, b) => { if (!s.includes(a)) throw new Error('Could not find: ' + a.slice(0, 80)); s = s.split(a).join(b); };

R(/<title>[^<]*<\/title>/.exec(s)[0], '<title>Gavel</title>');
const head = `<script src="../config.js"></script>
<script>(function () { var u = null; try { u = localStorage.getItem('gavel.uid'); } catch (e) { } window.GAVEL_STORE = 'gavel.v1:' + (u || 'anon'); document.documentElement.classList.add('auth-wait'); })();</script>
<style>
.auth-wait #app{visibility:hidden}
.acct{position:relative;display:grid;place-items:center;width:34px;height:34px;margin-left:4px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font:600 14px var(--sans);overflow:visible;flex:none}
.acct img,.acct span{width:100%;height:100%;border-radius:50%;object-fit:cover;display:grid;place-items:center}
.acct i{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;border:2px solid var(--bg);background:var(--faint);transition:background-color .3s}
.acct[data-sync="synced"] i{background:var(--yes)} .acct[data-sync="syncing"] i{background:var(--accent);animation:livepulse 1.2s infinite} .acct[data-sync="offline"] i{background:var(--abs)}
.acct-card{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:6px 0 4px}
.acct-av{width:72px;height:72px;border-radius:24px;display:grid;place-items:center;overflow:hidden;background:var(--accent-soft);color:var(--accent);font:650 28px var(--sans);margin-bottom:8px}
.acct-av img{width:100%;height:100%;object-fit:cover}
.acct-card h2{font:600 20px/1.2 var(--sans);letter-spacing:-.02em}
.acct-sync{display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:8px 14px;border-radius:99px;background:var(--surface-2);font-size:13px;color:var(--ink-2)}
.acct-sync i{width:8px;height:8px;border-radius:50%;background:var(--faint)}
.acct-sync[data-sync="synced"] i{background:var(--yes)} .acct-sync[data-sync="syncing"] i{background:var(--accent)} .acct-sync[data-sync="offline"] i{background:var(--abs)}
</style>
`;
const i = s.indexOf('<script>');
s = s.slice(0, i) + head + s.slice(i);
const j = s.lastIndexOf('</body>');
s = s.slice(0, j) + '<script src="../assets/auth.js"></script>\n<script src="cloud.js"></script>\n' + s.slice(j);
writeFileSync(root + 'app/index.html', s);
console.log('app/index.html built (' + Math.round(s.length / 1024) + ' KB)');
