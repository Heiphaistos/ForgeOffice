// Parcours entre applications de ForgeOffice, rejouables : `node apps/web/tests/e2e/flows.mjs [1 2 3 ...]`.
// Prerequis : le banc tourne (`npm run dev -w apps/web -- --port 5321`), Chromium de Playwright ou Edge installe.
// Variables : FO_BASE (defaut http://127.0.0.1:5321), CHROME (navigateur), FO_CDP_PORT (defaut 9581), FO_SHOTS (dossier des captures).
// Voir docs/E2E.md. Sortie : une ligne OK/ECHEC par controle, code 1 s'il y a un echec.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './harness.mjs';
import { flowsB } from './flows-b.mjs';
import { flowsMobile } from './flows-mobile.mjs';
import { flowsTouch } from './flows-touch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5321';
const SHOTS = process.env.FO_SHOTS ?? join(here, '..', '..', '..', '..', 'docs', 'captures');
const wanted = process.argv.slice(2).map(Number).filter(Boolean);
const APPS = ['hub', 'word', 'excel', 'powerpoint', 'publisher', 'access', 'pdf', 'notes', 'convert'];

const fixtures = mkdtempSync(join(tmpdir(), 'foe2e-fix-'));
execFileSync(process.execPath, [join(here, 'prepare.ts'), fixtures], { stdio: 'inherit' });
const F = (name) => readFileSync(join(fixtures, name));
mkdirSync(SHOTS, { recursive: true });

const results = [];
const ok = (p, name, cond, detail = '') => {
  results.push({ p, name, ok: Boolean(cond), detail });
  console.log(`${cond ? 'OK   ' : 'ECHEC'} [${p}] ${name}${detail ? ` : ${detail}` : ''}`);
};

const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9581) });
const url = (app) => `${BASE}/?app=${app}`;
const text = () => b.ev('document.body.innerText');
const state = () => b.ev(`({ app: document.documentElement.dataset.app, title: document.title, theme: document.documentElement.dataset.theme,
  crashed: Boolean(document.querySelector('[role=alert].fo-shell-center')), toast: document.querySelector('.fo-toaster, .fo-toast')?.textContent ?? '' })`);
// Attend l'application ; avec `file`, attend aussi que le module ait pris la main (son titre remplace le titre generique de la coquille).
const waitApp = async (app, ms = 20000, file = false) => {
  await b.waitFor(`document.documentElement.dataset.app === ${JSON.stringify(app)} && document.querySelector('#root > .fo-shell') && !document.querySelector('.fo-splash')`, ms);
  if (file) await b.waitFor(`!/^(Texte|Tableur|Présentation|Publication|Bloc-notes|PDF|Convertisseur|Base de données) - ForgeOffice$/.test(document.title)`, ms);
  await sleep(900);
};
/** Navigation interne (comme services.openModule) sans recharger la page. */
const nav = async (app) => { await b.ev(`window.dispatchEvent(new CustomEvent('fo-navigate', { detail: { app: ${JSON.stringify(app)}, file: null } }))`); await waitApp(app); };

// ---- Tableur : la grille est un canvas, on lit le contenu par la barre de formule et la zone Nom.
async function xlGoto(addr) {
  await b.ev(`[...document.querySelectorAll('input')].find((e) => /^[A-Z]{1,3}[0-9]+(:[A-Z]{1,3}[0-9]+)?$/.test(e.value))?.setAttribute('data-e2e', 'nb')`);
  await b.click('[data-e2e=nb]');
  await b.key('a', { ctrl: true, commands: ['selectAll'] });
  await b.press(addr);
  await b.key('Enter');
  await b.ev(`document.querySelector('[data-e2e=nb]')?.removeAttribute('data-e2e')`);
}
const xlValue = () => b.ev(`document.querySelector('.xl-fi__input')?.value ?? null`);
async function xlCell(addr) { await xlGoto(addr); await sleep(200); return xlValue(); }
async function xlType(addr, value) { await xlGoto(addr); await b.press(`${value}\n`); }

