// Barre laterale de Draw en disposition LibreOffice : rail Proprietes / Styles / Galerie / Navigateur / Formes, panneaux et leurs commandes.
// Usage : node apps/web/tests/e2e/lo-draw-panels.mjs <port vite> <port cdp> [dossier de captures]
import { mkdirSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';

const [vitePort = '5391', cdp = '9718', out = ''] = process.argv.slice(2);
if (out) mkdirSync(out, { recursive: true });
const ok = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); if (!cond) process.exitCode = 1; };
const b = await launch({ port: Number(cdp) });
const tab = async (i) => { await b.ev(`(() => { const e = document.querySelectorAll('.fo-ssb__rail .fo-ssb__tab:not(.fo-ssb__menu)')[${i}]; if (e.getAttribute('aria-pressed') !== 'true') e.click(); })()`); await sleep(400); if (out) await b.shot(`${out}/draw-${i}.png`); };
try {
  await b.viewport(1920, 1040);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=publisher`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"libreoffice"'); localStorage.setItem('fo-setting:ui.theme', '"light"')`);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=publisher`, 2500);
  await b.ev(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim().startsWith('A4 (portrait)'))?.click()`); await sleep(1200);
  const titles = await b.ev(`[...document.querySelectorAll('.fo-ssb__rail .fo-ssb__tab:not(.fo-ssb__menu)')].map((x) => x.title)`);
  ok('rail Draw : 5 onglets', JSON.stringify(titles) === JSON.stringify(['Propriétés', 'Styles', 'Galerie', 'Navigateur', 'Formes']), titles.join(','));
  await tab(0);
  await tab(4);
  const shapes = await b.ev(`document.querySelectorAll('.fo-ssb__shapes button').length`);
  ok('Formes : categories et boutons', shapes > 50, String(shapes));
  await b.ev(`document.querySelector('.fo-ssb__shapes button[aria-label="Rectangle"]')?.click()`);
  await tab(3);
  ok('Navigateur : page 1', (await b.ev(`document.querySelectorAll('.fo-ssb__tree [role=treeitem]').length`)) >= 1);
  await tab(1);
  ok('Styles : bouton Gerer', (await b.ev(`!!document.querySelector('.fo-ssb__form .fo-ssb__btn')`)));
  await tab(2);
  ok('Galerie : insertion', (await b.ev(`document.querySelectorAll('.fo-ssb__form .fo-ssb__btn').length`)) === 2);
  await tab(0);
  ok('Proprietes : section Page', (await b.ev(`!!document.querySelector('select[aria-label="Format"]')`)));
  console.log(b.consoleLog.slice(0, 5).join('\n') || 'console propre');
} finally { await b.close(); }
