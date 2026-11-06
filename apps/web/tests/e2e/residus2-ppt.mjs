// Presentation : ecran du presentateur (2 fenetres), repetition du minutage, suppression de l'arriere-plan, equation, SmartArt, PDF vectoriel.
// Usage : node residus2-ppt.mjs <dossier des fixtures> <dossier de sortie> ; banc sur http://127.0.0.1:5371 ; CDP 9631.
import { readFileSync, writeFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
import { attachPage, waitDownload } from './residus2-lib.mjs';

const [fixtures, out] = process.argv.slice(2);
const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5371';
const PORT = 9631;
const results = [];
const ok = (name, cond, detail = '') => { results.push(Boolean(cond)); console.log(`${cond ? 'OK   ' : 'ECHEC'} ${name}${detail ? ` : ${detail}` : ''}`); };
const pptx = await import('file:///D:/Projet/ForgeOffice/packages/pptx/src/index.ts');

const b = await launch({ port: PORT });
let B = null;
try {
  await b.viewport(1440, 900);
  await b.goto(`${BASE}/?app=hub`);
  await b.drop('.hub', 'riche.pptx', readFileSync(`${fixtures}/riche.pptx`));
  await b.waitFor(`document.documentElement.dataset.app === 'powerpoint'`, 20000);
  await b.waitFor(`!/^(Texte|Tableur|Présentation|Publication|Bloc-notes|PDF|Convertisseur|Base de données) - ForgeOffice$/.test(document.title)`, 20000);
  await sleep(1800);

  // ---------------------------------------------------------------- Ecran du presentateur (2 fenetres)
  await b.click('text=Diaporama');
  await sleep(400);
  await b.shot(`${out}/ppt-ruban-diaporama.png`);
  await b.click('text=Écran du présentateur');
  B = await attachPage(PORT, (u) => u.includes('presenter=1'));
  ok('seconde fenetre ouverte', true, B.url);
  const synced = await B.waitFor(`document.querySelector('[data-testid=presenter-timer]')`, 15000);
  ok('le presentateur recoit la presentation et l etat', synced);
  await sleep(900);
  const notes = await B.ev(`document.querySelector('[data-testid=presenter-notes]')?.innerText`);
  ok('notes affichees dans la fenetre du presentateur', /Penser à citer/.test(notes ?? ''), notes);
  ok('compteur 1 sur 2', /1 sur 2/.test(await B.ev(`document.querySelector('[data-testid=presenter-count]')?.innerText`)));
  const t1 = await B.ev(`document.querySelector('[data-testid=presenter-timer]').innerText`);
  await sleep(1300);
  const t2 = await B.ev(`document.querySelector('[data-testid=presenter-timer]').innerText`);
  ok('le minuteur avance', t1 !== t2, `${t1} -> ${t2}`);
  await B.shot(`${out}/ppt-presentateur.png`);
  // Diapositive suivante depuis le presentateur : le diaporama (fenetre principale) suit.
  await B.clickSel('.pp-presenter .pp-show__tools button[title="Suivant"]');
  await B.waitFor(`/2 sur 2/.test(document.querySelector('[data-testid=presenter-count]')?.innerText ?? '')`, 5000);
  ok('compteur 2 sur 2 apres Suivant', /2 sur 2/.test(await B.ev(`document.querySelector('[data-testid=presenter-count]')?.innerText`)));
  const main = await b.waitFor(`/Seconde diapositive/.test(document.querySelector('.pp-show')?.innerText ?? '')`, 5000);
  ok('le diaporama de la fenetre principale a avance', main);
  // Pause depuis le presentateur : le minuteur s'arrete.
  await B.clickSel('.pp-presenter__top button[title="Suspendre le minuteur"]');
  await sleep(900);
  const p1 = await B.ev(`document.querySelector('[data-testid=presenter-timer]').innerText`);
  await sleep(1300);
  const p2 = await B.ev(`document.querySelector('[data-testid=presenter-timer]').innerText`);
  ok('pause du minuteur', p1 === p2, `${p1} / ${p2}`);
  // Fin du diaporama depuis le presentateur.
  await B.clickSel('.pp-presenter__end');
  ok('le diaporama se termine dans la fenetre principale', await b.waitFor(`!document.querySelector('.pp-show')`, 5000));
  ok('le presentateur revient en attente', await B.waitFor(`/terminé/.test(document.querySelector('[data-testid=presenter-window]')?.innerText ?? '')`, 5000));
  B.close();
  B = null;
  await b.send('Page.bringToFront');

  // ---------------------------------------------------------------- Repetition du minutage
  await b.click('text=Diaporama');
  await b.click('text=Répéter le minutage');
  await b.waitFor(`document.querySelector('.pp-rehearse')`, 5000);
  await sleep(1400);
  await b.shot(`${out}/ppt-repetition.png`);
  const slideTime = await b.ev(`document.querySelector('[data-testid=rehearse-slide]')?.innerText`);
  ok('barre de repetition : temps de la diapositive', /^00:0[1-3]$/.test(slideTime ?? ''), slideTime);
  await b.key('ArrowRight');
  await sleep(2100);
  await b.key('Escape');
  ok('boite « Enregistrer le minutage ? »', await b.waitFor(`/Enregistrer le minutage/.test(document.body.innerText)`, 5000));
  await b.shot(`${out}/ppt-minutage-dialogue.png`);
  await b.clickText('button', 'Enregistrer');
  await sleep(500);
  await b.key('s', { ctrl: true });
  const saved = await waitDownload(b, '.pptx');
  const deck = await pptx.readPptx(new Uint8Array(saved.bytes));
  const after = deck.slides.map((s) => s.transition?.advanceAfter);
  ok('minutage enregistre dans le .pptx (avance automatique des 2 diapositives)', after.length === 2 && after.every((v) => typeof v === 'number' && v >= 1000), JSON.stringify(after));
  ok('duree de la 1re diapositive proche de 1,4 s', (after[0] ?? 0) >= 1000 && (after[0] ?? 0) <= 4000, String(after[0]));
  writeFileSync(`${out}/minutage.pptx`, saved.bytes);

  // ---------------------------------------------------------------- Suppression de l'arriere-plan
  const thumbs = await b.ev(`document.querySelectorAll('.pp-thumb').length`);
  ok('2 vignettes', thumbs === 2, String(thumbs));
  await b.ev(`document.querySelectorAll('.pp-thumb')[1].click()`);
  await sleep(600);
  // Selection de l'image par un vrai clic au centre de la zone de l'image (360 x 240 pt a 80,160).
  const box = await b.ev(`(() => { const p = document.querySelector('.fo-canvas__page'); const r = p.getBoundingClientRect(); const s = r.width / 960; return { x: r.left + (80 + 180) * s, y: r.top + (160 + 120) * s }; })()`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await sleep(500);
  ok('onglet « Format de l image » disponible', await b.waitFor(`[...document.querySelectorAll('[role=tab]')].some((t) => /Format de l.image/.test(t.textContent))`, 4000));
  await b.clickText('[role=tab]', 'Format de l’image');
  await sleep(500);
  await b.click('text=Supprimer l’arrière-plan');
  ok('dialogue de suppression ouvert', await b.waitFor(`document.querySelector('[data-testid=removebg-preview] canvas')`, 5000));
  await sleep(700);
  const share = await b.ev(`document.querySelector('[data-testid=removebg-share]')?.innerText`);
  const percent = Number((share ?? '').match(/^(\d+)/)?.[1] ?? 0);
  ok('la part supprimee est annoncee (fond autour du disque)', percent > 40, share);
  const swatch = await b.ev(`getComputedStyle(document.querySelector('[data-testid=removebg-color]')).backgroundColor`);
  ok('couleur de fond detectee (blanc casse)', /rgb\(25[0-5], 25[0-5], 25[0-5]\)/.test(swatch ?? ''), swatch);
  await b.shot(`${out}/ppt-detourage.png`);
  await b.clickText('button', 'Supprimer');
  await sleep(900);
  await b.shot(`${out}/ppt-detourage-resultat.png`);
  await b.key('s', { ctrl: true });
  const saved2 = await waitDownload(b, '.pptx');
  const d2 = await pptx.readPptx(new Uint8Array(saved2.bytes));
  const pic = d2.slides[1]?.shapes.find((s) => s.kind === 'picture');
  const media = pic && d2.media[pic.mediaId];
  ok('image remplacee par un PNG', media?.contentType === 'image/png');
  const colorType = media ? media.bytes[25] : -1;
  ok('PNG avec canal alpha (type 6)', colorType === 6, String(colorType));

  // Page nettoyee pour les captures suivantes : tout selectionner puis supprimer.
  await b.click('text=Accueil');
  await b.ev(`document.querySelector('.fo-canvas').focus()`);
  await b.key('a', { ctrl: true });
  await b.key('Delete');
  await sleep(400);

  // ---------------------------------------------------------------- Equation
  await b.click('text=Insertion');
  await b.click('text=Équation');
  ok('dialogue d equation', await b.waitFor(`document.querySelector('[data-testid=equation-preview] img')`, 5000));
  await sleep(500);
  await b.shot(`${out}/ppt-equation-dialogue.png`);
  await b.clickText('button', 'Insérer');
  await sleep(900);
  const eqPic = await b.ev(`[...document.querySelectorAll('.fo-canvas__page [data-shape-id]')].filter((e) => e.querySelector('image')).length`);
  ok('equation inseree comme image', eqPic >= 1, String(eqPic));
  {
    const pr = await b.ev(`(() => { const p = document.querySelector('.fo-canvas__page').getBoundingClientRect(); return { x: p.left, y: p.top, w: p.width }; })()`);
    const kk = pr.w / 960;
    const cx = pr.x + 480 * kk; const cy = pr.y + 270 * kk;
    await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
    await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 10; i++) await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy - 20 * i * kk, button: 'left', buttons: 1 });
    await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy - 200 * kk, button: 'left', clickCount: 1 });
    await sleep(400);
  }

  // ---------------------------------------------------------------- SmartArt
  await b.click('text=Insertion');
  await b.click('text=SmartArt');
  ok('dialogue SmartArt', await b.waitFor(`document.querySelector('[data-testid=smartart-items]')`, 5000));
  await b.shot(`${out}/ppt-smartart-dialogue.png`);
  await b.clickText('button', 'Insérer');
  await sleep(900);
  await b.shot(`${out}/ppt-equation-smartart.png`);
  await b.key('s', { ctrl: true });
  const saved3 = await waitDownload(b, '.pptx');
  const d3 = await pptx.readPptx(new Uint8Array(saved3.bytes));
  const group = d3.slides[1]?.shapes.find((s) => s.kind === 'group' && s.name === 'SmartArt');
  ok('SmartArt groupe nomme enregistre', !!group, group ? `${group.children.length} formes` : '');
  const eq = d3.slides[1]?.shapes.find((s) => s.kind === 'picture' && s.name.startsWith('Équation'));
  ok('equation : saisie conservee dans le texte de remplacement, SVG + PNG', !!eq && /frac/.test(eq.description ?? '') && !!eq.svgMediaId, eq?.description);
  writeFileSync(`${out}/objets.pptx`, saved3.bytes);

  // ---------------------------------------------------------------- PDF vectoriel
  await b.click('text=Fichier');
  await sleep(400);
  await b.clickText('.fo-bs__nav-item, [role=menuitem], .fo-menu button', 'Exporter');
  await sleep(400);
  await b.clickText('button, [role=button]', 'Créer un document PDF');
  const pdf = await waitDownload(b, '.pdf', 40000);
  writeFileSync(`${out}/final.pdf`, pdf.bytes);
  ok('PDF produit', pdf.bytes.length > 5000, `${pdf.bytes.length} octets`);
  console.log('console :', JSON.stringify(b.consoleLog.slice(0, 6)));
} finally {
  B?.close();
  await b.close();
}
console.log(`${results.filter(Boolean).length}/${results.length} controles OK`);
process.exit(results.every(Boolean) ? 0 : 1);
