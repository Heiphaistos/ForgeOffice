// Les boites LibreOffice / OpenOffice appliquent bien leurs reglages au document. Usage : node apps/web/tests/e2e/lo-dialogs-apply.mjs <port vite> <port cdp>
import { launch, sleep } from './harness.mjs';

const [vite = '5391', cdp = '9729'] = process.argv.slice(2);
let bad = 0;
const ok = (n, c, i = '') => { if (!c) bad++; console.log(`${c ? 'OK  ' : 'FAIL'} ${n}${i ? ` : ${i}` : ''}`); };
const b = await launch({ port: Number(cdp) });
const menu = async (top, item) => {
  await b.ev(`[...document.querySelectorAll('.fo-suite .fo-menubar__row > .fo-menubar__item')].find((x) => new RegExp('^${top}', 'i').test(x.textContent))?.click()`);
  await sleep(250);
  await b.ev(`[...document.querySelectorAll('.fo-menu [role^="menuitem"]')].find((x) => new RegExp('^${item}', 'i').test(x.textContent))?.click()`);
  await sleep(500);
};
const clickTab = (label) => b.ev(`[...document.querySelectorAll('.fo-dialog--suite [role=tab]')].find((t) => t.textContent === ${JSON.stringify(label)})?.click()`);
const clickBtn = (label) => b.ev(`[...document.querySelectorAll('.fo-dialog--suite .fo-sbtn')].find((t) => t.textContent === ${JSON.stringify(label)})?.click()`);
try {
  for (const layout of ['libreoffice', 'openoffice']) {
    await b.goto(`http://127.0.0.1:${vite}/?app=word`, 500);
    await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"')`);
    await b.goto(`http://127.0.0.1:${vite}/?app=word`, 2200);
    await b.ev(`(() => { const e = document.querySelector('.ProseMirror'); e.focus(); document.execCommand('insertText', false, 'Bonjour le monde'); document.execCommand('selectAll'); })()`);
    await sleep(300);
    await menu('Format', 'Caract');
    await b.ev(`(() => { const s = [...document.querySelectorAll('.fo-dialog--suite select')].find((x) => [...x.options].some((o) => o.text === 'Gras')); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'b'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await clickBtn('OK');
    await sleep(400);
    ok(`${layout} Caractere > Gras applique`, await b.ev(`Boolean(document.querySelector('.ProseMirror strong, .ProseMirror [style*="font-weight: 700"], .ProseMirror [style*="font-weight:bold"], .ProseMirror b'))`));
    await b.ev(`document.querySelector('.ProseMirror').focus(); document.execCommand('selectAll')`);
    await menu('Format', 'Paragraphe');
    await clickTab('Alignement');
    await b.ev(`[...document.querySelectorAll('.fo-dialog--suite label')].find((l) => l.textContent === 'Centrer')?.querySelector('input')?.click()`);
    await clickBtn('OK');
    await sleep(400);
    ok(`${layout} Paragraphe > Centrer applique`, await b.ev(`(() => { const p = document.querySelector('.ProseMirror p'); return p && getComputedStyle(p).textAlign === 'center'; })()`));
    await b.ev(`document.querySelector('.ProseMirror').focus()`);
    await menu('Format', 'Page');
    await clickTab('Colonnes');
    await b.ev(`(() => { const i = [...document.querySelectorAll('.fo-dialog--suite input')].find((x) => x.getAttribute('aria-label') === 'Colonnes :'); console.log(!!i); })()`);
    await clickBtn('Annuler');
    await sleep(300);
    ok(`${layout} Annuler ferme la boite`, await b.ev(`!document.querySelector('.fo-dialog')`));
    // Page > Arriere-plan : la couleur choisie colore la page (onglet fonctionnel)
    await b.ev(`document.querySelector('.ProseMirror').focus()`);
    await menu('Format', 'Page');
    await clickTab('Arrière-plan');
    await b.ev(`[...document.querySelectorAll('.fo-dialog--suite label')].find((l) => l.textContent === 'Couleur')?.querySelector('input')?.click()`);
    await clickBtn('OK');
    await sleep(500);
    ok(`${layout} Page > Arriere-plan colore la page`, await b.ev(`[...document.querySelectorAll('*')].some((e) => { const c = getComputedStyle(e).backgroundColor; return c === 'rgb(242, 242, 242)' && e.getBoundingClientRect().height > 400; })`));
  }
} finally { await b.close(); }
process.exitCode = bad ? 1 : 0;
