// Captures de NOS panneaux/boites en disposition OnlyOffice pour les comparer a la vraie appli. Usage : node oo-dialogs-shots.mjs <port vite> <port cdp> <dossier> [theme ooTheme]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vite = '5410', cdp = '9731', out = 'shots', theme = 'dark', ooTheme = 'dark'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"')`);
  await b.ev(`localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"${ooTheme}"')`);
  await b.ev(`localStorage.setItem('fo-setting:ui.theme', '"${theme}"')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=word`, 2500);
  await b.ev(`if (!document.querySelector('.fo-oo-panel')) document.querySelector('.fo-oo-rail--right .fo-oo-rail__btn')?.click()`);
  await sleep(600);
  await b.shot(join(out, 'mien-word-panneau.png'));
  // Boite « Paragraphe - Parametres avances » par le lien du panneau, puis ses 6 pages.
  await b.ev(`document.querySelector('.fo-oo-pform__link')?.click()`);
  await sleep(700);
  await b.shot(join(out, 'mien-paragraphe-avances.png'));
  for (let i = 1; i < 6; i++) {
    await b.ev(`document.querySelectorAll('.fo-oo-dlgtabs__tab')[${i}]?.click()`);
    await sleep(250);
    await b.shot(join(out, `mien-paragraphe-p${i}.png`));
  }
  await b.ev(`document.querySelector('.fo-dialog__footer .fo-btn:not(.fo-btn--primary)')?.click()`);
  await sleep(300);
  await b.click('text=Insertion'); await sleep(500);
  await b.ev(`[...document.querySelectorAll('.fo-ribbon button')].find((x) => x.textContent.trim() === 'Lien')?.click()`);
  await sleep(700);
  await b.shot(join(out, 'mien-lien.png'));
} finally { await b.close(); }
