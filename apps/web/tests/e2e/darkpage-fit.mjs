// Reglages « page sombre » du Texte et « adaptation de la fenetre » (auto) : application en direct depuis Options > Affichage,
// persistance, page imprimee jamais inversee, ruban replie sous 1000 px par defaut. Captures dans FO_SHOTS (a regarder).
//   FO_BASE=http://127.0.0.1:5471 FO_SHOTS=/tmp/e2e/shots node apps/web/tests/e2e/darkpage-fit.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';

const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5471';
const SHOTS = process.env.FO_SHOTS ?? '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PNG = readFileSync(new URL('./chart.b64', import.meta.url), 'utf8');
const SAMPLE = `<h1>Rapport trimestriel</h1><p>Texte <span data-rp="color" data-v='{"rgb":"C00000"}'>rouge</span>, <span data-rp="color" data-v='{"rgb":"1F6FEB"}'>bleu</span> et <span data-rp="highlight" data-v='"yellow"'>surligne</span>.</p><table><tbody><tr><th>Zone</th><th>T1</th></tr><tr><td>Nord</td><td>120</td></tr></tbody></table><p><img src="data:image/png;base64,${PNG}" width="260" height="90"></p>`;
const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9885) });
let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) bad++; };
const shot = async (n) => { if (SHOTS) await b.shot(`${SHOTS}/${n}.png`); };
async function open(app, w, theme, extra = '') {
  await b.viewport(w, 900);
  await b.goto(`${BASE}/?app=${app}`, 600);
  await b.ev(`localStorage.clear(); localStorage.setItem('fo-setting:ui.theme', '"${theme}"'); ${extra}`);
  await b.goto(`${BASE}/?app=${app}`, 2500);
}
try {
  // 1. Page sombre : defaut blanche, bascule en direct par les boutons radio des Options, persistance, jamais a l'impression.
  await open('word', 1440, 'dark');
  await b.click('.ProseMirror');
  await b.ev(`document.execCommand('selectAll'); document.execCommand('insertHTML', false, ${JSON.stringify(SAMPLE)}); document.querySelector('.ProseMirror').blur()`);
  await sleep(1000);
  const filter = () => b.ev(`getComputedStyle(document.querySelector('.fo-word-pages')).filter`);
  check((await b.ev('document.documentElement.dataset.foDarkPage')) === 'white' && (await filter()) === 'none', 'defaut : page blanche, aucun filtre');
  await shot('darkpage-white-dark');
  // Ouvre Fichier > Options > Affichage puis choisit « inversee » avec un vrai clic.
  await b.ev(`[...document.querySelectorAll('[role=tab], button')].find((x) => x.textContent.trim() === 'Fichier')?.click()`); await sleep(600);
  await b.ev(`[...document.querySelectorAll('.fo-bs__nav-item, [role=menuitem], button')].find((x) => /^Options/.test(x.textContent.trim()))?.click()`); await sleep(800);
  const pick = async (name, value) => {
    await b.ev(`[...document.querySelectorAll('label')].find((l) => l.textContent.includes(${JSON.stringify(value)}))?.querySelector('input')?.click()`);
    await sleep(500);
    check((await b.ev('document.documentElement.dataset.foDarkPage')) === name, `Options : « ${value} » applique en direct (${name})`);
  };
  await pick('invert', 'Page sombre inversée');
  check((await b.ev(`localStorage.getItem('fo-setting:ui.darkPage')`)) === '"invert"', 'persistant (ui.darkPage)');
  check((await filter()).startsWith('invert'), 'page inversee : filtre invert actif a l ecran');
  await b.send('Emulation.setEmulatedMedia', { media: 'print', features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  check((await filter()) === 'none', 'impression : page JAMAIS inversee (filtre none en media print)');
  await b.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await pick('soft', 'blanc cassé');
  await pick('white', 'Page blanche');
  await b.ev(`localStorage.setItem('fo-setting:ui.darkPage', '"invert"')`);
  await b.goto(`${BASE}/?app=word`, 2500);
  check((await b.ev('document.documentElement.dataset.foDarkPage')) === 'invert', 'reglage relu au redemarrage');
  await b.click('.ProseMirror');
  await b.ev(`document.execCommand('selectAll'); document.execCommand('insertHTML', false, ${JSON.stringify(SAMPLE)}); document.querySelector('.ProseMirror').blur()`);
  await sleep(1000);
  await shot('darkpage-invert-dark');
  await b.ev(`document.documentElement.dataset.foDarkPage='soft'`); await sleep(300);
  await shot('darkpage-soft-dark');
  await open('word', 1440, 'light');
  await shot('darkpage-light-ref');

  // 2. Ruban : « auto » = groupes replies (fold) sous 1000 px, passage a la ligne au-dessus ; choix explicite respecte.
  for (const [w, expect] of [[1440, 'wrap'], [1100, 'wrap'], [800, 'fold'], [480, 'fold']]) {
    await open('excel', w, 'light');
    const got = await b.ev('document.documentElement.dataset.foFit');
    check(got === expect, `fit auto a ${w} px = ${got} (attendu ${expect})`);
    await shot(`fit-auto-${w}`);
  }
  await open('excel', 800, 'light', `localStorage.setItem('fo-setting:ui.fit','"wrap"')`);
  check((await b.ev('document.documentElement.dataset.foFit')) === 'wrap', 'choix explicite « wrap » respecte a 800 px');
  await shot('fit-wrap-800');
  await open('excel', 1440, 'light');
  await b.viewport(800, 900); await sleep(600);
  check((await b.ev('document.documentElement.dataset.foFit')) === 'fold', 'redimensionnement 1440 -> 800 : bascule en direct vers fold');
  const errs = b.consoleLog.filter((l) => /^exception/.test(l));
  check(errs.length === 0, `aucune exception (${errs.length})`);
} finally { await b.close(); }
process.exit(bad ? 1 : 0);
