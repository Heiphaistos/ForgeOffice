// « Format de cellule » au format telephone (390 x 844, tactile) : la boite tient dans l'ecran, chaque onglet est atteignable,
// aucun debordement horizontal de la page. Usage : node apps/web/tests/e2e/format-cells-mobile.mjs <port vite> <port cdp> <dossier>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vitePort = '5421', cdp = '9681', outDir = 'shots'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
let failed = 0;
const ok = (name, cond, info = '') => { if (!cond) failed++; console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); };
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(390, 844, true);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=excel`, 2000);
  await b.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 280 }] });
  await b.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(300);
  await b.key('1', { ctrl: true });
  await b.waitFor(`document.querySelector('.fo-dialog')`);
  for (const [tab, file] of [['Nombre', 'm0-nombre'], ['Alignement', 'm1-alignement'], ['Police', 'm2-police'], ['Bordure', 'm3-bordure'], ['Remplissage', 'm4-remplissage'], ['Protection', 'm5-protection']]) {
    // L'onglet est atteignable meme si la barre defile : on le fait defiler dans la vue puis on touche.
    await b.ev(`[...document.querySelectorAll('.fo-dialog [role=tab]')].find((e) => e.textContent.trim() === ${JSON.stringify(tab)})?.scrollIntoView({ inline: 'center' })`);
    await b.clickText('.fo-dialog [role=tab]', tab, { touch: true });
    await sleep(300);
    await b.shot(join(outDir, `${file}.png`));
    const m = await b.ev(`(() => { const d = document.querySelector('.fo-dialog').getBoundingClientRect(); const body = document.querySelector('.fo-dialog__body'); return JSON.stringify({ l: Math.round(d.left), r: Math.round(d.right), t: Math.round(d.top), bt: Math.round(d.bottom), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, bodyOverflowX: body ? body.scrollWidth > body.clientWidth + 1 : null }); })()`);
    const o = JSON.parse(m);
    ok(`mobile ${tab} : la boite tient dans l'ecran et la page ne defile pas en largeur`, o.l >= 0 && o.r <= o.vw && o.bt <= o.vh && o.sw <= o.vw && !o.bodyOverflowX, m);
  }
  const okBtn = await b.ev(`(() => { const e = [...document.querySelectorAll('.fo-dialog button')].find((x) => x.textContent.trim() === 'OK'); const r = e?.getBoundingClientRect(); return !!r && r.bottom <= innerHeight && r.right <= innerWidth; })()`);
  ok('mobile : le bouton OK est visible', okBtn);
} finally {
  await b.close();
}
console.log(failed ? `${failed} ECHEC(S)` : 'TOUT PASSE');
process.exit(failed ? 1 : 0);
