import { PDFDocument, PDFName, PDFString } from 'file:///D:/Projet/ForgeOffice/node_modules/@cantoo/pdf-lib/cjs/index.js';
import { killChrome, start, key, sleep, ok, shot, done } from './lib.mjs';
killChrome(); const b = await start('pdf', 'pdf', 'essai.pdf');
const dlg = () => b.ev(`document.querySelector('.fo-dialog')?.textContent ?? ''`);
try {
  await sleep(800);

  await b.click('text=Fichier'); await sleep(700);
  await b.clickText('div, button', 'Propriétés du document').catch(() => b.click('text=Propriétés du document'));
  await sleep(1200);
  const t = await dlg();
  ok('boîte Propriétés avec informations', t.includes('PDF balisé') && t.includes('A4') && t.includes('3'), t.slice(0, 200));
  await shot(b, 'props');
  // langue invalide
  const lang = `document.querySelector('.fo-dialog input[placeholder="fr-FR"]')`;
  await b.ev(`${lang}.focus(); ${lang}.select()`); await b.press('fr_FR'); await sleep(300);
  ok('langue invalide signalée, Appliquer grisé', (await dlg()).includes('invalide') && await b.ev(`[...document.querySelectorAll('.fo-dialog button')].find((x) => x.textContent.trim() === 'Appliquer')?.disabled`));
  await b.ev(`${lang}.select()`); await b.press('fr-FR');
  await b.clickText('label', 'Afficher le titre du document (et non le nom du fichier) dans la barre de titre'); await sleep(200);
  await shot(b, 'props-lang');
  await b.clickText('button', 'Appliquer'); await sleep(1500);
  ok('modification en attente', /modification/.test(await b.ev(`document.querySelector('.fo-sb').textContent`)));
  // Enregistrer : récupérer le fichier
  await key(b, 's', { ctrl: true }); await sleep(2000);
  const dl = await b.downloads();
  ok('fichier enregistré', dl.length === 1, String(dl.length));
  if (dl.length) {
    const doc = await PDFDocument.load(dl[0].bytes);
    const langv = doc.catalog.get(PDFName.of('Lang'));
    ok('/Lang = fr-FR dans le fichier enregistré', langv instanceof PDFString && langv.decodeText() === 'fr-FR', String(langv));
    const vp = doc.catalog.lookup(PDFName.of('ViewerPreferences'));
    ok('DisplayDocTitle vrai', String(vp?.get(PDFName.of('DisplayDocTitle'))) === 'true', String(vp));
    ok('formulaire et annotation conservés', doc.getForm().getFields().length === 2 && doc.getPageCount() === 3);
  }
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
