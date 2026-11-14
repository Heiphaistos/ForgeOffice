import { launch, sleep } from './harness.mjs';
const [vite, cdp, app, layout] = process.argv.slice(2);
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(1936, 1048);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"light"')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 2500);
  if (app === 'publisher') { try { await b.click('text=A4 (portrait)'); await sleep(800); } catch {} }
  const r = await b.ev(`[...document.querySelectorAll('.fo-suite__bar')].map((bar) => { const br = bar.getBoundingClientRect(); return { y: br.y, h: br.height, items: [...bar.children].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.x*10)/10, Math.round(r.width*10)/10, Math.round(r.y), Math.round(r.height), c.className.replace(/fo-suite__/g,'').slice(0,40), (c.getAttribute('title')||c.getAttribute('aria-label')||c.textContent||'').slice(0,24)]; }) }; })`);
  console.log(JSON.stringify(r));
} finally { await b.close(); }
