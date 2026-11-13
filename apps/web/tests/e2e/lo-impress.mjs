// Impress / Draw en disposition LibreOffice ou OpenOffice : capture + verifications de structure.
// Usage : node apps/web/tests/e2e/lo-impress.mjs <port vite> <port cdp> <dossier> [app=powerpoint|publisher] [layout] [theme] [largeur] [hauteur] [js a evaluer avant la capture]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vitePort = '5311', cdp = '9711', outDir = 'shots', app = 'powerpoint', layout = 'libreoffice', theme = 'light', w = '1936', h = '1048', pre = ''] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const ok = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); if (!cond) process.exitCode = 1; };
const b = await launch({ port: Number(cdp) });
try {
  await b.goto(`http://127.0.0.1:${vitePort}/?app=${app}`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"${theme}"')`);
  await b.viewport(Number(w), Number(h));
  await b.goto(`http://127.0.0.1:${vitePort}/?app=${app}`, 2500);
  if (pre) { await b.ev(pre); await sleep(600); }
  const info = await b.ev(`(() => { const q = (s) => document.querySelectorAll(s).length; return { suite: q('.fo-suite'), bars: q('.fo-suite__bar'), slides: q('[data-slide-thumb], .fo-ppt-thumb, .fo-slidepanel__item'), overflowX: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
  console.log(JSON.stringify(info));
  ok('suite presente', info.suite >= 1);
  ok('pas de debordement horizontal', !info.overflowX);
  await b.shot(join(outDir, `${layout}-${app}-${theme}${pre ? '-x' : ''}.png`));
  console.log(b.consoleLog.slice(0, 8).join('\n') || 'console propre');
} finally {
  await b.close();
}
