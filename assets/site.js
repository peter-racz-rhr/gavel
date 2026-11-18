/* Shared motion for the Gavel website → window.GavelSite
   A plain script (not a module) so the pages also work when opened straight from disk. */
window.GavelSite = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Lite mode: touch screens and low-power devices keep the look but skip the expensive effects
  const LITE = (() => { try { const c = navigator.connection; return matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!c?.saveData; } catch { return false; } })();
  document.documentElement.classList.toggle('lite', LITE);
  try { const t = localStorage.getItem('gavel.theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch { }
  const isDark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  const LQ_URL = 'https://cdn.jsdelivr.net/npm/@liquefy-ui/core@1.2.0/dist/index.mjs';

  /* headline: split words so they can rise one after another */
  function splitWords(el) {
    if (!el) return;
    let i = 0;
    for (const ch of [...el.childNodes]) {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach(w => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.append(' '); return; }
          const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = w; frag.append(s);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) { ch.classList.add('w'); ch.style.setProperty('--i', i++); }
    }
  }

  /* reveal on scroll: CSS scroll-driven animations where supported (nothing is ever left hidden),
     otherwise a gentle fade-in when each block comes into view */
  function reveal() {
    if (reduced || CSS.supports?.('animation-timeline: view()') || !('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('io-rv');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: .08 });
    document.querySelectorAll('.rv').forEach(e => {
      if (e.getBoundingClientRect().top < innerHeight) e.classList.add('in'); else io.observe(e);
    });
  }

  /* nav: frosted once you scroll, a clear Liquefy UI glass capsule where the browser supports it */
  function nav() {
    const n = document.querySelector('.nav'); if (!n) return;
    let lastY = scrollY;
    const onScroll = () => {
      const y = scrollY;
      n.classList.toggle('scrolled', y > 24);
      // slide away while scrolling down, come back as soon as you scroll up
      if (y > 120 && y > lastY + 4) n.classList.add('away');
      else if (y < lastY - 4 || y <= 120) n.classList.remove('away');
      lastY = y;
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    if (LITE) return;
    import(LQ_URL).then(({ attachGlassMerge, SpringValue }) => {
      const el = document.createElement('div'); el.id = 'site-glass'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el);
      const ctl = attachGlassMerge(el, { bezel: 16, strength: 1 });
      if (ctl.mode !== 'lens') { ctl.destroy(); el.remove(); return; }
      document.body.classList.add('lq-nav');
      const inner = n.querySelector('.nav-in'), show = new SpringValue(0, { stiffness: 170, damping: 20 });
      let last = performance.now(), key = '';
      const frame = now => {
        requestAnimationFrame(frame);
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        show.setTarget(n.classList.contains('scrolled') ? 1 : 0); show.step(dt);
        const v = Math.max(0, show.current), r = inner.getBoundingClientRect();
        const shapes = v < .02 ? [] : [{ x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width * (.94 + .06 * v), height: r.height * (.7 + .3 * v), radius: r.height / 2 }];
        const k = shapes.map(s => [s.x, s.y, s.width, s.height].map(x => x.toFixed(1)).join()).join();
        if (k !== key) { key = k; ctl.setShapes(shapes); }
      };
      requestAnimationFrame(frame);
    }).catch(() => { });
  }

  /* spinning globe (cobe, MIT) */
  async function globe(canvas, { markers = [], phi = 0, theta = .3, speed = .0025, dark } = {}) {
    if (!canvas) return;
    try {
      const { default: createGlobe } = await import('https://cdn.jsdelivr.net/npm/cobe@2.0.1/dist/index.esm.js');
      const dpr = Math.min(devicePixelRatio || 1, LITE ? 1.5 : 2);
      let size = canvas.offsetWidth || 600;
      const d = dark ?? isDark();
      const g = createGlobe(canvas, {
        devicePixelRatio: dpr, width: size, height: size, phi, theta, mapSamples: LITE ? 9000 : 20000, scale: 1, offset: [0, 0], opacity: .9,
        dark: d ? 1 : 0, diffuse: d ? 1.25 : 1.35, mapBrightness: d ? 5.5 : 7, mapBaseBrightness: 0,
        baseColor: d ? [.32, .33, .38] : [1, 1, 1], glowColor: d ? [.2, .23, .36] : [.86, .89, .98], markerColor: d ? [.51, .6, 1] : [.15, .27, .84],
        markers, markerElevation: .01,
      });
      let off = false;
      try { new IntersectionObserver(([e]) => { off = !e.isIntersecting; }).observe(canvas); } catch { }
      const loop = () => {
        if (!canvas.isConnected) { g.destroy(); return; }
        requestAnimationFrame(loop);
        if (off || document.hidden) return;
        if (!reduced) phi += speed;
        const w = canvas.offsetWidth, u = { phi };
        if (w && Math.abs(w - size) > 1) { size = w; u.width = size; u.height = size; }
        g.update(u);
      };
      requestAnimationFrame(loop);
      canvas.style.opacity = 1;
    } catch { }
  }

  function confetti(opts) {
    if (reduced) return;
    const go = () => window.confetti?.(Object.assign({ colors: ['#8299FF', '#4CC77F', '#F5C451', '#FF8A7A', '#ffffff'] }, opts));
    if (window.confetti) return go();
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.js'; s.onload = go; document.head.appendChild(s);
  }

  const GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  const LOGO = '<span class="mark" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 13-8.5 8.5a2.12 2.12 0 0 1-3-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg></span>';
  const fillLogos = () => document.querySelectorAll('[data-logo]').forEach(e => e.outerHTML = LOGO);
  const flagUrl = (code, w = 160) => `https://flagcdn.com/w${w}/${code}.png`;
  return { reduced, LITE, isDark, splitWords, reveal, nav, globe, confetti, GOOGLE_G, LOGO, fillLogos, flagUrl };
})();
