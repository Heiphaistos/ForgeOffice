// Publication : habillage (objets multiples, contour, colonnes), rognage d'image, correcteur, publipostage xlsx, export pptx.
// Usage : node residus2-pub.mjs <dossier des fixtures> <dossier de sortie> ; banc sur http://127.0.0.1:5371 ; CDP 9631.
import { readFileSync, writeFileSync } from 'node:fs';
import { launch, sleep } from './harness.mjs';
import { waitDownload } from './residus2-lib.mjs';

const [fixtures, out] = process.argv.slice(2);
const BASE = process.env.FO_BASE ?? 'http://127.0.0.1:5371';
const results = [];
const ok = (name, cond, detail = '') => { results.push(Boolean(cond)); console.log(`${cond ? 'OK   ' : 'ECHEC'} ${name}${detail ? ` : ${detail}` : ''}`); };
const fopub = await import('file:///D:/Projet/ForgeOffice/packages/publisher/src/fopub.ts');

const b = await launch({ port: 9631 });
const TITLE = `!/^(Texte|Tableur|Présentation|Publication|Bloc-notes|PDF|Convertisseur|Base de données) - ForgeOffice$/.test(document.title)`;
async function open(name, wide = false) {
  await b.viewport(wide ? 1900 : 1440, wide ? 1250 : 900);
  await b.goto(`${BASE}/?app=hub`);
  await b.ev(`localStorage.removeItem('fo-setting:publisher.spell'); localStorage.removeItem('fo-setting:publisher.lang')`);
  await b.drop('.hub', name, readFileSync(`${fixtures}/${name}`));
  await b.waitFor(`document.documentElement.dataset.app === 'publisher'`, 20000);
  await b.waitFor(TITLE, 20000);
  await sleep(2200);
}
async function clickXY(x, y, button = 'left') {
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x, y, button, clickCount: 1 });
  await sleep(250);
}
async function drag(x0, y0, x1, y1, steps = 8) {
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 });
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
  for (let i = 1; i <= steps; i++) await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps, button: 'left', buttons: 1 });
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
  await sleep(300);
}
const rect = (sel) => b.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);

