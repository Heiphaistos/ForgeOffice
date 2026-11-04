// Gestes tactiles reels par CDP (Input.dispatchTouchEvent) : toucher, appui long, glisser, pincement, deux doigts, saisie IME.
// Utilise le navigateur de harness.mjs (emulation tactile : b.viewport(w, h, true)).
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function touchKit(b) {
  const touch = (type, points) => b.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1, radiusX: 8, radiusY: 8, force: 0.5 })) });

  const kit = {
    /** Position (centre) d'un element visible : selecteur CSS, ou `text=...` (texte exact d'un bouton, onglet, item). */
    async where(target) {
      const r = await b.ev(`(() => {
        const t = ${JSON.stringify(target)};
        const els = t.startsWith('text=') ? [...document.querySelectorAll('button,[role=menuitem],[role=tab],a,label,[role=option],li,span')].filter((e) => e.textContent.trim() === t.slice(5)) : [...document.querySelectorAll(t)];
        const e = els.find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); if (!e) return null;
        e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = e.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
      })()`);
      if (!r) throw new Error(`introuvable: ${target}`);
      return r;
    },
    async tap(x, y, settle = 180) {
      await touch('touchStart', [{ x, y }]);
      await sleep(40);
      await touch('touchEnd', []);
      await sleep(settle);
    },
    async tapEl(target) {
      const r = await kit.where(target);
      await kit.tap(r.x, r.y);
      return r;
    },
    async doubleTap(x, y) {
      await kit.tap(x, y, 30);
      await kit.tap(x, y);
    },
    async longPress(x, y, ms = 700) {
      await touch('touchStart', [{ x, y }]);
      await sleep(ms);
      await touch('touchEnd', []);
      await sleep(250);
    },
    /** Glisse un doigt de (x1,y1) a (x2,y2) ; `holdMs` = attente avant de bouger (appui long puis glisser). */
    async drag(x1, y1, x2, y2, { steps = 10, stepMs = 16, holdMs = 0 } = {}) {
      await touch('touchStart', [{ x: x1, y: y1 }]);
      if (holdMs) await sleep(holdMs);
      for (let i = 1; i <= steps; i++) {
        await touch('touchMove', [{ x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps }]);
        await sleep(stepMs);
      }
      await touch('touchEnd', []);
      await sleep(250);
    },
    /** Pincement centre en (cx, cy), ecart de d0 a d1 px (horizontal). */
    async pinch(cx, cy, d0, d1, { steps = 12, stepMs = 16 } = {}) {
      const at = (d) => [{ x: cx - d / 2, y: cy }, { x: cx + d / 2, y: cy }];
      await touch('touchStart', at(d0));
      for (let i = 1; i <= steps; i++) {
        await touch('touchMove', at(d0 + ((d1 - d0) * i) / steps));
        await sleep(stepMs);
      }
      await touch('touchEnd', []);
      await sleep(250);
    },
    /** Deux doigts qui glissent ensemble (defilement a deux doigts). */
    async twoFingerDrag(cx, cy, dx, dy, { steps = 10, stepMs = 16, gap = 60 } = {}) {
      const at = (ox, oy) => [{ x: cx - gap / 2 + ox, y: cy + oy }, { x: cx + gap / 2 + ox, y: cy + oy }];
      await touch('touchStart', at(0, 0));
      for (let i = 1; i <= steps; i++) {
        await touch('touchMove', at((dx * i) / steps, (dy * i) / steps));
        await sleep(stepMs);
      }
      await touch('touchEnd', []);
      await sleep(250);
    },
    /** Composition IME (clavier Android/prediction) : evenements compositionstart/update/end reels sur l'element focalise. */
    async compose(steps, finalText) {
      for (const s of steps) {
        await b.send('Input.imeSetComposition', { text: s, selectionStart: s.length, selectionEnd: s.length });
        await sleep(60);
      }
      await b.send('Input.insertText', { text: finalText });
      await sleep(150);
    },
    /** Pilote la fenetre visuelle comme un clavier virtuel ouvert de `kb` px (le navigateur de bureau n'en a pas). */
    async fakeKeyboard(kb) {
      await b.ev(`(() => {
        const vv = window.visualViewport; if (!window.__vv) { window.__vv = { h: vv.height }; }
        Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - ${kb} });
        vv.dispatchEvent(new Event('resize'));
      })()`);
      await sleep(400);
    },
    async mount(app, url, w = 390, h = 844, wait = 1500) {
      await b.viewport(w, h, true);
      await b.goto(url(app), wait);
    },
  };
  return kit;
}
