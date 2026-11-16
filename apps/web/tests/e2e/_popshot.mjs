// Photo d'un popup de menu de la suite imitee (comparaison a la vraie fenetre).  node _popshot.mjs <vite> <cdp> <app> <layout> <menu index> <sortie.png> [dark]
import { launch, sleep } from './harness.mjs';
const [vite, cdp, app, layout, idx, out, theme = 'light'] = process.argv.slice(2);
const b = await launch({ port: Number(cdp) });
try {
  await b.viewport(Number(process.env.FO_W ?? 1936), Number(process.env.FO_H ?? 1048));
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"${theme}"')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 2500);
  await b.ev(`document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')[${idx}].click()`);
  await sleep(500);
  const r = await b.ev(`(() => { const r = document.querySelector('.fo-menu').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  if (process.env.FULL) await b.shot(out);
  else { const s = await b.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } }); (await import('node:fs')).writeFileSync(out, Buffer.from(s.data, 'base64')); }
  console.log(JSON.stringify(r));
} finally { await b.close(); }
