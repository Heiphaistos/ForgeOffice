// Releve l'arbre COMPLET des menus de la suite imitee (libelles, raccourcis, filets, sous-menus, largeur des popups) : meme forme que uia_menus.py.
//   node _menutree.mjs <vite-port> <cdp-port> <app> <layout> <sortie.json>
import { writeFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
const [vite, cdp, app, layout, out] = process.argv.slice(2);
const b = await launch({ port: Number(cdp) });
const READ = `(m) => { const r = m.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }`;
try {
  await b.viewport(1936, 1048);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"'); localStorage.setItem('fo-setting:ui.theme', '"light"')`);
  await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 2500);
  if (app === 'publisher') { try { await b.click('text=A4 (portrait)'); await sleep(800); } catch {} }
  const tops = await b.ev(`[...document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')].map((x) => x.textContent.trim())`);
  const dump = (depth) => `(() => { const ms = [...document.querySelectorAll('.fo-menu')]; const m = ms[${depth}]; if (!m) return null; const read = ${READ};
    return { ...read(m), items: [...m.children].filter((c) => c.getAttribute('role') !== 'presentation' && !c.classList.contains('fo-sheet__back')).map((c) => { const lab = c.querySelector('.fo-menu__label'); const sc = c.querySelector('.fo-menu__shortcut');
      if (c.getAttribute('role') === 'separator') return { t: '-' };
      const r = c.getBoundingClientRect(); return { t: c.getAttribute('aria-haspopup') || c.querySelector('.fo-menu__chevron') ? 's' : 'i', name: lab ? lab.textContent : c.textContent, acc: sc ? sc.textContent : '', en: c.getAttribute('aria-disabled') !== 'true' && !c.classList.contains('is-disabled'), w: Math.round(r.width), y: Math.round(r.y - m.getBoundingClientRect().y) }; }) }; })()`;
  const walk = async (depth) => {
    const d = await b.ev(dump(depth));
    if (!d) return null;
    const idx = d.items.map((it, i) => (it.t === 's' ? i : -1)).filter((i) => i >= 0);
    for (const i of idx) {
      await b.ev(`(() => { const m = document.querySelectorAll('.fo-menu')[${depth}]; const c = [...m.children].filter((c) => c.getAttribute('role') !== 'presentation' && !c.classList.contains('fo-sheet__back'))[${i}]; c.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); })()`);
      await sleep(380);
      const sub = await walk(depth + 1);
      if (sub) { d.items[i].items = sub.items; d.items[i].sw = sub.w; }
    }
    return d;
  };
  const res = [];
  for (let i = 0; i < tops.length; i++) {
    await b.ev(`document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')[${i}].click()`);
    await sleep(300);
    const d = await walk(0);
    res.push({ name: tops[i], ...(d ?? { items: [] }) });
    await b.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
    await sleep(150);
  }
  writeFileSync(out, JSON.stringify({ menus: res }));
  console.log('menus', res.length, 'items', res.reduce((n, m) => n + m.items.length, 0));
} finally { await b.close(); }
