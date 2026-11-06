// Fixtures Publication de residus2-pub.mjs : habillage (3 objets, contour, 2 colonnes), rognage, liste Excel, texte avec fautes.
// Usage : node apps/web/tests/e2e/residus2-prepare-pub.ts <dossier de sortie>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addSheet, createBlankWorkbook, setValue, writeXlsx, styleIdFor } from '../../../../packages/xlsx/src/index.ts';
import * as P from '../../../../packages/pptx/src/index.ts';
import { writeFopub } from '../../../../packages/publisher/src/fopub.ts';
import { blank } from '../../../../packages/publisher/src/templates/single.ts';
import { addShape, addText, hex, solid, para } from '../../../../packages/publisher/src/build.ts';
import { png } from './residus2-png.ts';

const out = process.argv[2];
if (!out) throw new Error('dossier de sortie manquant');
mkdirSync(out, { recursive: true });

const LOREM = 'Le texte de cette zone est réparti sur deux colonnes et contourne chaque objet placé devant lui, à gauche comme à droite, en suivant le contour réel des formes. ';
const long = (n: number): string => LOREM.repeat(n);

// ---- Habillage : 2 colonnes, ellipse a gauche (col 1), triangle a droite (col 1), rectangle (col 2), disque ajuste a cheval
const doc = blank('a4');
const slide = doc.deck.slides[0] as P.Slide;
const s = slide.shapes;
const W = P.SLIDE_SIZES.a4.width;
const frame = addText(s, [40, 60, W - 80, 560], [para(long(15), { size: 11, lang: 'fr-FR' }, { align: 'just' })], {}, { columns: 2, gap: 18, name: 'Texte habillé' });
frame.text = { ...(frame.text as P.TextBody), paragraphs: [{ props: { align: 'just' }, runs: [{ type: 'text', text: long(15), props: { size: 11, lang: 'fr-FR' } }] }] };
const ellipse = addShape(s, [60, 110, 130, 130], solid(hex('1F6E8C')), { preset: 'ellipse', name: 'Disque' });
const triangle = addShape(s, [190, 300, 110, 120], solid(hex('E07A1F')), { preset: 'triangle', name: 'Triangle' });
const rect = addShape(s, [330, 150, 110, 90], solid(hex('2E7D32')), { name: 'Rectangle' });
const star = addShape(s, [350, 400, 150, 150], solid(hex('C8102E')), { preset: 'star5', name: 'Étoile' });
for (const sh of [ellipse, triangle, rect, star]) doc.pub.wraps[`${slide.id}:${sh.id}`] = 'tight';
doc.pub.wraps[`${slide.id}:${rect.id}`] = 'square';
writeFileSync(join(out, 'habillage.fopub'), await writeFopub(doc));

// ---- Rognage : une image 480 x 320 px dans un cadre
const crop = blank('a4');
const cs = crop.deck.slides[0] as P.Slide;
const pic = P.addPicture(crop.deck, cs, png(480, 320, [240, 244, 250], [200, 60, 60]), 'png', { x: 100, y: 160, width: 360, height: 240 }, 'Disque rouge');
void pic;
addText(cs.shapes, [100, 80, 360, 40], 'Rognage de l’image', { size: 22, bold: true });
writeFileSync(join(out, 'rognage.fopub'), await writeFopub(crop));

// ---- Texte avec fautes (orthographe)
const spell = blank('a4');
const ss = spell.deck.slides[0] as P.Slide;
addText(ss.shapes, [60, 100, 400, 120], 'Ceci est un textte avec des fautess d’ortografe.', { size: 16, lang: 'fr-FR' }, { name: 'Zone fautes' });
writeFileSync(join(out, 'fautes.fopub'), await writeFopub(spell));

// ---- Liste Excel : 2 feuilles
const wb = createBlankWorkbook();
const sheet = wb.sheets[0]!;
sheet.name = 'Clients';
const money = styleIdFor(wb, { numberFormat: '#,##0.00 "€"' });
['Nom', 'Ville', 'Solde'].forEach((h, c) => setValue(sheet, 0, c, h));
[['Dupont', 'Lyon', 1234.5], ['Martin', 'Paris', 87], ['Bernard', 'Nantes', 15000]].forEach((r, i) => r.forEach((v, c) => { const cell = setValue(sheet, i + 1, c, v as string | number); if (c === 2) cell.styleId = money; }));
const second = addSheet(wb, 'Fournisseurs');
['Société', 'Pays'].forEach((h, c) => setValue(second, 0, c, h));
setValue(second, 1, 0, 'Acme');
setValue(second, 1, 1, 'France');
writeFileSync(join(out, 'liste.xlsx'), await writeXlsx(wb));
console.log('fixtures publication ok', out);
