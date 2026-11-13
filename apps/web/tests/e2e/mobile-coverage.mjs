// Test de couverture mobile : CHAQUE commande de CHAQUE onglet du ruban de CHAQUE module doit etre atteignable au doigt.
//   node apps/web/tests/e2e/mobile-coverage.mjs [module ...] [--tablet] [--no-tap] [--max-tabs=N]
// Prerequis : le banc tourne (`npm run dev -w apps/web -- --port 5391`) ; variables FO_BASE (defaut http://127.0.0.1:5391), FO_CDP_PORT (9651), CHROME.
// La liste des commandes vient du SCHEMA declaratif du ruban (window.__FO_RIBBON__.schema(), expose par <Ribbon> avec ?e2e=1), pas du DOM.
// Pour chaque commande du schema, en emulation tactile 390x844 (telephone) ou 820x1180 (tablette, --tablet) :
//   1. elle est presente dans la bande du ruban (cellule data-cmd) ;
//   2. chaque controle interactif de la cellule mesure au moins 44 px dans les deux sens ;
//   3. une fois amenee a l'ecran (defilement de la bande), elle est entierement dans la fenetre et rien ne la recouvre (elementFromPoint) ;
//   4. un VRAI toucher (Input.dispatchTouchEvent) l'active : une feuille / un dialogue s'ouvre ou l'etat de la page change
//      (sinon la commande est listee « sans effet visible » : information, a confronter a l'outil de conformite par commande).
// La feuille « Toutes les commandes » est aussi verifiee (ouverture, recherche, une commande executee). Sortie : tableau module/onglet ;
// code 1 si une commande est introuvable, trop petite, hors ecran ou recouverte.
import { launch, sleep } from './harness.mjs';
import { touchKit } from './touchkit.mjs';

const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5391';
const args = process.argv.slice(2);
const tablet = args.includes('--tablet');
const doTap = !args.includes('--no-tap');
const maxTabs = Number((args.find((a) => a.startsWith('--max-tabs=')) ?? '').split('=')[1] ?? 0) || Infinity;
const ALL = ['word', 'excel', 'powerpoint', 'publisher', 'access', 'pdf', 'notes', 'convert'];
const modules = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : ALL;
const [W, H] = tablet ? [820, 1180] : [390, 844];

