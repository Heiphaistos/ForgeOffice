// Banc mobile du lot Formules et noms (400 x 860 tactile) : l'onglet Formules, ses menus et ses boites restent atteignables au doigt,
// sans defilement horizontal de la page. Variables : FO_PORT (Vite, 5424), FO_CDP_PORT (9694), FO_SHOTS.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const PORT = process.env.FO_PORT ?? '5424';
const SHOTS = process.env.FO_SHOTS ?? 'shots-formulas';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` : ${detail}` : ''}`); };
const b = await launch({ port: Number(process.env.FO_CDP_PORT ?? 9694) });
const shot = (n) => b.shot(join(SHOTS, `${n}.png`));
const W = 400;
const metrics = () => b.ev(`(() => ({ scrollW: document.documentElement.scrollWidth, dialogW: document.querySelector('.fo-dialog')?.getBoundingClientRect().width ?? 0 }))()`);
const tap = async (label) => {
  const ok = await b.ev(`(() => { const e = [...document.querySelectorAll('button, [role=tab], [role=menuitem], [role=menuitemradio]')].filter((x) => x.getBoundingClientRect().width > 0 && (x.getAttribute('aria-label') === ${JSON.stringify(label)} || x.textContent.trim() === ${JSON.stringify(label)}))[0]; if (!e) return false; e.setAttribute('data-e2e', 'x'); return true; })()`);
  if (!ok) throw new Error(`introuvable : ${label}`);
  try { await b.click('[data-e2e=x]', { touch: true }); } finally { await b.ev(`document.querySelector('[data-e2e=x]')?.removeAttribute('data-e2e')`); }
  await sleep(350);
};
const reach = (label) => b.ev(`[...document.querySelectorAll('button, [role=tab], [role=menuitem]')].some((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && (x.getAttribute('aria-label') === ${JSON.stringify(label)} || x.textContent.trim() === ${JSON.stringify(label)}); })`);

try {
  await b.viewport(W, 860, true);
  await b.goto(`http://127.0.0.1:${PORT}/?app=excel`, 1500);
  await b.ev(`document.querySelector('.fo-dialog button')?.textContent.trim() === 'Ignorer' && document.querySelector('.fo-dialog button + button, .fo-dialog button')?.click()`);
  await tap('Formules');
  await shot('m01-onglet-formules');
  let m = await metrics();
  check('onglet Formules : pas de défilement horizontal de la page', m.scrollW <= W, `${m.scrollW} > ${W}`);
  // Chaque nouveau controle doit etre visible ou atteignable (le ruban compact les range dans des menus).
  const wanted = ['Gestionnaire de noms', 'Insérer une fonction', 'Calculer maintenant'];
  for (const l of wanted) check(`atteignable au toucher : ${l}`, await reach(l));
  await tap('Gestionnaire de noms');
  m = await metrics();
  check('gestionnaire de noms : boîte contenue dans l’écran', m.dialogW > 0 && m.dialogW <= W, `${m.dialogW}`);
  await shot('m02-gestionnaire-de-noms');
  await tap('Fermer');
  await tap('Insérer une fonction');
  m = await metrics();
  check('Insérer une fonction : boîte contenue dans l’écran', m.dialogW > 0 && m.dialogW <= W, `${m.dialogW}`);
  await shot('m03-inserer-une-fonction');
  await tap('Annuler');
} catch (e) {
  console.error(e);
  check('exception', false, e.message);
} finally {
  await b.close();
}
const allOk = results.every((r) => r.ok);
console.log(allOk ? 'TOUT OK' : 'ECHECS');
process.exit(allOk ? 0 : 1);
