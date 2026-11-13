import { launch, sleep } from './harness.mjs';
const [top, layout='libreoffice', out='/d/Temp/lo-shots/m/fo-view.png'] = process.argv.slice(2);
const b = await launch({ port: 9697 });
try {
  await b.goto('http://127.0.0.1:5391/?app=word', 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"light"')`);
  await b.goto('http://127.0.0.1:5391/?app=word', 2500);
  await b.ev(`[...document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')].find(x=>new RegExp('^'+${JSON.stringify(top)}).test(x.textContent)).click()`);
  await sleep(400);
  await b.shot(out);
  console.log(JSON.stringify(await b.ev(`[...document.querySelectorAll('.fo-menu [role^=menuitem]')].map(x=>x.textContent.replace(/\s+/g,' ')+(x.getAttribute('aria-disabled')?' (off)':'')+(x.getAttribute('aria-checked')==='true'?' [x]':''))`)));
} finally { await b.close(); }
