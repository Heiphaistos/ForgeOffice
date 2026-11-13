// Panneau Parametres du profil OnlyOffice : paragraphe, puis tableau apres sa creation. Usage : node oo-panel.mjs <port vite> <port cdp> <dossier> [theme]
import { mkdirSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
const [vite, cdp, out, theme = 'dark'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"'); localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"${theme}"'); localStorage.removeItem('fo-setting:ui.onlyoffice.panel')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=word`, 1800);
  await b.ev(`if (!document.querySelector('.fo-oo-panel')) document.querySelector('.fo-oo-rail--right .fo-oo-rail__btn')?.click()`); await sleep(500);
  await b.shot(`${out}/panneau-paragraphe-${theme}.png`);
  await b.click('text=Insertion'); await sleep(400); await b.click('text=Tableau'); await sleep(500);
  await b.ev(`document.querySelector('.fo-popover')?.querySelectorAll('div,button')[8]?.click()`); await sleep(900);
  await b.shot(`${out}/panneau-tableau-${theme}.png`);
} finally { await b.close(); }
