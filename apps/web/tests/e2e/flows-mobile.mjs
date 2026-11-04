// Parcours 6 : disposition « téléphone » (400x860 tactile) des 9 applications.
// Mesure : défilement horizontal de la page, éléments interactifs hors écran (hors zones défilantes), zones de toucher < 24 px.
// Écrit une capture par application dans FO_MOBILE_SHOTS (défaut .logs/e2e-mobile) et une planche docs/captures/e2e-mobile-planche.png.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MEASURE = `(() => {
  const W = window.innerWidth;
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const scrollable = (e) => { for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if ((o === 'auto' || o === 'scroll') && n.scrollWidth > n.clientWidth) return true; } return false; };
  const label = (e) => (e.getAttribute('aria-label') || e.title || e.textContent || e.tagName).trim().slice(0, 30) + ' <' + e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + '>';
  const inter = [...document.querySelectorAll('button, a[href], input, select, textarea, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=radio]')].filter(visible);
  const off = inter.filter((e) => { const r = e.getBoundingClientRect(); return (r.right > W + 1 || r.left < -1) && !scrollable(e); });
  const small = inter.filter((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 24 && r.right > 0 && r.left < W; });
  const ribbon = document.querySelector('.fo-ribbon');
  return { W, scrollW: document.documentElement.scrollWidth, count: inter.length, off: off.length, offSample: off.slice(0, 5).map(label),
    small: small.length, smallSample: small.slice(0, 6).map(label), ribbonH: ribbon ? Math.round(ribbon.getBoundingClientRect().height) : null };
})()`;

// Planche : une <img> par capture, construite avec les methodes du DOM (pas de HTML injecte).
const SHEET = (images) => `(() => {
  document.body.replaceChildren();
  document.body.style.cssText = 'margin:0;background:#ddd;display:flex;flex-wrap:wrap;width:2050px';
  for (const src of ${JSON.stringify(images)}) { const i = document.createElement('img'); i.src = src; i.style.cssText = 'width:400px;height:860px;margin:4px;border:1px solid #888'; document.body.append(i); }
})()`;

export function flowsMobile({ b, ok, url, state, SHOTS, APPS, sleep }) {
  const mobileDir = process.env.FO_MOBILE_SHOTS ?? join(SHOTS, '..', '..', '.logs', 'e2e-mobile');

  async function p6() {
    const P = 6;
    mkdirSync(mobileDir, { recursive: true });
    await b.viewport(400, 860, true);
    const shots = [];
    for (const app of APPS) {
      await b.goto(url(app), 1800);
      const file = join(mobileDir, `mobile-${app}.png`);
      await b.shot(file);
      shots.push(file);
      const m = await b.ev(MEASURE);
      const s = await state();
      ok(P, `${app} : s’affiche sans erreur à 400 px`, !s.crashed && s.app === app);
      ok(P, `${app} : pas de défilement horizontal de la page`, m.scrollW <= m.W, `${m.scrollW} > ${m.W}`);
      ok(P, `${app} : aucun contrôle hors écran`, m.off === 0, `${m.off} : ${m.offSample.join(' ; ')}`);
      console.log(`INFO  [${P}] ${app} : ${m.count} contrôles, ${m.small} de moins de 24 px${m.small ? ` (${m.smallSample.join(' ; ')})` : ''}, ruban ${m.ribbonH ?? '-'} px`);
    }
    // Planche de contact (5 colonnes) pour revue visuelle.
    await b.viewport(2050, 1760, false);
    await b.ev(SHEET(shots.map((f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`)));
    await sleep(800);
    await b.shot(join(SHOTS, 'e2e-mobile-planche.png'));
    // Ruban tactile : un onglet touche, aucun plantage
    await b.viewport(400, 860, true);
    for (const app of ['word', 'excel', 'powerpoint', 'publisher', 'pdf', 'notes', 'convert']) {
      await b.goto(url(app), 1200);
      const tabs = await b.ev(`[...document.querySelectorAll('[role=tab]')].filter((t) => t.getBoundingClientRect().width > 0).length`);
      let tapped = true;
      try { await b.click('[role=tab]:nth-of-type(2)', { touch: true }); } catch { tapped = false; }
      ok(P, `${app} : onglets du ruban touchables`, tabs >= 3 && tapped && !(await state()).crashed, `${tabs} onglets`);
    }
    await b.viewport(1440, 900);
  }

  return { 6: p6 };
}
