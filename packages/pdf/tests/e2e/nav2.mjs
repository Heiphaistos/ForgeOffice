import { PDFDocument } from 'file:///D:/Projet/ForgeOffice/node_modules/@cantoo/pdf-lib/cjs/index.js';
import { killChrome, start, key, sleep, ok, shot, done } from './lib.mjs';
killChrome(); const b = await start('pdf', 'pdf', 'essai.pdf');
const dlg = () => b.ev(`document.querySelector('.fo-dialog')?.textContent ?? ''`);
try {
  await sleep(800);
  // Recherche : mot entier
  await key(b, 'f', { ctrl: true }); await sleep(400);
  await b.ev(`document.querySelector('.pdf-search input').focus()`);
  await b.press('pag'); await sleep(900);
  const count = () => b.ev(`document.querySelectorAll('.pdf-results li').length`);
  const n0 = await count();
  ok('« pag » sans mot entier : 3 résultats', n0 === 3, String(n0));
  await b.clickText('label', 'Mot entier'); await sleep(500);
  ok('« pag » en mot entier : 0 résultat', (await count()) === 0, String(await count()));
  await b.ev(`(() => { const i = document.querySelector('.pdf-search input'); i.focus(); i.select(); })()`);
  await b.press('page'); await sleep(800);
  ok('« page » en mot entier : 3 résultats', (await count()) === 3, String(await count()));
  await shot(b, 'search-whole');
  // F3 / Maj+F3
  const active = () => b.ev(`[...document.querySelectorAll('.pdf-results li button')].findIndex((x) => x.classList.contains('is-active'))`);
  const a0 = await active();
  await b.ev(`document.querySelector('.pdf-viewer').focus()`);
  await key(b, 'F3'); const a1 = await active();
  await key(b, 'F3'); const a2 = await active();
  await key(b, 'F3', { shift: true }); const a3 = await active();
  ok('F3 passe au résultat suivant, Maj+F3 au précédent', a1 === (a0 + 1) % 3 && a2 === (a0 + 2) % 3 && a3 === a1, `${a0},${a1},${a2},${a3}`);
  // Impression : plage
  await b.ev(`window.__printed = []; const ap = document.body.appendChild.bind(document.body); document.body.appendChild = (el) => { if (el.tagName === 'IFRAME') { fetch(el.src).then((r) => r.arrayBuffer()).then((buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); window.__printed.push(btoa(s)); }); } return ap(el); }`);
  await key(b, 'p', { ctrl: true }); await sleep(500);
  ok('Ctrl+P ouvre la boîte Imprimer', (await dlg()).includes('Pages à imprimer'));
  await shot(b, 'print-dialog');
  await b.ev(`(() => { const s = document.querySelector('.fo-dialog select'); s.value = 'range'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(300);
  await b.ev(`document.querySelector('.fo-dialog input').focus()`);
  await b.press('9'); await sleep(300);
  ok('plage 9 invalide : Imprimer grisé + message', await b.ev(`[...document.querySelectorAll('.fo-dialog button')].find((x) => x.textContent.trim() === 'Imprimer')?.disabled`) && (await dlg()).includes('hors limites'), (await dlg()).slice(0, 120));
  await shot(b, 'print-invalid');
  await b.ev(`(() => { const i = document.querySelector('.fo-dialog input'); i.select(); })()`);
  await b.press('2-3'); await sleep(300);
  await b.clickText('button', 'Imprimer'); await sleep(2500);
  const printed = await b.ev(`window.__printed`);
  ok('un PDF est envoyé à l\'impression', printed.length === 1);
  if (printed.length === 1) {
    const doc = await PDFDocument.load(Buffer.from(printed[0], 'base64'));
    ok('seules les pages 2 et 3 sont imprimées', doc.getPageCount() === 2, `${doc.getPageCount()} pages`);
  }
  await b.ev(`document.querySelectorAll('iframe.pdf-printframe').forEach((f) => f.remove())`);
  // Modifications non enregistrées
  await b.click('text=Commentaire'); await sleep(400);
  await b.clickText('button', 'Note');
  await sleep(300);
  const box = { x: 800, y: 600 };
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await sleep(600);
  ok('document modifié (état en attente)', /modification/.test(await b.ev(`document.querySelector('.fo-sb').textContent`)), await b.ev(`document.querySelector('.fo-sb').textContent.slice(0, 80)`));
  await key(b, 'o', { ctrl: true }); await sleep(500);
  ok('Ctrl+O avec modifications : boîte « non enregistrées »', (await dlg()).includes('non enregistrées'), (await dlg()).slice(0, 100));
  await shot(b, 'discard');
  await b.clickText('button', 'Annuler'); await sleep(400);
  ok('Annuler : boîte fermée, document gardé', (await dlg()) === '' && (await b.ev(`document.querySelector('.fo-sb').textContent`)).includes('Page'));
  const { buildFixture } = await import('file:///D:/Projet/ForgeOffice/apps/web/tests/conformity/fixtures.ts');
  const other = await PDFDocument.create(); other.addPage([300, 300]); other.addPage([300, 300]);
  await b.pick('autre.pdf', await other.save());
  await key(b, 'o', { ctrl: true }); await sleep(500);
  await b.clickText('button', 'Ne pas enregistrer'); await sleep(1800);
  ok('Ne pas enregistrer : autre.pdf ouvert', (await b.ev(`document.querySelector('.fo-sb').textContent`)).includes('Page 1 sur 2'), await b.ev(`document.querySelector('.fo-sb').textContent.slice(0, 40)`));
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