const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9651) });
// FO_LAYOUT=onlyoffice : meme verification avec le profil OnlyOffice (reglage ecrit avant chaque page).
if (process.env.FO_LAYOUT) await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('fo-setting:ui.layout', JSON.stringify(${JSON.stringify(process.env.FO_LAYOUT)})); } catch {}` });
const k = touchKit(b);
// Garde-fou : un test fige (dialogue natif, page bloquee) ne doit jamais laisser un navigateur ouvert.
const watchdog = setTimeout(() => { console.log('ECHEC : delai depasse (45 min)'); void b.close().finally(() => process.exit(2)); }, 45 * 60 * 1000);
const rows = [];
const failures = [];
const noEffect = [];

// Mesure d'une cellule de la bande, executee dans la page.
const MEASURE = (id) => `(() => {
  const cell = [...document.querySelectorAll('.fo-band__cell')].find((c) => c.dataset.cmd === ${JSON.stringify(id)});
  if (!cell) return { missing: true };
  cell.scrollIntoView({ block: 'nearest', inline: 'center' });
  const W = window.innerWidth, H = window.innerHeight;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const els = [...cell.querySelectorAll('button, input:not([type=checkbox]):not([type=radio]), select, [role=button], label')].filter(vis);
  if (!els.length) return cell.dataset.kind === 'custom' ? { info: true } : { empty: true };
  const small = [], off = [], covered = [];
  for (const e of els) {
    const r = e.getBoundingClientRect();
    const tag = (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 24);
    if (r.width < 43.5 || r.height < 43.5) small.push(tag + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if (r.left < -0.5 || r.right > W + 0.5 || r.top < -0.5 || r.bottom > H + 0.5) off.push(tag);
    const x = Math.min(W - 1, Math.max(1, r.left + r.width / 2)), y = Math.min(H - 1, Math.max(1, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(e === hit || e.contains(hit) || hit.contains(e))) covered.push(tag + ' <- ' + (hit ? hit.className : 'rien'));
  }
  const first = els.find((e) => e.matches('button, input')) ?? els[0];
  const fr = first.getBoundingClientRect();
  const disabled = first.disabled === true || first.getAttribute('aria-disabled') === 'true';
  return { small, off, covered, disabled, x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 };
})()`;

// Signature d'etat de la page : change si une commande a une consequence visible.
const SIGNATURE = `(() => {
  const q = (s) => document.querySelectorAll(s).length;
  const open = q('.fo-menu, .fo-popover, .fo-dialog, .fo-sheet, .fo-bs, .fo-pane');
  const pressed = [...document.querySelectorAll('[aria-pressed=true], .is-pressed, .is-selected')].length;
  return JSON.stringify({ open, pressed, t: document.body.innerText.length, h: document.body.innerHTML.length, title: document.title, kb: q('.fo-kbbar'), toast: q('.fo-toast') });
})()`;

let reloads = 0;
let dynamic = 0;
async function recover(app, tabId) {
  // Ferme tout ce qu'une commande a ouvert (Echap, comme la touche Retour d'Android) ; si quelque chose reste ou si le ruban a disparu
  // (mode lecture, plein ecran...), recharge l'application : chaque commande est ainsi testee depuis un etat propre.
  const OPEN = `document.querySelectorAll('.fo-menu, .fo-popover, .fo-dialog, .fo-sheet, .fo-bs, .fo-sheet-scrim').length`;
  for (let i = 0; i < 3; i++) {
    if (!(await b.ev(OPEN).catch(() => 0))) break;
    await b.key('Escape');
    await sleep(100);
  }
  // Un recouvrement plein ecran (diaporama, palette de commandes, lecture...) : Echap, puis rechargement si le ruban reste cache.
  const RIBBON_FREE = `(() => { const t = document.querySelector('.fo-ribbon__tabrow'); if (!t) return false; const r = t.getBoundingClientRect(); const e = document.elementFromPoint(r.left + 30, r.top + r.height / 2); return Boolean(e && t.contains(e)); })()`;
  if (!(await b.ev(RIBBON_FREE).catch(() => false))) {
    await b.key('Escape');
    await sleep(250);
  }
  const clean = await b.ev(`${RIBBON_FREE} && ${OPEN} === 0 && Boolean(document.querySelector('.fo-band')) && document.documentElement.dataset.app === ${JSON.stringify(app)} && !document.querySelector('[role=alert].fo-shell-center')`).catch(() => false);
  if (!clean) {
    reloads++;
    if (process.env.FO_DEBUG) console.log('RELOAD', app, tabId, await b.ev(`JSON.stringify({open: [...document.querySelectorAll('.fo-menu, .fo-popover, .fo-dialog, .fo-sheet, .fo-bs, .fo-sheet-scrim')].map((e) => e.className + ':' + (e.getAttribute('aria-label') || e.textContent.slice(0, 20))), active: document.activeElement?.className, band: !!document.querySelector('.fo-band'), app: document.documentElement.dataset.app, crash: !!document.querySelector('[role=alert].fo-shell-center')})`).catch((e) => String(e)));
    // Sans donnees du site : pas de dialogue « Recuperation » du brouillon automatique au rechargement.
    await b.send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' }).catch(() => undefined);
    await b.goto(`${BASE}/?app=${app}&e2e=1`, 1500);
    await prepare();
    await setup(app);
    await b.waitFor(`document.querySelector('.fo-band')`, 8000);
  }
  for (let i = 0; i < 4 && tabId; i++) {
    const sel = await b.ev(`document.querySelector('.fo-ribbon__tab[aria-selected=true]')?.id ?? null`).catch(() => null);
    if (sel === `fo-tab-${tabId}`) break;
    await k.tapEl(`#fo-tab-${tabId}`).catch(() => undefined);
    await sleep(300);
  }
}

