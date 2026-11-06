// Capture de reference du rendu de la grille (hygiene : extraction de paint.ts sans changer le rendu).
// Usage : node cf-paint-compare.mjs <port vite> <port cdp> <dossier>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';
import { helpers, paintFixture } from './cf-lib.mjs';

const [vitePort = '5426', cdp = '9686', outDir = 'shots'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1100, 700);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=excel`, 1500);
  const { openFile, tab } = helpers(b, () => {});
  await openFile('paint.xlsx', await paintFixture());
  await b.shot(join(outDir, 'grille.png'));
  await tab('Formules');
  await sleep(300);
  await b.click('text=Feuille 1').catch(() => undefined);
  await b.shot(join(outDir, 'formules.png'));
  await b.clickText('[role=tab]', 'Ventes').catch(() => undefined);
  const sheets = await b.ev(`[...document.querySelectorAll('[role=tab]')].map((e) => e.textContent.trim()).join('|')`);
  console.log('onglets', sheets);
  await b.clickText('[role=tab]', 'Sauts').catch(() => undefined);
  await sleep(500);
  await b.shot(join(outDir, 'sauts.png'));
} finally {
  await b.close();
}
