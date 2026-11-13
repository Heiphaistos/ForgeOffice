import { mkdirSync, readFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
const [vite, cdp, out, app, theme = 'dark'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await launch({ port: Number(cdp) });
const png = readFileSync('' + new URL('./zz-names.png', import.meta.url).pathname.slice(1) + '');
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"'); localStorage.setItem('fo-setting:ui.onlyoffice.theme', '"${theme}"'); localStorage.removeItem('fo-setting:ui.onlyoffice.panel')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}&e2e=1`, 1800);
  await b.click('text=Insertion'); await sleep(400);
  await b.pick('a.png', png);
  await b.click('text=Images'); await sleep(1500);
  await b.shot(`${out}/${app}-img0.png`);
  const sel = app === 'word' ? '.ProseMirror img' : 'img';
  await b.ev(`document.querySelector(${JSON.stringify(sel)})?.click()`); await sleep(500);
  await b.click(sel).catch(() => {}); await sleep(800);
  await b.shot(`${out}/${app}-img1.png`);
} finally { await b.close(); }
