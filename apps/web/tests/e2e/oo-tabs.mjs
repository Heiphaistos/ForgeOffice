// Captures des onglets du profil OnlyOffice. Usage : node oo-tabs.mjs <port vite> <port cdp> <dossier> <app> <theme> <onglet...>
import { mkdirSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
const [vite, cdp, out, app = 'word', theme = 'dark', ...tabs] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"'); localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"${theme}"')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 1800);
  for (const t of tabs) { await b.click('text=' + t); await sleep(500); await b.shot(`${out}/${t.replace(/[^a-z]/gi, '_')}.png`); }
} finally { await b.close(); }
