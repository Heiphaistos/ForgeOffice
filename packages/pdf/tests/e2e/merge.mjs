import { PDFDocument } from 'file:///D:/Projet/ForgeOffice/node_modules/@cantoo/pdf-lib/cjs/index.js';
import { killChrome, start, key, sleep, ok, shot, done } from './lib.mjs';
killChrome();
const mk = async (size, n) => { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) d.addPage([size, size]); return Buffer.from(await d.save()).toString('base64'); };
const A = await mk(200, 2), B = await mk(300, 4);
const b = await start('pdf', 'pdf', 'essai.pdf');
try {
  await sleep(800);
  await b.click('text=Organiser'); await sleep(400);
  await b.clickText('button', 'Fusionner'); await sleep(800);
  ok('boîte ouverte, document ouvert listé', (await b.ev(`document.querySelector('.fo-dialog')?.textContent ?? ''`)).includes('(document ouvert)'));
  await b.ev(`(() => {
    const u = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([u('${A}')], 'a.pdf', { type: 'application/pdf' })); dt.items.add(new File([u('${B}')], 'b.pdf', { type: 'application/pdf' }));
    const i = document.querySelector('.fo-dialog input[type=file]'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(1200);
  const names = () => b.ev(`[...document.querySelectorAll('.pdf-merge-list__name')].map((x) => x.textContent.replace(' (document ouvert)', ''))`);
  ok('3 fichiers listés', JSON.stringify(await names()) === '["essai.pdf","a.pdf","b.pdf"]', JSON.stringify(await names()));
  await b.click('button[aria-label="Monter b.pdf"]'); await sleep(300);
  ok('b.pdf monté avant a.pdf', JSON.stringify(await names()) === '["essai.pdf","b.pdf","a.pdf"]', JSON.stringify(await names()));
  ok('total annoncé : 9 pages', (await b.ev(`document.querySelector('.fo-dialog').textContent`)).includes('9 page(s)'));
  await shot(b, 'merge-dialog');
  await b.clickText('button', 'Combiner 3 fichiers'); await sleep(2500);
  ok('document fusionné : 9 pages', /Page \d sur 9/.test(await b.ev(`document.querySelector('.fo-sb').textContent`)), await b.ev(`document.querySelector('.fo-sb').textContent.slice(0, 30)`));
  await key(b, 's', { ctrl: true }); await sleep(2000);
  const dl = await b.downloads();
  if (dl.length) {
    const doc = await PDFDocument.load(dl[0].bytes);
    const sizes = doc.getPages().map((p) => Math.round(p.getWidth()));
    ok('ordre des pages : essai x3, b x4, a x2', JSON.stringify(sizes) === JSON.stringify([595, 595, 595, 300, 300, 300, 300, 200, 200]), JSON.stringify(sizes));
  } else ok('fichier enregistré', false);
  await shot(b, 'merge-done');
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