/** Fichier > <entree> ; `Parcourir` si la page du Backstage en propose un. */
async function fichier(entry) {
  await b.click('text=Fichier'); await sleep(350);
  await b.clickText('.fo-bs__nav-item, [role=menuitem], .fo-menu button', entry);
  await sleep(500);
}
async function openViaFichier(file) {
  await b.pick(file.name, file.bytes);
  await fichier('Ouvrir');
  for (const label of ['Parcourir', 'Ouvrir…']) {
    if (await b.ev(`[...document.querySelectorAll('.fo-bs button')].some((e) => e.textContent.trim() === ${JSON.stringify(label)})`)) { await b.clickText('.fo-bs button', label); break; }
  }
  await sleep(2200);
}

/** Marqueurs de contenu par application : prouvent que le BON fichier a ete charge (pas seulement la bonne application). */
const CHECKS = {
  'rapport.docx': { app: 'word', has: async () => (await text()).includes('FOE2E ligne un') && (await b.ev(`document.querySelectorAll('.ProseMirror table').length`)) > 0 },
  'chiffres.xlsx': { app: 'excel', has: async () => (await xlCell('A2')) === 'Pommes' && (await xlCell('C3')) === '2,25' },
  'chiffres.csv': { app: 'excel', has: async () => (await xlCell('A3')) === 'Poires' },
  'expose.pptx': { app: 'powerpoint', has: async () => (await text()).includes('Diapo FOE2E titre') },
  'contrat.pdf': { app: 'pdf', has: async () => (await text()).includes('Page 1 sur 1') },
  'affiche.fopub': { app: 'publisher', has: async () => (await text()).includes('Publication FOE2E') },
  'notes.md': { app: 'notes', has: async () => (await text()).includes('Note FOE2E') },
  'script.py': { app: 'notes', has: async () => (await text()).includes('def salut') },
};

async function dropOnHub(name, bytes = F(name)) {
  await b.goto(url('hub'));
  await b.drop('.hub', name, bytes);
}

// ===================================================================== 1. Accueil
async function p1() {
  const P = 1;
  await b.viewport(1440, 900);
  // Vignettes « Nouveau » de l'accueil
  const tiles = [['Document vierge', 'word'], ['Classeur vierge', 'excel'], ['Présentation vierge', 'powerpoint'], ['Publication vierge', 'publisher'],
    ['Base de données vide', 'access'], ['Nouvelle note', 'notes']];
  for (const [label, app] of tiles) {
    await b.goto(url('hub'));
    await b.click(`.hub-tile[title="${label}"]`);
    await waitApp(app, 8000);
    const s = await state();
    ok(P, `vignette « ${label} » ouvre ${app}`, s.app === app && !s.crashed, s.title);
  }
  // Modeles (page Nouveau) : application + contenu
  const templates = [['Lettre', 'word', 'Madame, Monsieur'], ['Compte rendu de réunion', 'word', 'Ordre du jour'], ['Budget mensuel', 'excel', 'Logement'],
    ['Planning de la semaine', 'excel', 'Lundi'], ['Liste de tâches', 'notes', 'Première tâche']];
  for (const [label, app, marker] of templates) {
    await b.goto(url('hub'));
    await b.clickText('.hub-rail__item', 'Nouveau');
    await b.click(`.hub-tile[title="${label}"]`);
    await waitApp(app, 8000, true);
    const s = await state();
    let found;
    if (app === 'excel') { await xlGoto(label === 'Budget mensuel' ? 'A2' : 'B1'); await sleep(200); found = (await xlValue()) === marker; } else found = (await text()).includes(marker);
    ok(P, `modèle « ${label} » → ${app} avec son contenu`, s.app === app && found && !s.crashed, s.title);
  }
  // Glisser-deposer
  for (const [name, check] of Object.entries(CHECKS)) {
    await dropOnHub(name);
    await waitApp(check.app, 10000, true);
    const s = await state();
    ok(P, `dépôt de ${name} → ${check.app}, contenu lu`, s.app === check.app && !s.crashed && await check.has().catch(() => false), s.title);
  }
  await dropOnHub('base.fodb', Buffer.from('SQLite format 3\0'));
  await waitApp('access', 10000);
  ok(P, 'dépôt de base.fodb → Base de données (sans crash)', (await state()).app === 'access' && !(await state()).crashed);
  await dropOnHub('inconnu.xyz');
  await sleep(1200);
  const s = await state();
  ok(P, 'format inconnu refusé proprement (reste à l’Accueil, message)', s.app === 'hub' && !s.crashed && /non pris en charge/i.test(s.toast), s.toast);
  // Retour a l'Accueil depuis chaque application, puis rechargement de page
  for (const app of APPS.filter((a) => a !== 'hub')) {
    await b.goto(url(app));
    if (app === 'access') await b.clickText('button', 'Retour à l’accueil');
    else await fichier(app === 'notes' ? 'Quitter' : 'Fermer');
    await waitApp('hub', 8000);
    const back = await state();
    ok(P, `${app} : retour à l’Accueil (Fichier > ${app === 'access' ? 'Retour à l’accueil' : app === 'notes' ? 'Quitter' : 'Fermer'})`, back.app === 'hub' && !back.crashed && (await b.ev('window.location.search')) === '?app=hub', `${back.app} ${await b.ev('location.search')}`);
  }
  for (const app of APPS) {
    await b.goto(url(app));
    const s2 = await state();
    ok(P, `rechargement de ?app=${app}`, s2.app === app && !s2.crashed, s2.title);
  }
}

