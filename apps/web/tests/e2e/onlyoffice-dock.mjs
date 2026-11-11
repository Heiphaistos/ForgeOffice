// Disposition OnlyOffice : barres laterales (rail gauche, rail droit + panneau Parametres) et panneau contextuel automatique.
// Usage : node onlyoffice-dock.mjs <port vite> <port cdp>
import { launch, sleep } from './harness.mjs';

const [vite = '5190', cdp = '9702'] = process.argv.slice(2);
const b = await launch({ port: Number(cdp) });
let bad = 0;
const ok = (n, c, i = '') => { if (!c) bad++; console.log(`${c ? 'OK  ' : 'FAIL'} ${n}${i ? ` : ${i}` : ''}`); };
try {
  await b.viewport(1440, 900);
  await b.goto(`http://127.0.0.1:${vite}/`, 600);
  await b.ev(`localStorage.setItem('fo-setting:ui.layout', '"onlyoffice"')`);
  for (const app of ['word', 'excel', 'powerpoint', 'publisher']) {
    await b.goto(`http://127.0.0.1:${vite}/?app=${app}`, 2500);
    ok(`${app} : rail gauche`, await b.ev(`document.querySelectorAll('.fo-oo-rail--left .fo-oo-rail__btn').length >= 1`));
    // Le panneau ouvert est memorise (reglage commun a la suite) : ne cliquer que s'il est ferme.
    await b.ev(`if (!document.querySelector('.fo-oo-panel')) document.querySelector('.fo-oo-rail--right .fo-oo-rail__btn')?.click()`);
    await sleep(500);
    ok(`${app} : panneau Parametres avec commandes`, await b.ev(`document.querySelectorAll('.fo-oo-panel .fo-rb-btn, .fo-oo-panel button').length > 3`));
    const w = await b.ev(`(() => { const d = document.querySelector('.fo-ribbon ~ *'); return d ? Math.round(d.getBoundingClientRect().right) : 0; })()`);
    ok(`${app} : le contenu laisse la place au panneau`, w > 0 && w <= 1440 - 40 - 300 + 2, String(w));
  }
  await b.goto(`http://127.0.0.1:${vite}/?app=word`, 2500);
  await b.click('text=Insertion'); await sleep(400);
  await b.click('text=Tableau'); await sleep(500);
  await b.ev(`document.querySelector('.fo-popover')?.querySelectorAll('div,button')[8]?.click()`);
  await sleep(800);
  const active = await b.ev(`document.querySelector('.fo-oo-rail--right .is-active')?.title ?? ''`);
  ok('word : le panneau du tableau s\'ouvre a la creation', active === 'Création de tableau', active);
  console.log(b.consoleLog.slice(0, 5).join('\n') || 'console propre');
} finally {
  await b.close();
}
process.exit(bad ? 1 : 0);
