// Vue Fichier du profil OnlyOffice (Infos sur le document, Parametres avances) : captures de NOTRE appli. Usage : node oo-file-shots.mjs <port vite> <port cdp> <dossier> [app]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './harness.mjs';

const [vite = '5410', cdp = '9732', out = 'shots', app = 'word'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"'); localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"dark"'); localStorage.setItem('fo-setting:ui.theme', '"dark"')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 2500);
  await b.click('text=Fichier'); await sleep(700);
  await b.shot(join(out, `mien-${app}-fichier.png`));
  for (const [id, label] of [['info', 'Info'], ['options', 'Paramètres avancés']]) {
    await b.ev(`[...document.querySelectorAll('.fo-backstage button, .fo-bs button, nav button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)})?.click()`);
    await sleep(600);
    await b.shot(join(out, `mien-${app}-${id}.png`));
  }
} finally { await b.close(); }