// ===================================================================== 2. Ouvrir inter-modules
async function p2() {
  const P = 2;
  await b.viewport(1440, 900);
  const files = { word: 'rapport.docx', excel: 'chiffres.xlsx', powerpoint: 'expose.pptx', publisher: 'affiche.fopub', notes: 'notes.md', pdf: 'contrat.pdf' };
  for (const from of Object.keys(files)) {
    for (const to of Object.keys(files)) {
      // Publication ouvre aussi les .pptx (son filtre « Ouvrir » les propose) : ce couple reste dans Publication, par conception.
      if (from === to || (from === 'publisher' && to === 'powerpoint')) continue;
      await b.goto(url(from), 300);
      await openViaFichier({ name: files[to], bytes: F(files[to]) });
      await waitApp(to, 10000, true);
      const s = await state();
      const good = s.app === to && !s.crashed && await CHECKS[files[to]].has().catch(() => false);
      ok(P, `Ouvrir ${files[to]} depuis ${from} → ${to}`, good, `${s.app} | ${s.title}`);
    }
  }
}

// ===================================================================== 3. Bloc-notes → Texte, Texte → Convertisseur
async function p3() {
  const P = 3;
  await b.viewport(1440, 900);
  await b.goto(url('notes'));
  await b.click('.cm-content');
  await b.type('# Titre converti FOE2E\n\nParagraphe de la note.');
  await fichier('Exporter');
  await b.clickText('.fo-bs button', 'Convertir en Texte (.docx)');
  await waitApp('word', 10000, true);
  let t = await text();
  ok(P, 'Bloc-notes > Convertir en Texte (.docx) ouvre Texte avec le document converti', (await state()).app === 'word' && t.includes('Titre converti FOE2E') && t.includes('Paragraphe de la note'), (await state()).title);
  ok(P, '… sans l’écran « Bientôt disponible »', !t.includes('Bientôt disponible'));

  // Texte : saisie, Ctrl+S (telechargement .docx) puis Exporter > PDF (impression du navigateur)
  await b.goto(url('word'));
  await b.click('.ProseMirror');
  await b.type('Contenu Texte pour conversion FOE2E');
  await b.key('s', { ctrl: true });
  await sleep(1500);
  const dl = await b.downloads();
  const docx = dl.find((d) => d.name.endsWith('.docx'));
  ok(P, 'Texte : Ctrl+S télécharge un .docx valide (zip)', docx && docx.bytes.subarray(0, 2).toString() === 'PK', docx?.name ?? 'aucun');
  await b.ev('window.__printed = 0; window.print = () => { window.__printed++; }');
  await fichier('Exporter');
  await b.clickText('.fo-bs button', 'Créer un document PDF');
  await sleep(800);
  ok(P, 'Texte > Exporter > PDF lance l’impression PDF du navigateur', (await b.ev('window.__printed')) >= 1);
  await b.goto(url('excel'));
  await b.ev('window.__printed = 0; window.print = () => { window.__printed++; }');
  await fichier('Exporter');
  await b.clickText('.fo-bs button', 'Créer un document PDF');
  await sleep(800);
  ok(P, 'Tableur > Exporter > PDF lance l’impression PDF du navigateur', (await b.ev('window.__printed')) >= 1);

  // Convertisseur : .docx produit par Texte -> .html puis .txt, ouverture du resultat dans le bon module
  if (!docx) return;
  for (const [target, app, marker] of [['html', 'word', 'Contenu Texte pour conversion FOE2E'], ['txt', 'notes', 'Contenu Texte pour conversion FOE2E']]) {
    await b.goto(url('convert'));
    await b.drop('.cv', docx.name, docx.bytes);
    await b.waitFor(`document.querySelector('.cv-select')`, 8000);
    const offered = await b.ev(`[...document.querySelectorAll('.cv-select option')].map((o) => o.value)`);
    ok(P, `Convertisseur propose .${target} pour un .docx`, offered.includes(target), offered.join(','));
    await b.ev(`(() => { const s = document.querySelector('.cv-select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(target)}); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await b.clickText('button', 'Tout convertir');
    const done = await b.waitFor(`document.querySelector('.cv-state.is-done')`, 15000);
    ok(P, `Convertisseur : .docx → .${target} terminé`, done, await b.ev(`document.querySelector('.cv-state')?.textContent ?? ''`));
    if (!done) continue;
    await b.clickText('.cv-table button', 'Ouvrir');
    await waitApp(app, 10000, true);
    t = await text();
    ok(P, `résultat .${target} ouvert dans ${app} avec le contenu`, (await state()).app === app && t.includes(marker), (await state()).title);
  }
}

const parcours = { 1: p1, 2: p2, 3: p3, ...flowsB({ b, ok, url, text, state, waitApp, nav, F, xlGoto, xlCell, xlType, xlValue, fichier, openViaFichier, CHECKS, dropOnHub, APPS, SHOTS, sleep }), ...flowsTouch({ b, ok, url, sleep }), ...flowsMobile({ b, ok, url, state, waitApp, SHOTS, APPS, sleep, dropOnHub, F }) };

let crashed = null;
try {
  for (const n of Object.keys(parcours).map(Number)) {
    if (wanted.length && !wanted.includes(n)) continue;
    console.log(`\n== Parcours ${n}`);
    b.consoleLog.length = 0;
    try { await parcours[n](); } catch (err) { ok(n, 'parcours interrompu par une exception', false, err instanceof Error ? err.message : String(err)); }
    if (n !== 5) ok(n, 'console sans erreur ni avertissement pendant tout le parcours', b.consoleLog.length === 0, [...new Set(b.consoleLog)].join(' || ').slice(0, 500));
  }
} catch (err) {
  crashed = err;
} finally {
  await b.close();
  rmSync(fixtures, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} OK, ${failed.length} échec(s)`);
for (const f of failed) console.log(`  - [${f.p}] ${f.name} ${f.detail}`);
if (crashed) console.error(crashed);
process.exit(failed.length || crashed ? 1 : 0);
