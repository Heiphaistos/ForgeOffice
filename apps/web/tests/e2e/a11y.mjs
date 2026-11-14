// Accessibilite : noms accessibles, ordre de tabulation, focus visible, clavier du ruban, contraste WCAG (clair + sombre) par module et par disposition.
// Usage : node apps/web/tests/e2e/a11y.mjs <port vite> <port cdp> [modules,..] [dispositions,..] [--details]
// Les dispositions copiees (onlyoffice, libreoffice, openoffice) sont seulement signalees (identite imposee) ; les autres font echouer le test.
import { launch, sleep } from './harness.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const details = process.argv.includes('--details');
const [vitePort = '5871', cdp = '9871', modArg = '', layArg = ''] = args;
const MODULES = modArg ? modArg.split(',') : ['hub', 'word', 'excel', 'powerpoint', 'publisher', 'access', 'pdf', 'notes', 'convert'];
const LAYOUTS = layArg ? layArg.split(',') : ['office', 'office-simplified', 'onlyoffice', 'libreoffice', 'openoffice', 'menus-classic', 'ribbon-compact', 'google', 'dropdown', 'touch'];
const COPIED = new Set(['onlyoffice', 'libreoffice', 'openoffice']);

let fails = 0; let notes = 0;
const out = (kind, msg) => { if (kind === 'FAIL') fails++; if (kind === 'NOTE') notes++; console.log(`${kind.padEnd(4)} ${msg}`); };

