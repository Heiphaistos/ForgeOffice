// Adaptation de la fenetre : quelle que soit la largeur, aucune commande du ruban / des barres d'outils / des menus n'est cachee,
// coupee ou atteignable seulement par un defilement horizontal ; la page ne deborde pas ; le contenu n'est pas recouvert.
//   node apps/web/tests/e2e/responsive.mjs [--layouts=a,b] [--apps=word,excel] [--widths=480,640] [--dark] [--fit=wrap|scale|scroll] [--shots=dossier]
// Prerequis : banc lance (`FO_PORT=5471 npm run dev -w apps/web`) ; variables FO_BASE (defaut http://127.0.0.1:5471), FO_CDP_PORT (9871).
// Code 1 si au moins un cas echoue.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5471';
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=')[1] ?? d;
const ALL_LAYOUTS = 'office,office-simplified,onlyoffice,libreoffice,openoffice,menus-classic,ribbon-compact,google,dropdown,touch';
const layouts = arg('layouts', ALL_LAYOUTS).split(',');
const apps = arg('apps', 'word,excel,powerpoint,pdf').split(',');
const widths = arg('widths', '480,640,800,1024,1280,1440,1920').split(',').map(Number);
const fit = arg('fit', 'wrap');
const dark = process.argv.includes('--dark');
const shots = arg('shots', '');
if (shots) mkdirSync(shots, { recursive: true });

// Execute dans la page : liste des problemes de visibilite des commandes et de debordement.
const PROBE = `(() => {
  const issues = [];
  const doc = document.documentElement;
  const W = innerWidth, H = innerHeight;
  if (doc.scrollWidth > doc.clientWidth + 0.5) issues.push('page deborde: ' + doc.scrollWidth + ' > ' + doc.clientWidth);
  if (document.body.scrollWidth > W + 0.5) issues.push('body deborde: ' + document.body.scrollWidth);
  const roots = [...document.querySelectorAll('.fo-ribbon, .fo-tb, .fo-sb, .fo-menubar, .fo-suite-bar, .fo-doctabs')];
  const skip = (e) => e.closest('.fo-ribbon__measure, .fo-visually-hidden, .fo-popover, .fo-menu, [inert], .fo-sheet, .fo-kbbar, .fo-keytips');
  const clipAnc = (e, root) => { const out = []; for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') out.push({ n, x: cs.overflowX !== 'visible', y: cs.overflowY === 'hidden' || cs.overflowY === 'clip' }); if (n === root) break; } return out; };
  const seen = new Set();
  let n = 0;
  for (const root of roots) {
    // defilement horizontal cache : un conteneur plus etroit que son contenu
    for (const c of [root, ...root.querySelectorAll('*')]) {
      if (skip(c) || c.closest('.fo-oo-panel, .fo-oo-rail, .fo-ssb, .fo-gal')) continue;
      const cs = getComputedStyle(c);
      if (cs.display === 'none') continue;
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden') && c.scrollWidth > c.clientWidth + 1 && c.clientWidth > 0 && c.getBoundingClientRect().width > 3 && !c.matches('.fo-rb-btn__label') && !c.matches('input, select, textarea, .fo-oo-native__name') && !seen.has(c)) {
        seen.add(c); issues.push('contenu coupe: .' + String(c.className).split(' ').slice(0, 2).join('.') + ' ' + c.scrollWidth + ' > ' + c.clientWidth);
      }
    }
    for (const e of root.querySelectorAll('button, input:not([type=hidden]), select, [role=button], [role=tab], [role=menuitem]')) {
      if (skip(e) || seen.has(e)) continue;
      seen.add(e);
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0) continue;
      if (e.closest('.fo-oo-panel, .fo-oo-rail')) continue;
      n++;
      const tag = (e.getAttribute('aria-label') || e.title || e.textContent || e.className).toString().trim().slice(0, 28);
      if (r.left < -0.5 || r.right > W + 0.5) { issues.push('hors fenetre: ' + tag + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']'); continue; }
      let clipped = false;
      for (const a of clipAnc(e, root)) {
        const ar = a.n.getBoundingClientRect();
        if ((a.x && (r.left < ar.left - 1 || r.right > ar.right + 1)) || (a.y && (r.top < ar.top - 1 || r.bottom > ar.bottom + 1))) { clipped = true; break; }
      }
      if (clipped) { issues.push('rogne: ' + tag); continue; }
      const x = Math.min(W - 1, Math.max(1, r.left + r.width / 2)), y = Math.min(H - 1, Math.max(1, r.top + r.height / 2));
      if (r.top > H) { issues.push('sous le bord bas: ' + tag); continue; }
      const vs = (() => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const c2 = getComputedStyle(a); if ((c2.overflowY === 'auto' || c2.overflowY === 'scroll') && a.scrollHeight > a.clientHeight) { const ar = a.getBoundingClientRect(); if (r.bottom > ar.bottom || r.top < ar.top) return true; } } return false; })();
      if (vs) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && !(e === hit || e.contains(hit) || hit.contains(e)) && !hit.closest('.fo-ribbon__tabs')) issues.push('recouvert: ' + tag + ' <- ' + String(hit.className).slice(0, 30));
    }
  }
  // Groupes replies en un bouton (commande cachee derriere un menu) : seulement le groupe « Plus » d'OnlyOffice est admis.
  for (const g of document.querySelectorAll('.fo-rb-group--collapsed')) if (!skip(g) && !g.querySelector('[aria-label="Plus"], .fo-oo-more') && g.getAttribute('aria-label') !== 'Plus') issues.push('groupe replie: ' + g.getAttribute('aria-label'));
  // Le contenu qui suit le ruban ne passe pas dessous.
  const rb = document.querySelector('.fo-ribbon');
  if (rb && !rb.classList.contains('is-flyout')) {
    const rr = rb.getBoundingClientRect();
    let s = rb.nextElementSibling;
    while (s && (getComputedStyle(s).position === 'fixed' || getComputedStyle(s).position === 'absolute' || s.getBoundingClientRect().height === 0)) s = s.nextElementSibling;
    let tallest = 0;
    for (let q = rb.nextElementSibling; q; q = q.nextElementSibling) { const ps = getComputedStyle(q).position; if (ps !== 'fixed' && ps !== 'absolute') tallest = Math.max(tallest, q.getBoundingClientRect().height); }
    if (tallest < Math.min(160, H * 0.2)) issues.push('document ecrase: ' + Math.round(tallest) + ' px');
    if (s && s.getBoundingClientRect().top < rr.bottom - 1) issues.push('contenu sous le ruban: ' + s.className + ' ' + Math.round(s.getBoundingClientRect().top) + ' < ' + Math.round(rr.bottom));
  }
  // Barres laterales OnlyOffice / LibreOffice : le document garde une largeur utile.
  const left = parseFloat(doc.style.getPropertyValue('--fo-oo-left')) || 0, right = parseFloat(doc.style.getPropertyValue('--fo-oo-right')) || 0;
  const shell = document.querySelector('[data-oo-dock]');
  const sl = shell ? parseFloat(shell.style.getPropertyValue('--fo-oo-left')) || 0 : left, sr = shell ? parseFloat(shell.style.getPropertyValue('--fo-oo-right')) || 0 : right;
  if (W - sl - sr < Math.min(240, W * 0.5)) issues.push('document trop etroit: ' + (W - sl - sr) + ' px');
  const rh = rb ? Math.round(rb.getBoundingClientRect().height) : 0;
  return { n, issues, rh, bottom: rb ? Math.round(rb.getBoundingClientRect().bottom) : 0 };
})()`;

