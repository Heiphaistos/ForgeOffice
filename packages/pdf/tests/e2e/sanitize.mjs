import { PDFDict, PDFDocument, PDFName, PDFString } from 'file:///D:/Projet/ForgeOffice/node_modules/@cantoo/pdf-lib/cjs/index.js';
import { killChrome, key, sleep, ok, shot, done, BASE } from './lib.mjs';
import { launch } from 'file:///D:/Projet/ForgeOffice/apps/web/tests/e2e/harness.mjs';
const { inspectHidden } = await import('file:///D:/Projet/ForgeOffice/packages/pdf/src/sanitize.ts');
killChrome();
const N = PDFName.of;
const pdf = await PDFDocument.create({ updateMetadata: false });
pdf.setTitle('Secret'); pdf.setAuthor('Jean Dupont');
const page = pdf.addPage([300, 300]);
await pdf.attach(new TextEncoder().encode('piece jointe'), 'notes.txt', { mimeType: 'text/plain' });
const ctx = pdf.context;
const js = ctx.obj({ S: 'JavaScript', JS: PDFString.of('app.alert(1)') });
const names = ctx.obj({}); pdf.catalog.set(N('Names'), names);
names.set(N('JavaScript'), ctx.obj({ Names: [PDFString.of('boot'), ctx.register(js)] }));
pdf.catalog.set(N('OpenAction'), ctx.register(js));
const annot = (o) => ctx.register(ctx.obj({ Type: 'Annot', Rect: [10, 10, 50, 30], ...o }));
page.node.set(N('Annots'), ctx.obj([annot({ Subtype: 'Text', Contents: PDFString.of('note') }), annot({ Subtype: 'Link', A: { S: 'URI', URI: PDFString.of('https://exemple.fr') } })]));
const bytes = await pdf.save({ useObjectStreams: false });
const b = await launch({ port: 9730 });
await b.viewport(1500, 950);
await b.goto(`${BASE}/?app=hub`);
await b.drop('.hub', 'secret.pdf', Buffer.from(bytes));
await b.waitFor(`document.documentElement.dataset.app === 'pdf'`, 20000);
await sleep(2500);
try {
  await b.click('text=Protéger'); await sleep(400);
  await b.clickText('button', 'Supprimer les informations masquées'); await sleep(1500);
  const t = await b.ev(`document.querySelector('.fo-dialog')?.textContent ?? ''`);
  ok('boîte avec les catégories trouvées', t.includes('Scripts et actions JavaScript (2)') && t.includes('Fichiers joints (1)') && t.includes('Commentaires et annotations (1)') && t.includes('Signets (aucun)'), t.slice(0, 400));
  await shot(b, 'sanitize-dialog');
  await b.clickText('button', 'Supprimer'); await sleep(2500);
  await key(b, 's', { ctrl: true }); await sleep(2500);
  const dl = await b.downloads();
  ok('fichier enregistré', dl.length === 1);
  if (dl.length) {
    const r = await inspectHidden(dl[0].bytes);
    ok('plus rien de masqué dans le fichier enregistré', r.scripts === 0 && r.attachments === 0 && r.comments === 0 && r.metadata === 0, JSON.stringify(r));
    const txt = Buffer.from(dl[0].bytes).toString('latin1');
    ok('« Jean Dupont » et le script absents des octets', !txt.includes('Jean Dupont') && !txt.includes('app.alert'));
    const doc = await PDFDocument.load(dl[0].bytes);
    ok('page et lien conservés', doc.getPageCount() === 1 && doc.getPage(0).node.lookup(N('Annots')).size() === 1);
  }
} catch (e) { console.log('ERREUR', e); }
await done(b); process.exit(0);
