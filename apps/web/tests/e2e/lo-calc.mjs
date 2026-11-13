// Copie de LibreOffice/OpenOffice Calc : captures ForgeOffice (grille, formule, en-tetes, onglets, barre d'etat) + verifications.
// Usage : node apps/web/tests/e2e/lo-calc.mjs <port vite> <port cdp> <dossier> [layout] [theme] [largeur] [hauteur]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vitePort = '5291', cdp = '9694', outDir = 'shots', layout = 'libreoffice', theme = 'light', W = '1920', H = '1040', deck = ''] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const ok = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); if (!cond) process.exitCode = 1; };
const b = await launch({ port: Number(cdp) });
try {
  const mobile = Number(W) < 720;
  await b.viewport(Number(W), Number(H), mobile);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=excel`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"${theme}"'); ${deck ? `localStorage.setItem('fo-setting:ui.sidebar.panel', '"settings"')` : `localStorage.removeItem('fo-setting:ui.sidebar.panel')`}`);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=excel`, 2500);
  await b.shot(join(outDir, `calc-${layout}-${theme}-${W}.png`));
  if (!mobile) {
    // Etat de comparaison : A1 « Alpha », B1 12,5 ; plage B3:D5 selectionnee (comme sur la vraie fenetre).
    const box = await b.ev(`(() => { const r = document.querySelector('.xl-grid').getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
    const at = async (col, row, shift = false) => {
      const x = box.x + 36 + 82 * col + 40; const y = box.y + 18 + 17 * row + 8;
      await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: shift ? 8 : 0 });
      await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers: shift ? 8 : 0 });
      await sleep(120);
    };
    await at(0, 0); await b.press('Alpha'); await b.key('Tab'); await b.press('12,5'); await b.key('Enter');
    await at(1, 2); await at(3, 4, true);
    await sleep(300);
    await b.shot(join(outDir, `calc-${layout}-${theme}-${W}${deck ? '-deck' : ''}-sel.png`));
  }
  const over = await b.ev(`document.documentElement.scrollWidth - window.innerWidth`);
  ok('pas de debordement horizontal', over <= 0, String(over));
  const parts = await b.ev(`({ fx: !!document.querySelector('.xl-fbar'), tabs: !!document.querySelector('.xl-tabs'), sb: !!document.querySelector('.fo-sb') })`);
  ok('zones presentes', parts.fx && parts.tabs && parts.sb, JSON.stringify(parts));
  console.log(b.consoleLog.slice(0, 8).join('\n') || 'console propre');
} finally {
  await b.close();
}
