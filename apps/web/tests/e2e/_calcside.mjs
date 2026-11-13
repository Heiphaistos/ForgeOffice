import { launch, sleep } from './harness.mjs';
const [out = '/d/Temp/wtlogaps/c2', app = 'excel'] = process.argv.slice(2);
const b = await launch({ port: 9714 });
try {
  await b.viewport(1920, 1040);
  await b.goto(`http://127.0.0.1:5391/?app=${app}`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"libreoffice"'); localStorage.setItem('fo-setting:ui.theme', '"light"'); localStorage.removeItem('fo-setting:ui.sidebar.panel')`);
  await b.goto(`http://127.0.0.1:5391/?app=${app}`, 2500);
  const n = await b.ev(`document.querySelectorAll('.fo-oo-rail--right .fo-oo-rail__btn').length`);
  console.log('rail', n, JSON.stringify(await b.ev(`[...document.querySelectorAll('.fo-oo-rail--right .fo-oo-rail__btn')].map(x=>x.title)`)));
  for (let i = 0; i < n; i++) {
    await b.ev(`(()=>{const e=[...document.querySelectorAll('.fo-oo-rail--right .fo-oo-rail__btn')][${i}]; if(e.getAttribute('aria-pressed')==='true') return; e.click();})()`);
    await sleep(500);
    await b.shot(`${out}/my_${app}_${i}.png`);
  }
  console.log(b.consoleLog.slice(0, 5).join('\n') || 'console propre');
} finally { await b.close(); }
