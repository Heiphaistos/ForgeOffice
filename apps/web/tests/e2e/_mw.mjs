import { launch, sleep } from './harness.mjs';
const [layout='libreoffice', app='word', shotDir=''] = process.argv.slice(2);
const b = await launch({ port: 9711 });
try {
  await b.goto(`http://127.0.0.1:5391/?app=${app}`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"light"')`);
  await b.goto(`http://127.0.0.1:5391/?app=${app}`, 2500);
  const n = await b.ev(`document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item').length`);
  const out = [];
  for (let i = 0; i < n; i++) {
    await b.ev(`document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')[${i}].click()`);
    await sleep(250);
    out.push(await b.ev(`(()=>{const m=document.querySelector('.fo-menu');if(!m)return null;const r=m.getBoundingClientRect();const it=[...m.querySelectorAll('[role^=menuitem]')];const sc=m.querySelector('.fo-menu__shortcut');return {top:document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')[${i}].textContent,w:Math.round(r.width),h:Math.round(r.height),items:it.length,sc:sc?Math.round(m.getBoundingClientRect().right-sc.getBoundingClientRect().right):null}})()`));
    if (shotDir) await b.shot(`${shotDir}/my_${app}_${i}.png`);
    await b.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
    await sleep(150);
  }
  console.log(JSON.stringify(out));
} finally { await b.close(); }