const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9871) });
let bad = 0, total = 0;
try {
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
  await b.goto(`${BASE}/?app=word&e2e=1`, 300);
  for (const app of apps) {
    for (const layout of layouts) {
      for (const w of widths) {
        const mobile = w < 720;
        await b.viewport(w, mobile ? 844 : 900, mobile);
        await b.ev(`localStorage.setItem('fo-setting:ui.layout', ${JSON.stringify(JSON.stringify(layout))}); localStorage.setItem('fo-setting:ui.fit', ${JSON.stringify(JSON.stringify(fit))}); localStorage.setItem('fo-setting:ui.theme', ${JSON.stringify(JSON.stringify(dark ? 'dark' : 'light'))});`);
        await b.goto(`${BASE}/?app=${app}&e2e=1`, 700);
        // Publication, Base, Hub demarrent sur l'ecran d'accueil (Backstage) : on le ferme pour voir le ruban.
        if (await b.ev(`Boolean(document.querySelector('.fo-bs__back'))`)) { await b.ev(`document.querySelector('.fo-bs__back').click()`); await sleep(500); }
        const tabs = await b.ev(`[...document.querySelectorAll('.fo-ribbon__tabs [role=tab]')].filter((t) => !t.classList.contains('fo-ribbon__tab--file')).slice(0, 12).map((t) => t.textContent.trim())`);
        const names = tabs.length ? tabs : [null];
        const maxTabs = process.env.FO_ALL_TABS ? 99 : 4;
        let worst = null;
        for (const [i, tabName] of names.slice(0, maxTabs).entries()) {
          if (tabName) { await b.ev(`(() => { const t = [...document.querySelectorAll('.fo-ribbon__tabs [role=tab]')].filter((x) => !x.classList.contains('fo-ribbon__tab--file'))[${i}]; t?.click(); })()`); await sleep(350); }
          const res = await b.ev(PROBE);
          total++;
          const tag = `${app}/${layout}/${w}${dark ? '/dark' : ''}${tabName ? '/' + tabName : ''}`;
          if (res.issues.length) { bad++; console.log(`FAIL ${tag} (ruban ${res.rh}px, ${res.n} cmds) : ${[...new Set(res.issues)].slice(0, 4).join(' ; ')}${res.issues.length > 4 ? ` (+${res.issues.length - 4})` : ''}`); }
          worst = worst ?? res;
          if (shots && i === 0) await b.shot(join(shots, `${app}-${layout}-${w}${dark ? '-dark' : ''}.png`));
        }
      }
    }
  }
  console.log(`${bad === 0 ? 'OK  ' : 'FAIL'} ${total - bad}/${total} cas propres (fit=${fit}${dark ? ', sombre' : ''})`);
  if (b.consoleLog.length) console.log(b.consoleLog.slice(0, 5).join('\n'));
} finally {
  await b.close();
}
process.exit(bad ? 1 : 0);
