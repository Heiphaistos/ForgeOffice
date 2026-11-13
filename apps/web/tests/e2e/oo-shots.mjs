// Captures du profil OnlyOffice : chaque module, clair et sombre, onglets listes. Usage : node oo-shots.mjs <port vite> <port cdp> <dossier> [apps...]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vite = '5391', cdp = '9721', out = 'shots', ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const APPS = only.length ? only : ['word', 'excel', 'powerpoint', 'pdf', 'notes', 'publisher', 'hub'];
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"')`);
  const ooTheme = process.env.FO_OO_THEME ?? 'auto'; // auto | classic-light | white | dark | contrast-dark
  await b.ev(`localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"${ooTheme}"')`);
  for (const theme of ['light', 'dark']) {
    await b.ev(`localStorage.setItem('fo-setting:ui.theme', '"${theme}"')`);
    for (const app of APPS) {
      await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 2000);
      await b.shot(join(out, `oo-${app}-${theme}${ooTheme === 'auto' ? '' : '-' + ooTheme}.png`));
      const tabs = await b.ev(`[...document.querySelectorAll('.fo-ribbon__tab')].map((t) => t.textContent.trim()).join(' | ')`);
      console.log(`${app} ${theme}: ${tabs}`);
    }
  }
} finally { await b.close(); }
