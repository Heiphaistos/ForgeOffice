// Fabrique de vrais fichiers de test (ecrits par les paquets de la suite et pdf-lib) pour flows.mjs.
// Usage : node apps/web/tests/e2e/prepare.ts <dossier de sortie>   (Node 24 : types retires a la volee)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { readMarkdown, writeDocx } from '../../../../packages/docx/src/index.ts';
import { readCsv, writeXlsx } from '../../../../packages/xlsx/src/index.ts';
import * as P from '../../../../packages/pptx/src/index.ts';
import { writeFopub } from '../../../../packages/publisher/src/fopub.ts';
import { blank } from '../../../../packages/publisher/src/templates/single.ts';
import { addText } from '../../../../packages/publisher/src/build.ts';

const out = process.argv[2];
if (!out) throw new Error('dossier de sortie manquant');
mkdirSync(out, { recursive: true });
const put = (name: string, data: Uint8Array | string): void => writeFileSync(join(out, name), data);

put('rapport.docx', await writeDocx(readMarkdown('# Rapport trimestriel\n\nBonjour FOE2E ligne un.\n\n| Mois | Total |\n|---|---|\n| Janvier | 10 |\n| Février | 20 |\n').document));
put('chiffres.xlsx', await writeXlsx(readCsv('Produit;Quantité;Prix\nPommes;10;1,5\nPoires;20;2,25\nFigues;5;4\n')));
put('chiffres.csv', 'Produit;Quantité;Prix\nPommes;10;1,5\nPoires;20;2,25\n');

const deck = P.createBlankDeck('standard', { titleSlide: false });
const s1 = P.addSlide(deck, 'layout1');
const t0 = s1.shapes[0];
if (t0 && t0.kind === 'shape') t0.text = { props: {}, paragraphs: P.paragraphsFromText('Diapo FOE2E titre') };
P.addTextBox(P.addSlide(deck, 'layout7'), { x: 72, y: 72, width: 300, height: 40 }, 'Seconde diapo FOE2E');
put('expose.pptx', await P.writePptx(deck));

const pdf = await PDFDocument.create();
pdf.addPage([400, 300]).drawText('Page PDF FOE2E', { x: 40, y: 200, size: 24 });
put('contrat.pdf', await pdf.save());

put('notes.md', '# Note FOE2E\n\n- point un\n- point deux\n');
put('script.py', 'def salut():\n    print("FOE2E")\n');
put('inconnu.xyz', 'format inconnu');

const pub = blank('a4');
const slide = pub.deck.slides[0];
if (slide) addText(slide.shapes, [20, 20, 120, 30], 'Publication FOE2E');
put('affiche.fopub', await writeFopub(pub));
console.log('fixtures ok', out);
