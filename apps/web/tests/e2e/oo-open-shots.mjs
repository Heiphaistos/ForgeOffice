// Ouvre un fichier du depot dans un module (profil OnlyOffice) puis clique/capture. Usage : node oo-open-shots.mjs <vite> <cdp> <dossier> <app> <fichier> <theme> <etape...>
// Etapes : `click:<sel>`, `ev:<js>`, `wait:<ms>`, sinon nom de capture.
import { mkdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { launch, sleep } from './harness.mjs';
const [vite, cdp, out, app, file, theme = 'dark', ...steps] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"'); localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"${theme}"'); localStorage.removeItem('fo-setting:ui.onlyoffice.panel')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}&e2e=1`, 1800);
  await b.pick(basename(file), readFileSync(file));
  await b.click('text=Fichier'); await sleep(350);
  await b.clickText('.fo-bs__nav-item, [role=menuitem], .fo-menu button', 'Ouvrir'); await sleep(500);
  for (const label of ['Parcourir', 'Ouvrir…']) {
    if (await b.ev(`[...document.querySelectorAll('.fo-bs button')].some((e) => e.textContent.trim() === ${JSON.stringify(label)})`)) { await b.clickText('.fo-bs button', label); break; }
  }
  await sleep(2500);
  for (const s of steps) {
    if (s.startsWith('click:')) { await b.click(s.slice(6)); await sleep(500); }
    else if (s.startsWith('ev:')) { console.log(await b.ev(s.slice(3))); await sleep(500); }
    else if (s.startsWith('goto:')) {
      await b.ev(`[...document.querySelectorAll('input')].find((e) => /^[A-Z]{1,3}[0-9]+(:[A-Z]{1,3}[0-9]+)?$/.test(e.value))?.setAttribute('data-e2e', 'nb')`);
      await b.click('[data-e2e=nb]'); await b.key('a', { ctrl: true, commands: ['selectAll'] }); await b.press(`${s.slice(5)}
`); await sleep(600);
    }
    else if (s.startsWith('ctrl:')) { await b.key(s.slice(5), { ctrl: true }); await sleep(600); }
    else if (s.startsWith('key:')) { await b.key(s.slice(4)); await sleep(300); }
    else if (s.startsWith('wait:')) await sleep(Number(s.slice(5)));
    else await b.shot(`${out}/${s}.png`);
  }
} finally { await b.close(); }