try {
  // ================================================================ Habillage
  await open('habillage.fopub', true);
  const page = await rect('.fo-canvas__page');
  const s = page.w / 595.2756;
  const info = await b.ev(`(() => {
    const flow = document.querySelector('.fo-canvas__page [data-text-flow]');
    const floats = flow.querySelectorAll('[data-wrap]');
    return { floats: floats.length, cols: getComputedStyle(flow).columnCount, fill: getComputedStyle(flow).columnFill };
  })()`);
  ok('flottants d habillage presents dans la zone (plus de 2 objets)', info.floats >= 6, JSON.stringify(info));
  ok('colonnes remplies l une apres l autre', info.fill === 'auto' && info.cols === '2', JSON.stringify(info));
  // Aucune ligne de texte ne recouvre un objet : cercle, triangle, rectangle, etoile (boites de forme en points de page).
  const shapes = { ellipse: [60, 110, 130, 130], triangle: [190, 300, 110, 120], rect: [330, 150, 110, 90], star: [350, 400, 150, 150] };
  const overlaps = await b.ev(`(() => {
    const pageEl = document.querySelector('.fo-canvas__page');
    const pr = pageEl.getBoundingClientRect(); const k = pr.width / 595.2756;
    const flow = pageEl.querySelector('[data-text-flow]');
    const rects = [];
    const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const r = document.createRange(); r.selectNodeContents(n);
      for (const q of r.getClientRects()) if (q.width > 2 && q.height > 4) rects.push({ x: (q.left - pr.left) / k, y: (q.top - pr.top) / k, w: q.width / k, h: q.height / k });
    }
    const hit = { ellipse: 0, triangle: 0, rect: 0, star: 0 };
    const [ex, ey, ew, eh] = ${JSON.stringify(shapes.ellipse)};
    const [tx, ty, tw, th] = ${JSON.stringify(shapes.triangle)};
    const [rx, ry, rw, rh] = ${JSON.stringify(shapes.rect)};
    for (const q of rects) {
      // 3 points verticaux au milieu de la hauteur de ligne, aux deux extremites et au centre.
      for (const px of [q.x + 1, q.x + q.w / 2, q.x + q.w - 1]) {
        const py = q.y + q.h * 0.5;
        const e = ((px - (ex + ew / 2)) / (ew / 2)) ** 2 + ((py - (ey + eh / 2)) / (eh / 2)) ** 2;
        if (e < 0.97) hit.ellipse++;
        if (py > ty && py < ty + th) { const half = ((py - ty) / th) * (tw / 2); if (Math.abs(px - (tx + tw / 2)) < half - 1) hit.triangle++; }
        if (px > rx + 1 && px < rx + rw - 1 && py > ry + 1 && py < ry + rh - 1) hit.rect++;
      }
    }
    return { lines: rects.length, hit };
  })()`);
  ok('le texte ne recouvre ni le disque, ni le triangle, ni le rectangle', overlaps.hit.ellipse === 0 && overlaps.hit.triangle === 0 && overlaps.hit.rect === 0, JSON.stringify(overlaps));
  await b.send('Page.captureScreenshot', { format: 'png', clip: { x: page.x - 6, y: page.y - 6, width: page.w + 12, height: page.h + 12, scale: 1 } }).then((r) => writeFileSync(`${out}/pub-habillage-page.png`, Buffer.from(r.data, 'base64')));
  await b.shot(`${out}/pub-habillage.png`);

  // ================================================================ Rognage
  await open('rognage.fopub');
  const pg = await rect('.fo-canvas__page');
  const k = pg.w / 595.2756;
  const px = pg.x + (100 + 180) * k;
  const py = pg.y + (160 + 120) * k;
  await clickXY(px, py);
  await b.clickText('[role=tab]', "Format d'image");
  await sleep(500);
  await b.click('text=Rogner');
  ok('outil de rognage actif (cadre et poignees)', await b.waitFor(`document.querySelectorAll('[data-testid=crop-overlay] .pub-crop__h').length === 8`, 5000));
  await sleep(400);
  await b.shot(`${out}/pub-rognage-debut.png`);
  // Poignee « e » vers la gauche (-100 px), poignee « s » vers le haut, puis glisser l'image dans le cadre.
  const handle = async (h) => b.ev(`(() => { const r = document.querySelector('[data-handle=${h}]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const before = await rect('[data-testid=crop-frame]');
  let hd = await handle('e');
  await drag(hd.x, hd.y, hd.x - 110, hd.y);
  hd = await handle('s');
  await drag(hd.x, hd.y, hd.x, hd.y - 60);
  const afterResize = await rect('[data-testid=crop-frame]');
  ok('les poignees redimensionnent le cadre', afterResize.w < before.w - 60 && afterResize.h < before.h - 30, `${Math.round(before.w)}x${Math.round(before.h)} -> ${Math.round(afterResize.w)}x${Math.round(afterResize.h)}`);
  const imgBefore = await b.ev(`(() => { const i = document.querySelector('[data-testid=crop-frame] img'); return { left: i.style.left, top: i.style.top }; })()`);
  await drag(afterResize.x + afterResize.w / 2, afterResize.y + afterResize.h / 2, afterResize.x + afterResize.w / 2 + 25, afterResize.y + afterResize.h / 2 - 15);
  const imgAfter = await b.ev(`(() => { const i = document.querySelector('[data-testid=crop-frame] img'); return { left: i.style.left, top: i.style.top }; })()`);
  ok('glisser dans le cadre deplace l image derriere lui', imgBefore.left !== imgAfter.left || imgBefore.top !== imgAfter.top, `${imgBefore.left},${imgBefore.top} -> ${imgAfter.left},${imgAfter.top}`);
  await b.clickText('.pub-crop__bar button', '1:1');
  const sq = await rect('[data-testid=crop-frame]');
  ok('proportions 1:1', Math.abs(sq.w - sq.h) < 1.5, `${sq.w.toFixed(1)} x ${sq.h.toFixed(1)}`);
  await b.shot(`${out}/pub-rognage.png`);
  await b.click('[data-testid=crop-done]');
  ok('rognage valide : l outil se ferme', await b.waitFor(`!document.querySelector('[data-testid=crop-overlay]')`, 4000));
  await sleep(500);
  await b.shot(`${out}/pub-rognage-fin.png`);
  await b.key('s', { ctrl: true });
  const saved = await waitDownload(b, '.fopub');
  const doc = await fopub.readFopub(new Uint8Array(saved.bytes));
  const pic = doc.deck.slides[0].shapes.find((x) => x.kind === 'picture');
  const c = pic?.crop;
  ok('rognage enregistre (crop en %) et image carree', !!c && pic.xfrm && Math.abs(pic.xfrm.width - pic.xfrm.height) < 0.6, JSON.stringify({ crop: c, w: pic?.xfrm?.width, h: pic?.xfrm?.height }));
  ok('l image reste entierement couverte (rognages positifs)', !!c && c.left >= 0 && c.right >= 0 && c.top >= 0 && c.bottom >= 0 && c.left + c.right < 100);

  // ================================================================ Correcteur orthographique
  await open('fautes.fopub');
  const pg2 = await rect('.fo-canvas__page');
  const k2 = pg2.w / 595.2756;
  await b.ev(`window.__ctx = []; document.addEventListener('contextmenu', (e) => window.__ctx.push(e.defaultPrevented), false);`);
  // Double-clic dans la zone : edition du texte.
  for (const n of [1, 2]) for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: pg2.x + 150 * k2, y: pg2.y + 115 * k2, button: 'left', clickCount: n });
  await sleep(500);
  const attrs = await b.ev(`(() => { const e = document.querySelector('[data-text-flow][contenteditable="true"]'); return e ? { spellcheck: e.getAttribute('spellcheck'), lang: e.getAttribute('lang') } : null; })()`);
  ok('zone en edition : correcteur actif, langue du document', attrs?.spellcheck === 'true' && attrs?.lang === 'fr-FR', JSON.stringify(attrs));
  await clickXY(pg2.x + 150 * k2, pg2.y + 115 * k2, 'right');
  const ctxOn = await b.ev(`window.__ctx.slice(-1)[0]`);
  ok('clic droit dans le texte : le menu du navigateur (corrections) n est pas masque', ctxOn === false, String(ctxOn));
  await b.shot(`${out}/pub-correcteur.png`);
  await b.key('Escape');
  await sleep(300);
  await b.click('text=Révision');
  await sleep(300);
  await b.click('text=Orthographe');
  await sleep(300);
  for (const n of [1, 2]) for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: pg2.x + 150 * k2, y: pg2.y + 115 * k2, button: 'left', clickCount: n });
  await sleep(500);
  const attrsOff = await b.ev(`document.querySelector('[data-text-flow][contenteditable="true"]')?.getAttribute('spellcheck')`);
  ok('bouton Orthographe : correcteur coupe', attrsOff === 'false', String(attrsOff));
  await b.click('text=Orthographe');
  await b.click('text=Français (France)').catch(() => undefined);

  // ================================================================ Publipostage depuis un classeur
  await open('fautes.fopub');
  await b.click('text=Publipostage');
  await sleep(300);
  await b.click('text=Sélectionner des destinataires');
  await b.pick('liste.xlsx', readFileSync(`${fixtures}/liste.xlsx`));
  await sleep(300);
  await b.clickText('button', 'Importer un CSV ou un classeur…');
  ok('choix de la feuille et des champs', await b.waitFor(`document.querySelector('[data-testid=merge-pick] select') && document.querySelectorAll('[data-testid=merge-pick] input[type=checkbox]').length === 3`, 8000));
  const rowsSheet1 = await b.ev(`document.querySelectorAll('.pub-merge-table tbody tr').length`);
  ok('3 enregistrements de la feuille Clients', rowsSheet1 === 3, String(rowsSheet1));
  const solde = await b.ev(`document.querySelector('.pub-merge-table tbody tr td:nth-child(3)')?.textContent`);
  ok('valeur mise en forme comme dans le Tableur (1 234,50 €)', /^1\s?234,50\s?€$/.test((solde ?? '').trim()), solde);
  await b.shot(`${out}/pub-publipostage.png`);
  await b.ev(`(() => { const c = [...document.querySelectorAll('[data-testid=merge-pick] input[type=checkbox]')]; c[2].click(); })()`);
  await sleep(300);
  const cols = await b.ev(`document.querySelectorAll('.pub-merge-table thead th').length`);
  ok('champ decoche retire de la liste', cols === 2, String(cols));
  await b.clickText('button', 'Utiliser');
  await sleep(500);
  const used = await b.ev(`document.querySelector('.pub-merge-table')?.innerText`);
  ok('liste retenue : Nom et Ville, sans Solde', /Dupont/.test(used ?? '') && /Nantes/.test(used ?? '') && !/Solde/.test(used ?? ''), (used ?? '').replace(/\s+/g, ' ').slice(0, 80));

  // ================================================================ Export pptx
  await open('habillage.fopub');
  await b.click('text=Fichier');
  await sleep(400);
  await b.clickText('.fo-bs__nav-item, [role=menuitem], .fo-menu button', 'Exporter');
  await sleep(400);
  await b.clickText('button, [role=button]', 'Présentation PowerPoint');
  ok('dialogue des elements non conserves', await b.waitFor(`document.querySelector('[data-testid=pptx-loss]')`, 5000));
  const loss = await b.ev(`document.querySelector('[data-testid=pptx-loss]').innerText`);
  ok('habillage de 4 objets signale', /Habillage du texte : 4 objets/.test(loss ?? ''), (loss ?? '').replace(/\s+/g, ' ').slice(0, 120));
  await b.shot(`${out}/pub-export-pptx.png`);
  await b.clickText('button', 'Exporter quand même');
  const pptx = await waitDownload(b, '.pptx');
  writeFileSync(`${out}/habillage-export.pptx`, pptx.bytes);
  const JSZip = (await import('file:///D:/Projet/ForgeOffice/node_modules/jszip/lib/index.js')).default;
  const zip = await JSZip.loadAsync(pptx.bytes);
  const presentation = await zip.file('ppt/presentation.xml').async('string');
  ok('reperes exportes en guides PowerPoint', /sldGuideLst/.test(presentation) && /<p15:guide /.test(presentation), `${(presentation.match(/<p15:guide /g) ?? []).length} guides`);
  console.log('console :', JSON.stringify(b.consoleLog.filter((l) => !/requestFullscreen/.test(l)).slice(0, 6)));
} finally {
  await b.close();
}
console.log(`${results.filter(Boolean).length}/${results.length} controles OK`);
process.exit(results.every(Boolean) ? 0 : 1);
