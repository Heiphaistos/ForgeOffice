// Captures du profil OnlyOffice par etapes. Usage : node oo-step-shots.mjs <port vite> <port cdp> <dossier> <app> <theme> <etape...>
// Etape : `nom` (capture), `click:<selecteur>`, `ev:<js>`, `wait:<ms>`, `file:<chemin>` (ouvre un fichier par le selecteur cache), `cap:<nom>`.
import { mkdirSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
const [vite, cdp, out, app = 'word', theme = 'dark', ...steps] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"'); localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"${theme}"'); localStorage.removeItem('fo-setting:ui.onlyoffice.panel')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}&e2e=1`, 1800);
  for (const s of steps) {
    if (s.startsWith('click:')) { await b.click(s.slice(6)); await sleep(500); }
    else if (s.startsWith('ev:')) { console.log(await b.ev(s.slice(3))); await sleep(500); }
    else if (s.startsWith('key:')) { await b.key(s.slice(4)); await sleep(300); }
    else if (s.startsWith('wait:')) await sleep(Number(s.slice(5)));
    else await b.shot(`${out}/${s}.png`);
  }
} finally { await b.close(); }
