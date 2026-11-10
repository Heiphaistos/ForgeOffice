// Onglets de documents (modes « tab » et « tab-shared ») dans le vrai navigateur. Usage : node apps/web/tests/e2e/tabs.mjs <port vite> <port cdp> <dossier de captures>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vitePort = '5190', cdp = '9691', outDir = 'shots'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const base = `http://127.0.0.1:${vitePort}/`;
const ok = (name, cond, info = '') => console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`);

const b = await launch({ port: Number(cdp) });
try {
  for (const mode of ['tab-shared', 'tab']) {
    await b.goto(base, 800);
    await b.ev(`localStorage.setItem('fo-setting:ui.openMode', '"${mode}"')`);
    await b.goto(base, 1500);
    await b.ev(`[...document.querySelectorAll('button')].find((x) => /Document vierge/i.test(x.textContent))?.click()`);
    await sleep(2500);
    const tabs = await b.ev(`document.querySelectorAll('.fo-doctab').length`);
    ok(`${mode} : deux onglets (Accueil + Texte)`, tabs === 2, String(tabs));
    const body = await b.ev(mode === 'tab'
      ? `document.querySelector('iframe.fo-tabframe')?.contentDocument?.querySelector('.fo-ribbon') ? 'ruban' : 'vide'`
      : `document.querySelector('.fo-tabpane:not([hidden]) .fo-ribbon') ? 'ruban' : 'vide'`);
    ok(`${mode} : le ruban de Texte s'affiche dans l'onglet`, body === 'ruban', body);
    await b.shot(join(outDir, `tabs-${mode}.png`));
    await b.ev(`document.querySelector('.fo-doctab:not(.is-active) , .fo-doctab')?.click()`);
    await b.ev(`document.querySelectorAll('.fo-doctab')[0].click()`);
    await sleep(300);
    const home = await b.ev(`document.querySelector('.fo-tabpane:not([hidden]) .hub-rail') ? 'accueil' : 'autre'`);
    ok(`${mode} : retour sur l'onglet Accueil`, home === 'accueil', home);
    await b.ev(`document.querySelectorAll('.fo-doctab')[1].querySelector('.fo-doctab__close').click()`);
    await sleep(400);
    ok(`${mode} : fermeture de l'onglet`, (await b.ev(`document.querySelectorAll('.fo-doctab').length`)) === 0);
  }
  console.log(b.consoleLog.slice(0, 8).join('\n') || 'console propre');
} finally {
  await b.close();
}
