// Dispositions : chaque disposition s'affiche, garde les memes commandes (menu ou ruban), et se change en direct. Usage : node apps/web/tests/e2e/layouts.mjs <port vite> <port cdp> <dossier de captures> [app]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vitePort = '5190', cdp = '9692', outDir = 'shots', app = 'word'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const url = `http://127.0.0.1:${vitePort}/?app=${app}`;
const ok = (name, cond, info = '') => console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`);
const IDS = ['office', 'office-simplified', 'onlyoffice', 'libreoffice', 'openoffice', 'menus-classic', 'ribbon-compact', 'google', 'dropdown', 'touch'];

const b = await launch({ port: Number(cdp) });
try {
  await b.goto(url, 800);
  for (const id of IDS) {
    await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${id}"')`);
    await b.goto(url, 1800);
    const dom = await b.ev(`document.documentElement.dataset.layout`);
    const family = await b.ev(`document.querySelector('.fo-menubar') ? 'menus' : document.querySelector('.fo-ribbon') ? 'ruban' : 'rien'`);
    if (family === 'rien' && ['hub', 'access'].includes(app)) { console.log(`SKIP ${id} : pas de ruban sur cet ecran`); continue; }
    ok(`${id} : appliquee (${family})`, dom === id && family !== 'rien', dom);
    if (family === 'menus') {
      await b.ev(`document.querySelectorAll('.fo-menubar__item')[1]?.click()`);
      await sleep(300);
      const items = await b.ev(`document.querySelectorAll('.fo-menu [role="menuitem"]').length`);
      ok(`${id} : premier menu rempli`, items >= 1, String(items));
    }
    await b.shot(join(outDir, `layout-${app}-${id}.png`));
  }
  // Changement en direct depuis le menu « Disposition » de la barre de menus, sans recharger.
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"libreoffice"')`);
  await b.goto(url, 1500);
  if (!(await b.ev(`Boolean(document.querySelector('.fo-menubar__layout'))`))) { console.log('SKIP menu Disposition : pas de barre de menus ici'); await b.close(); process.exit(0); }
  await b.ev(`document.querySelector('.fo-menubar__layout').click()`);
  await sleep(300);
  await b.ev(`[...document.querySelectorAll('.fo-menu [role="menuitem"], .fo-menu [role="menuitemcheckbox"], .fo-menu [role="menuitemradio"]')].find((x) => /OnlyOffice/.test(x.textContent))?.click()`);
  await sleep(500);
  ok('menu Disposition : passe de LibreOffice a OnlyOffice en direct', (await b.ev(`document.documentElement.dataset.layout`)) === 'onlyoffice' && (await b.ev(`Boolean(document.querySelector('.fo-ribbon--l-onlyoffice'))`)));
  // Reglage propre a un module : Texte en LibreOffice, le reste en OnlyOffice.
  await b.ev(`localStorage.setItem('fo-setting:ui.layout.${app}', '"libreoffice"')`);
  await b.goto(url, 1500);
  ok('exception par module respectee', (await b.ev(`document.documentElement.dataset.layout`)) === 'libreoffice');
  console.log(b.consoleLog.slice(0, 8).join('\n') || 'console propre');
} finally {
  await b.close();
}
