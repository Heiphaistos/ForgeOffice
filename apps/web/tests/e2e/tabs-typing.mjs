// Saisie reelle dans l'editeur d'un onglet isole (cadre) puis partage. Usage : node tabs-typing.mjs <port vite> <port cdp>
import { launch, sleep } from './harness.mjs';

const [vitePort = '5190', cdp = '9692'] = process.argv.slice(2);
const base = `http://127.0.0.1:${vitePort}/`;
const b = await launch({ port: Number(cdp) });
let bad = 0;
try {
  for (const mode of ['tab', 'tab-shared', 'window']) {
    await b.goto(base, 800);
    await b.ev(`localStorage.setItem('fo-setting:ui.openMode', '"${mode}"')`);
    await b.goto(base, 1500);
    await b.ev(`[...document.querySelectorAll('button')].find((x) => /Document vierge/i.test(x.textContent))?.click()`);
    await sleep(2500);
    if (mode === 'window') { console.log('SKIP window (pas d\'onglet dans le navigateur)'); continue; }
    const sel = mode === 'tab' ? `document.querySelector('iframe.fo-tabframe').contentDocument` : `document`;
    const rect = await b.ev(`(() => { const d = ${sel}; const e = d.querySelector('[contenteditable="true"]'); const r = e.getBoundingClientRect(); const f = ${mode === 'tab' ? `document.querySelector('iframe.fo-tabframe').getBoundingClientRect()` : `{x:0,y:0}`}; return { x: f.x + r.x + 20, y: f.y + r.y + 10 }; })()`);
    await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
    for (const ch of 'Bonjour') await b.send('Input.dispatchKeyEvent', { type: 'char', text: ch });
    await sleep(500);
    const text = await b.ev(`(${sel}).querySelector('[contenteditable="true"]').textContent`);
    const okk = text.includes('Bonjour');
    if (!okk) bad++;
    console.log(`${okk ? 'OK  ' : 'FAIL'} ${mode} : saisie dans l'editeur`, JSON.stringify(text.slice(0, 40)));
  }
} finally {
  await b.close();
}
process.exit(bad ? 1 : 0);