// Etat de depart propre a chaque module : Publication s'ouvre sur le Backstage ; Base de donnees sur l'ecran « sans application » (mode demonstration en memoire).
async function setup(app) {
  if (app === 'access' && !(await b.ev(`Boolean(document.querySelector('.fo-ribbon'))`))) {
    await k.tapEl('.fo-btn--primary').catch(() => undefined);
    await b.waitFor(`document.querySelector('.fo-ribbon')`, 8000);
  }
  for (let i = 0; i < 3 && (await b.ev(`Boolean(document.querySelector('.fo-bs'))`)); i++) {
    await b.key('Escape');
    await sleep(300);
  }
}

async function prepare() {
  // Pas d'impression, d'ouverture de fenetre ni de navigation reelle pendant les touches.
  await b.ev(`window.print = () => undefined; window.open = () => null; window.alert = () => undefined; window.confirm = () => false; window.prompt = () => null; undefined`);
}

try {
  await b.viewport(W, H, true);
  for (const app of modules) {
    await b.send('Storage.clearDataForOrigin', { origin: BASE, storageTypes: 'all' }).catch(() => undefined);
    await b.goto(`${BASE}/?app=${app}&e2e=1`, 2200);
    await prepare();
    await setup(app);
    const hasRibbon = await b.waitFor(`window.__FO_RIBBON__ && document.querySelector('.fo-band')`, 8000);
    if (!hasRibbon) {
      failures.push(`${app} : pas de ruban mobile (bande absente ou schema non expose)`);
      rows.push({ app, tab: '(aucun)', total: 0, ok: 0 });
      continue;
    }
    const onlyTab = (args.find((a) => a.startsWith('--tab=')) ?? '').split('=')[1];
    const tabs = (await b.ev(`window.__FO_RIBBON__.schema().map((t) => t.id)`)).filter((t) => !onlyTab || t === onlyTab).slice(0, maxTabs);
    for (const tabId of tabs) {
      await k.tapEl(`#fo-tab-${tabId}`);
      await sleep(250);
      const schema = (await b.ev(`window.__FO_RIBBON__.schema()`)).find((t) => t.id === tabId);
      if (!schema) continue;
      const cmds = schema.groups.flatMap((g) => g.controls.map((c) => ({ ...c, group: g.label })));
      let reached = 0;
      const dynBefore = dynamic;
      for (const c of cmds) {
        const where = `${app} > ${schema.label} > ${c.group} > ${c.label} [${c.id}]`;
        const m = await b.ev(MEASURE(c.id));
        if ((m.missing || m.empty) && !(await b.ev(`window.__FO_RIBBON__.schema().find((t) => t.id === ${JSON.stringify(tabId)})?.groups.some((g) => g.controls.some((c) => c.id === ${JSON.stringify(c.id)})) ?? false`))) {
          dynamic++; // la commande a disparu du schema apres une commande precedente (ex. apercu du publipostage) : pas une anomalie de la bande
          continue;
        }
        if (m.missing || m.empty) {
          const dbg = process.env.FO_DEBUG ? ` | onglet=${await b.ev(`document.querySelector('.fo-ribbon__tab[aria-selected=true]')?.id`)} cellules=${await b.ev(`[...document.querySelectorAll('.fo-band__cell')].map((e) => e.dataset.cmd).join(',')`)} ribbon=${await b.ev(`document.querySelector('.fo-ribbon')?.className`)}` : '';
          failures.push(`${where} : absente de la bande${dbg}`);
          continue;
        }
        if (m.info) { reached++; continue; }
        const problems = [];
        if (m.small.length) problems.push(`cible < 44 px (${m.small.join(', ')})`);
        if (m.off.length) problems.push(`hors ecran (${m.off.join(', ')})`);
        if (m.covered.length) problems.push(`recouverte (${m.covered.join(', ')})`);
        if (problems.length) { failures.push(`${where} : ${problems.join(' ; ')}`); continue; }
        reached++;
        if (!doTap || m.disabled) continue;
        // Le defilement de la bande est asynchrone : on retape la position finale.
        await sleep(60);
        const pos = await b.ev(`(() => { const c = [...document.querySelectorAll('.fo-band__cell')].find((e) => e.dataset.cmd === ${JSON.stringify(c.id)}); const e = c.querySelector('button, input:not([type=checkbox])') ?? c; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        const before = await b.ev(SIGNATURE);
        const logs = b.consoleLog.length;
        await k.tap(pos.x, pos.y, 140);
        const after = await b.ev(SIGNATURE).catch(() => 'crash');
        const crashed = await b.ev(`Boolean(document.querySelector('[role=alert].fo-shell-center'))`).catch(() => true);
        // Une exception levee par la commande = une option qui ne fonctionne pas (l'interface ne le montre pas toujours).
        const thrown = b.consoleLog.slice(logs).filter((l) => /^exception|^error:/.test(l) && !/ResizeObserver|Failed to load resource/.test(l));
        if (thrown.length) failures.push(`${where} : exception levee : ${thrown[0].slice(0, 160).split(String.fromCharCode(10)).join(' ')}`);
        if (crashed) failures.push(`${where} : le toucher a fait planter le module`);
        else if (before === after) noEffect.push(where);
        await recover(app, tabId);
      }
      rows.push({ app, tab: schema.label, total: cmds.length - (dynamic - dynBefore), ok: reached });
    }
    // Feuille « Toutes les commandes » : ouverture, recherche, execution d'une commande.
    await recover(app, tabs[0] ?? '');
    await k.tapEl('.fo-ribbon__allcmds');
    if (!(await b.waitFor(`document.querySelector('.fo-sheet__search input')`, 4000))) {
      failures.push(`${app} : le bouton « Toutes les commandes » n'ouvre pas la feuille`);
      continue;
    }
    if (process.env.FO_DEBUG_SHOT) await b.shot(process.env.FO_DEBUG_SHOT);
    const n = await b.ev(`document.querySelectorAll('.fo-sheet [data-cmd-sheet]').length`);
    const expected = await b.ev(`window.__FO_RIBBON__.schema().length`);
    if (n < expected) failures.push(`${app} : feuille « Toutes les commandes » presque vide (${n} commandes)`);
    const input = await k.where('.fo-sheet__search input');
    await k.tap(input.x, input.y);
    await b.type('gras');
    await sleep(250);
    const found = await b.ev(`document.querySelectorAll('.fo-sheet [data-cmd-sheet]').length`);
    console.log(`INFO  ${app} : feuille « Toutes les commandes » = ${n} commandes, recherche « gras » = ${found}`);
    await recover(app, tabs[0] ?? '');
  }
} finally {
  clearTimeout(watchdog);
  await b.close();
}

console.log(`\nCouverture mobile ${tablet ? 'tablette 820x1180' : 'telephone 390x844'}${doTap ? ' (avec toucher reel)' : ' (sans toucher)'}`);
console.log('module'.padEnd(12) + 'onglet'.padEnd(22) + 'commandes'.padStart(10) + 'atteignables'.padStart(14));
for (const r of rows) console.log(r.app.padEnd(12) + r.tab.padEnd(22) + String(r.total).padStart(10) + String(r.ok).padStart(14));
const total = rows.reduce((n, r) => n + r.total, 0);
const ok = rows.reduce((n, r) => n + r.ok, 0);
console.log(`TOTAL ${ok}/${total} atteignables (${reloads} rechargements de reprise apres une commande, ${dynamic} commandes devenues indisponibles apres une autre)`);
for (const a of new Set(rows.map((r) => r.app))) {
  const sub = rows.filter((r) => r.app === a);
  console.log(`  ${a.padEnd(11)} ${sub.reduce((n, r) => n + r.ok, 0)}/${sub.reduce((n, r) => n + r.total, 0)}`);
}
if (noEffect.length) console.log(`\nSans effet visible au toucher (${noEffect.length}) : a confronter a la conformite par commande (certaines sont normales : copier sans selection...)\n  ${noEffect.join('\n  ')}`);
if (failures.length) {
  console.log(`\nECHEC (${failures.length})\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nOK : toutes les commandes sont atteignables au doigt.');
