// Writer en disposition LibreOffice : Insertion > Marque de formatage > Espace insecable insere bien U+00A0 dans le document.
// Usage : node apps/web/tests/e2e/lo-gaps-chars.mjs <port vite> <port cdp>
import { launch, sleep } from './harness.mjs';

const [vitePort = '5391', cdp = '9793'] = process.argv.slice(2);
const ok = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); if (!cond) process.exitCode = 1; };
const b = await launch({ port: Number(cdp) });
const click = (text, scope = 'body') => b.ev(`(() => { const e = [...document.querySelectorAll('${scope} [role=menuitem], ${scope} button')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)})); if (!e) return false; e.click(); return true; })()`);
try {
  await b.goto(`http://127.0.0.1:${vitePort}/?app=word`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"libreoffice"')`);
  await b.viewport(1600, 900);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=word`, 2500);
  await b.ev(`document.querySelector('.ProseMirror').focus()`);
  await b.press('A');
  ok('menu Insertion', await click('Insertion', '.fo-menubar__row'));
  await sleep(300);
  ok('sous-menu Marque de formatage', await click('Marque de formatage', '[role=menu]'));
  await sleep(300);
  ok('Espace insecable', await click('Espace insécable', '[role=menu]'));
  await sleep(300);
  const text = await b.ev(`document.querySelector('.ProseMirror').textContent`);
  ok('U+00A0 insere', / /.test(text), JSON.stringify(text.slice(0, 30)));
} finally { await b.close(); }
