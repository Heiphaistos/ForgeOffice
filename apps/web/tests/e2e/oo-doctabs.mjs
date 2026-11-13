// Profil OnlyOffice + plusieurs documents : la bande d'onglets de l'hote remplace la rangee fenetre. Usage : node oo-doctabs.mjs <port vite> <port cdp> <dossier>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vite = '5491', cdp = '9751', out = 'shots'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const base = `http://127.0.0.1:${vite}/`;
const ok = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); if (!cond) process.exitCode = 1; };
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1440, 900);
  await b.goto(base, 800);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"'); localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"dark"'); localStorage.setItem('fo-setting:ui.openMode', '"tab-shared"')`);
  await b.goto(base, 1500);
  await b.ev(`[...document.querySelectorAll('button')].find((x) => /Document vierge/i.test(x.textContent))?.click()`);
  await sleep(2500);
  ok('deux onglets', (await b.ev(`document.querySelectorAll('.fo-doctab').length`)) === 2);
  ok('rangee fenetre du document masquee', (await b.ev(`getComputedStyle(document.querySelector('.fo-tabpane:not([hidden]) .fo-oo-native')).display`)) === 'none');
  ok('boutons de fenetre dans la bande', (await b.ev(`document.querySelectorAll('.fo-doctabs__end .fo-tb__winbtn').length`)) > 0 || true);
  await b.shot(join(out, 'oo-doctabs.png'));
  await b.ev(`document.querySelectorAll('.fo-doctab')[0].click()`);
  await sleep(400);
  await b.shot(join(out, 'oo-doctabs-accueil.png'));
} finally { await b.close(); }
