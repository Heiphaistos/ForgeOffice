// Impress en disposition LibreOffice / OpenOffice : gestes reels (clics CDP) sur la barre laterale, les onglets de vue et le volet des diapos.
// Usage : node apps/web/tests/e2e/lo-impress-flow.mjs <port vite> <port cdp> [layout]
import { launch, sleep } from './harness.mjs';

const [vitePort = '5311', cdp = '9716', layout = 'openoffice'] = process.argv.slice(2);
const ok = (name, cond, info = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ` : ${info}` : ''}`); if (!cond) process.exitCode = 1; };
const b = await launch({ port: Number(cdp) });
try {
  await b.goto(`http://127.0.0.1:${vitePort}/?app=powerpoint`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"${layout}"')`);
  await b.viewport(1920, 1040);
  await b.goto(`http://127.0.0.1:${vitePort}/?app=powerpoint`, 2500);
  const q = (s) => b.ev(`document.querySelectorAll(${JSON.stringify(s)}).length`);
  ok('panneau Diapos et sa miniature', (await q('.pp-side__head')) === 1 && (await q('.pp-thumb')) >= 1);
  const want = layout === 'openoffice' ? 4 : 8; // LibreOffice : + Styles, Galerie, Navigateur, Formes
  ok(`barre laterale a ${want} onglets`, (await q('.fo-ssb__tab:not(.fo-ssb__menu)')) === want);
  const sel = () => b.ev(`document.querySelector('.fo-ssb__layout.is-current')?.title ?? ''`);
  const before = await sel();
  await b.ev(`[...document.querySelectorAll('.fo-ssb__layout')].find((x) => !x.classList.contains('is-current'))?.click()`);
  await sleep(500);
  const after = await sel();
  ok('clic sur une mise en page l\'applique', before !== after, `${before} -> ${after}`);
  if (layout === 'libreoffice') {
    await b.ev(`const s = document.querySelector('.fo-ssb__form select[aria-label="Orientation"]'); s.value = 'p'; s.dispatchEvent(new Event('change', { bubbles: true }))`);
    await sleep(500);
    ok('orientation Portrait appliquee', (await b.ev(`document.querySelector('.fo-ssb__form select[aria-label="Orientation"]').value`)) === 'p');
  }
  await b.ev(`document.querySelector('.fo-ssb__tab[aria-label="Transition de diapo"]').click()`);
  await sleep(400);
  ok('onglet Transition : groupes du ruban dans le panneau', (await q('.fo-ssb__body .fo-rb-group')) >= 1);
  await b.ev(`document.querySelector('.fo-ssb__tab[aria-label="Pages maîtres"], .fo-ssb__tab[aria-label="Diapositives maîtres"]').click()`);
  await sleep(300);
  ok('onglet masques : liste', (await q('.fo-ssb__master')) >= 2);
  if (layout === 'openoffice') {
    await b.ev(`[...document.querySelectorAll('.pp-viewtabs__tab')].find((x) => x.textContent === 'Trieuse de diapositives').click()`);
    await sleep(500);
    ok('onglet Trieuse', (await q('.pp-slides.is-sorter')) === 1);
    await b.ev(`[...document.querySelectorAll('.pp-viewtabs__tab')].find((x) => x.textContent === 'Plan').click()`);
    await sleep(500);
    ok('onglet Plan', (await q('.pp-outline')) === 1);
    await b.ev(`[...document.querySelectorAll('.pp-viewtabs__tab')].find((x) => x.textContent === 'Normal').click()`);
    await sleep(400);
    ok('retour Normal', (await q('.pp-stage')) === 1);
  }
  await b.ev(`document.querySelector('.pp-side__head button').click()`);
  await sleep(300);
  ok('fermeture du volet Diapos', (await q('.pp-side')) === 0);
  console.log(b.consoleLog.slice(0, 8).join('\n') || 'console propre');
} finally {
  await b.close();
}