// Analyse executee dans la page : noms accessibles manquants + contrastes calcules.
const ANALYSE = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const rgba = (c) => { if (cache.has(c)) return cache.get(c); cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; let v = [d[0], d[1], d[2], d[3] / 255]; if (c === 'transparent' || /^rgba\\(.*,\\s*0\\)$/.test(c)) v = [0, 0, 0, 0]; cache.set(c, v); return v; };
  const over = (f, b) => [f[0] * f[3] + b[0] * (1 - f[3]), f[1] * f[3] + b[1] * (1 - f[3]), f[2] * f[3] + b[2] * (1 - f[3])];
  const lum = (c) => { const k = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const visible = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false; if (x.hasAttribute('inert') || x.getAttribute('aria-hidden') === 'true') return false; } return !e.closest('.fo-visually-hidden, .fo-ribbon__measure'); };
  const sel = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
  const unnamed = []; const contrast = [];
  const name = (e) => {
    if (e.getAttribute('aria-label')?.trim() || e.getAttribute('title')?.trim()) return true;
    const lb = e.getAttribute('aria-labelledby'); if (lb && lb.split(/\\s+/).some((id) => document.getElementById(id)?.textContent.trim())) return true;
    if (e.labels && [...e.labels].some((l) => l.textContent.trim())) return true;
    if (e.closest('label')?.textContent.trim()) return true;
    if (e.textContent.trim()) return true;
    if (e.querySelector('img[alt]:not([alt=""])')) return true;
    if (e.getAttribute('placeholder')) return true;
    return false;
  };
  for (const e of document.querySelectorAll('button, [role=button], [role=tab], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=option], input:not([type=hidden]), select, textarea, a[href]')) {
    if (!visible(e)) continue;
    if (!name(e)) unnamed.push(sel(e) + (e.dataset.cmd ? '[' + e.dataset.cmd + ']' : ''));
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n; (n = walker.nextNode());) {
    const t = n.nodeValue.trim(); if (!t) continue;
    const e = n.parentElement; if (!e || seen.has(e) || ['SCRIPT', 'STYLE', 'CANVAS'].includes(e.tagName)) continue; seen.add(e);
    if (!visible(e)) continue;
    if (e.closest('[disabled], [aria-disabled=true], .is-disabled')) continue;
    if (e.closest('[class*="thumb"], .fo-canvas, [contenteditable="true"], .cm-content, .ProseMirror, .fo-gal__sample')) continue; // contenu de document (apercus, pages) : couleurs de l'auteur
    let filtered = false; for (let x = e; x; x = x.parentElement) if (getComputedStyle(x).filter !== 'none') { filtered = true; break; }
    if (filtered) continue; // apercus recolores par filtre (sombre) : non mesurables
    const s = getComputedStyle(e);
    let op = 1; for (let x = e; x; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
    let bg = [255, 255, 255]; let unknown = false; const chain = [];
    for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.backgroundImage !== 'none') { unknown = true; break; } const c = rgba(cs.backgroundColor); if (c[3] > 0) { chain.push(c); if (c[3] === 1) break; } }
    if (unknown) continue;
    bg = chain.length && chain[chain.length - 1][3] === 1 ? chain[chain.length - 1].slice(0, 3) : [255, 255, 255];
    for (let i = chain.length - (chain[chain.length - 1]?.[3] === 1 ? 2 : 1); i >= 0; i--) bg = over(chain[i], bg);
    const f = rgba(s.color); f[3] *= op; const fg = over(f, bg);
    const l1 = lum(fg); const l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(s.fontSize); const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) contrast.push({ s: sel(e), r: Math.round(ratio * 100) / 100, fg: fg.map(Math.round).join(','), bg: bg.map(Math.round).join(','), t: t.slice(0, 24) });
  }
  return { unnamed, contrast };
})()`;

const b = await launch({ port: Number(cdp) });
try {
  await b.goto(`http://127.0.0.1:${vitePort}/?app=word`, 300);
  for (const mod of MODULES) {
    for (const lay of LAYOUTS) {
      for (const theme of ['light', 'dark']) {
        await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${lay}"'); localStorage.setItem('fo-setting:ui.theme', '"${theme}"')`).catch(() => undefined);
        await b.goto(`http://127.0.0.1:${vitePort}/?app=${mod}`, 700);
        const label = `${mod}/${lay}/${theme}`;
        await b.ev(`document.head.insertAdjacentHTML('beforeend', '<style>*,*::before,*::after{transition:none!important;animation:none!important}</style>')`);
        const r = await b.ev(ANALYSE);
        // Noms accessibles : doivent tous exister, quelle que soit la disposition.
        if (r.unnamed.length) out(COPIED.has(lay) ? 'NOTE' : 'FAIL', `${label} : ${r.unnamed.length} controles sans nom accessible : ${[...new Set(r.unnamed)].slice(0, 8).join(', ')}`);
        // Contraste.
        if (r.contrast.length) {
          const uniq = new Map(); for (const c of r.contrast) { const k = `${c.s}|${c.fg}|${c.bg}`; if (!uniq.has(k)) uniq.set(k, c); }
          const worst = [...uniq.values()].sort((a, c) => a.r - c.r);
          out(COPIED.has(lay) ? 'NOTE' : 'FAIL', `${label} : ${uniq.size} paires texte/fond < 4,5:1 (pire ${worst[0].r} sur « ${worst[0].t} » ${worst[0].s})`);
          if (details) for (const c of worst.slice(0, 12)) console.log(`       ${c.r}  ${c.s}  fg(${c.fg}) bg(${c.bg})  « ${c.t} »`);
        }
        if (theme !== 'light') continue;
        // Clavier du ruban : onglets en tabulation « roving » + fleches + Alt (astuces clavier).
        const ribbon = await b.ev(`Boolean(document.querySelector('.fo-ribbon [role=tablist]')) && document.querySelectorAll('.fo-ribbon [role=tab]').length > 1`);
        if (ribbon) {
          const tabStops = await b.ev(`[...document.querySelectorAll('.fo-ribbon [role=tab]')].filter((t) => t.tabIndex >= 0).length`);
          if (tabStops !== 1) out('FAIL', `${label} : ${tabStops} onglets de ruban dans l'ordre de tabulation (attendu 1)`);
          await b.ev(`document.querySelector('.fo-ribbon [role=tab][aria-selected=true]')?.focus()`);
          const before = await b.ev(`document.querySelector('.fo-ribbon [role=tab][aria-selected=true]')?.textContent`);
          await b.key('ArrowRight', { code: 'ArrowRight' });
          const afterFocus = await b.ev(`document.activeElement?.getAttribute('role') + '|' + document.activeElement?.textContent`);
          if (!afterFocus.startsWith('tab|') || afterFocus.endsWith(`|${before}`)) out('FAIL', `${label} : fleche droite ne deplace pas le focus d'onglet de ruban (${afterFocus})`);
          await b.key('Alt', { code: 'AltLeft' });
          const tips = await b.ev(`document.querySelectorAll('.fo-keytips *').length`);
          if (!tips) out('NOTE', `${label} : Alt n'affiche pas les astuces clavier`);
          await b.key('Escape');
        }
        // Tabulation : focus visible sur les 25 premiers arrets, et le focus avance toujours.
        await b.ev(`document.activeElement?.blur(); document.body.focus()`);
        const bad = []; let prev = null; let stuck = 0;
        for (let i = 0; i < 25; i++) {
          await b.key('Tab', { code: 'Tab' });
          const s = await b.ev(`(() => { const e = document.activeElement; if (!e || e === document.body) return null; const r = e.getBoundingClientRect();
            const snap = () => { let out = ''; const nodes = [e, e.parentElement, e.parentElement?.parentElement, e.parentElement?.parentElement?.parentElement, ...[...e.querySelectorAll('*')].slice(0, 6)].filter(Boolean); for (const x of nodes) { const c = getComputedStyle(x); out += [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderTopColor, c.borderBottomColor, c.backgroundColor, c.color, c.textDecorationLine].join('|') + '#'; } return out; };
            const on = snap(); const cs = getComputedStyle(e); const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
            e.blur(); const off = snap(); e.focus();
            return { id: e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\s+/)[0] + '|' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 16)), vis: on !== off || outline, onscreen: r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth }; })()`);
          if (!s) continue;
          if (prev === s.id) stuck++; prev = s.id;
          if (!s.vis) bad.push(s.id);
          if (!s.onscreen) bad.push(`${s.id} (hors ecran)`);
        }
        if (stuck > 3) out('NOTE', `${label} : le focus reste bloque (${stuck} Tab sans avancer)`);
        const bad2 = bad.filter((x) => !/cm-content|fo-canvas.*(hors)/.test(x)); // surfaces d'edition : curseur = indicateur
        if (bad2.length) out(COPIED.has(lay) ? 'NOTE' : 'FAIL', `${label} : ${bad2.length} arrets sans indicateur de focus visible : ${[...new Set(bad2)].slice(0, 5).join(' ; ')}`);
      }
    }
  }
  console.log(`\nA11Y : ${fails} echec(s), ${notes} remarque(s) (dispositions copiees)`);
  if (b.consoleLog.length) console.log('console :', b.consoleLog.slice(0, 5).join(' | '));
} finally {
  await b.close();
}
process.exit(fails ? 1 : 0);
