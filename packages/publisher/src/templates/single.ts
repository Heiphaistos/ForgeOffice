// Compositions d'une page : prospectus, affiche, cartes de visite, invitation, menu, certificat, etiquettes, banniere.
import { SLIDE_SIZES, type SlideSize } from '@forgeoffice/pptx';
import { addLine, addShape, addText, hex, mm, para, sc, solid, NO_FILL } from '../build.ts';
import type { PubDocument } from '../fopub.ts';
import { cardGrid } from '../imposition.ts';
import { ACCENT, body, DARK, heading, lines, newDoc, PALE, paragraphs, photo, SAMPLE, shapesOf, title } from './kit.ts';

const A4: SlideSize = SLIDE_SIZES.a4;
const A3: SlideSize = SLIDE_SIZES.a3;
const A4_LANDSCAPE: SlideSize = { width: A4.height, height: A4.width };

export function flyer(): PubDocument {
  const doc = newDoc(A4, 1, 'flyer', { columns: { count: 2, gap: 18 } });
  const s = shapesOf(doc.deck, 0);
  const { width: W, height: H } = A4;
  addShape(s, [0, 0, W, 190], DARK, { name: 'Bandeau' });
  addShape(s, [0, 190, W, 8], ACCENT(2), { name: 'Liseré' });
  heading(s, [36, 40, W - 72, 70], 'GRANDE OUVERTURE', 40, { color: sc('bg1') });
  lines(s, [36, 110, W - 72, 60], ['Samedi 14 juin · 10 h – 19 h', 'Place du Marché, Lyon'], body(15, { color: sc('bg1') }));
  photo(s, [36, 222, W - 72, 250]);
  heading(s, [36, 490, W - 72, 34], 'Une journée de découvertes', 22, { color: sc('accent1') });
  addText(s, [36, 530, (W - 90) / 2, 200], paragraphs([SAMPLE.body, SAMPLE.short], body(11)), {}, { name: 'Texte principal' });
  addText(s, [36 + (W - 90) / 2 + 18, 530, (W - 90) / 2, 200], [
    para('Au programme', title(13, { color: sc('accent1') }), { spaceAfter: { type: 'pts', value: 4 } }),
    ...['Démonstrations en continu', 'Dégustations offertes', 'Ateliers pour les enfants', 'Tombola à 18 h'].map((t) => para(t, body(11), { bullet: { type: 'char', char: '•' }, marginLeft: 14, indent: -14, spaceAfter: { type: 'pts', value: 3 } })),
  ], {}, { name: 'Programme' });
  addShape(s, [0, H - 90, W, 90], ACCENT(1), { name: 'Pied' });
  lines(s, [36, H - 78, W - 72, 66], ['Entrée libre', 'contact@exemple.fr · 04 00 00 00 00 · www.exemple.fr'], body(13, { color: sc('bg1'), bold: true }), 'ctr', { anchor: 'ctr' });
  return doc;
}

export function poster(): PubDocument {
  const doc = newDoc(A3, 1, 'poster', { margins: { top: 54, bottom: 54, inside: 54, outside: 54 } });
  const s = shapesOf(doc.deck, 0);
  const { width: W, height: H } = A3;
  addShape(s, [0, 0, W, H], PALE, { name: 'Fond' });
  addShape(s, [W - 420, -140, 560, 560], ACCENT(2), { preset: 'ellipse', name: 'Disque' });
  addShape(s, [-120, H - 360, 420, 420], ACCENT(1), { preset: 'ellipse', name: 'Disque 2' });
  addText(s, [54, 170, W - 108, 230], [para('FESTIVAL', title(88)), para('DES ARTS', title(88, { color: sc('accent1') }))], {}, { name: 'Titre' });
  lines(s, [54, 420, W - 108, 80], ['12 – 15 septembre 2026', 'Parc de la Tête d’Or'], body(26, { bold: true, color: sc('tx2') }));
  photo(s, [54, 530, W - 108, 420]);
  addText(s, [54, 980, W - 340, 120], paragraphs([SAMPLE.body], body(15)), {}, { name: 'Texte' });
  addShape(s, [W - 260, 980, 206, 120], DARK, { preset: 'roundRect', name: 'Pastille' });
  lines(s, [W - 260, 980, 206, 120], ['Entrée', 'gratuite'], title(26, { color: sc('bg1') }), 'ctr', { anchor: 'ctr' });
  return doc;
}

/** Carte de visite (recto) dessinee sur une page de 85 x 55 mm. */
function drawCard(s: ReturnType<typeof shapesOf>, W: number, H: number): void {
  addShape(s, [0, 0, 14, H], ACCENT(1), { name: 'Bande' });
  addShape(s, [W - 46, 12, 30, 30], ACCENT(2), { preset: 'ellipse', name: 'Logo' });
  addText(s, [24, 12, W - 80, 44], [para('Camille Martin', title(14)), para('Directrice artistique', body(8, { color: sc('accent1') }))], {}, { name: 'Nom' });
  addLine(s, 24, 62, W - 16, 62, sc('accent1'), 0.75);
  addText(s, [24, 68, W - 40, 82], ['Atelier Lumière', '12 rue des Arts, 69001 Lyon', '06 00 00 00 00', 'camille@exemple.fr'].map((t, i) => para(t, body(i === 0 ? 8.5 : 7.5, i === 0 ? { bold: true } : {}))), {}, { name: 'Coordonnées' });
}

export function businessCard(): PubDocument {
  const size = SLIDE_SIZES.businessCard;
  const doc = newDoc(size, 1, 'businessCard', { margins: { top: 9, bottom: 9, inside: 9, outside: 9 }, bleed: 9 });
  drawCard(shapesOf(doc.deck, 0), size.width, size.height);
  return doc;
}

/** Cartes de visite imprimees par 10 sur une feuille A4 (traits de coupe). */
export function businessCards10(): PubDocument {
  const doc = businessCard();
  const grid = cardGrid(SLIDE_SIZES.businessCard, A4, 0, 0);
  doc.pub = { ...doc.pub, kind: 'businessCards10', imposition: { kind: 'cards', sheet: { width: A4.width, height: A4.height }, cols: grid.cols, rows: grid.rows, gapX: 0, gapY: 0 } };
  return doc;
}

export function invitation(): PubDocument {
  const size = SLIDE_SIZES.a5;
  const doc = newDoc(size, 1, 'invitation', { margins: { top: 28, bottom: 28, inside: 28, outside: 28 } });
  const s = shapesOf(doc.deck, 0);
  const { width: W, height: H } = size;
  addShape(s, [14, 14, W - 28, H - 28], NO_FILL, { line: { fill: solid(sc('accent1')), width: 1.5 }, name: 'Cadre' });
  addShape(s, [20, 20, W - 40, H - 40], NO_FILL, { line: { fill: solid(sc('accent1')), width: 0.5 }, name: 'Cadre intérieur' });
  heading(s, [40, 64, W - 80, 30], 'Vous êtes invités', 14, { italic: true, bold: false, color: sc('accent1') }, 'ctr');
  heading(s, [40, 100, W - 80, 64], 'Léa & Thomas', 40, {}, 'ctr');
  addLine(s, W / 2 - 50, 176, W / 2 + 50, 176, sc('accent2'), 1);
  lines(s, [40, 192, W - 80, 90], ['ont le plaisir de vous convier', 'à la célébration de leur mariage', 'le samedi 20 juin 2026 à 16 h', 'au Domaine des Tilleuls'], body(12), 'ctr');
  photo(s, [W / 2 - 100, 300, 200, 150]);
  lines(s, [40, H - 104, W - 80, 50], ['Réponse souhaitée avant le 1er mai', 'rsvp@exemple.fr'], body(9, { color: sc('tx2') }), 'ctr');
  return doc;
}

export function menu(): PubDocument {
  const doc = newDoc(A4, 1, 'menu', { margins: { top: 48, bottom: 48, inside: 48, outside: 48 } });
  const s = shapesOf(doc.deck, 0);
  const { width: W, height: H } = A4;
  addShape(s, [0, 0, W, H], solid(hex('FBF8F3')), { name: 'Fond' });
  addShape(s, [24, 24, W - 48, H - 48], NO_FILL, { line: { fill: solid(sc('accent2')), width: 1 }, name: 'Cadre' });
  heading(s, [48, 50, W - 96, 60], 'Le Petit Bistrot', 36, { color: sc('accent2') }, 'ctr');
  lines(s, [48, 108, W - 96, 22], ['Cuisine de saison · fait maison'], body(11, { italic: true, color: sc('tx2') }), 'ctr');
  const sections: Array<[string, Array<[string, string, string]>]> = [
    ['Entrées', [['Velouté de potimarron', 'crème fouettée, noisettes torréfiées', '9 €'], ['Œuf parfait', 'crème de champignons, croûtons', '11 €'], ['Terrine du chef', 'légumes au vinaigre, pain de campagne', '10 €']]],
    ['Plats', [['Suprême de volaille', 'jus corsé, purée maison', '19 €'], ['Filet de lieu jaune', 'beurre blanc, légumes glacés', '22 €'], ['Risotto aux cèpes', 'parmesan affiné', '18 €']]],
    ['Desserts', [['Tarte fine aux pommes', 'glace vanille', '8 €'], ['Mousse au chocolat', 'éclats de praliné', '8 €'], ['Assiette de fromages', 'confiture de figues', '9 €']]],
  ];
  let y = 150;
  for (const [name, items] of sections) {
    heading(s, [48, y, W - 96, 30], name, 18, { color: sc('accent2') }, 'ctr');
    addLine(s, W / 2 - 40, y + 32, W / 2 + 40, y + 32, sc('accent2'), 0.75);
    y += 42;
    for (const [dish, desc, price] of items) {
      addText(s, [72, y, W - 220, 40], [para(dish, title(12, { color: sc('tx1') })), para(desc, body(9.5, { italic: true, color: sc('tx2') }))], {}, { name: dish });
      addText(s, [W - 150, y, 78, 22], [para(price, title(12, { color: sc('accent2') }), { align: 'r' })], {}, { name: `Prix ${dish}` });
      y += 46;
    }
    y += 16;
  }
  lines(s, [48, H - 80, W - 96, 30], ['Prix nets, service compris · Liste des allergènes sur demande'], body(8.5, { color: sc('tx2') }), 'ctr');
  return doc;
}

export function certificate(): PubDocument {
  const doc = newDoc(A4_LANDSCAPE, 1, 'certificate', { margins: { top: 48, bottom: 48, inside: 48, outside: 48 } });
  const s = shapesOf(doc.deck, 0);
  const { width: W, height: H } = A4_LANDSCAPE;
  addShape(s, [18, 18, W - 36, H - 36], NO_FILL, { line: { fill: solid(sc('accent1')), width: 6 }, name: 'Bordure' });
  addShape(s, [30, 30, W - 60, H - 60], NO_FILL, { line: { fill: solid(sc('accent2')), width: 1 }, name: 'Bordure fine' });
  addShape(s, [W / 2 - 34, 52, 68, 68], ACCENT(2), { preset: 'star12', name: 'Sceau' });
  heading(s, [60, 130, W - 120, 60], 'CERTIFICAT', 42, { color: sc('accent1') }, 'ctr');
  lines(s, [60, 190, W - 120, 24], ["D'ACCOMPLISSEMENT"], body(14, { bold: true, spacing: 3, color: sc('tx2') }), 'ctr');
  lines(s, [60, 235, W - 120, 22], ['décerné à'], body(13, { italic: true }), 'ctr');
  heading(s, [60, 262, W - 120, 56], 'Prénom Nom', 34, { italic: true, bold: false }, 'ctr');
  addLine(s, W / 2 - 180, 322, W / 2 + 180, 322, sc('accent1'), 1);
  lines(s, [100, 334, W - 200, 50], ['pour avoir suivi avec succès la formation « Mise en page professionnelle »', 'du 2 au 6 mars 2026'], body(12), 'ctr');
  for (const [x, label] of [[110, 'Date'], [W - 310, 'Signature']] as Array<[number, string]>) {
    addLine(s, x, H - 110, x + 200, H - 110, sc('tx1'), 0.75);
    lines(s, [x, H - 104, 200, 20], [label], body(10, { color: sc('tx2') }), 'ctr');
  }
  return doc;
}

/** Etiquettes d'adresse 70 x 37 mm, 24 par feuille A4 (3 x 8), avec champs de publipostage. */
export function labels(): PubDocument {
  const size = { width: mm(70), height: mm(37), type: 'custom' };
  const doc = newDoc(size, 1, 'labels', { margins: { top: 7, bottom: 7, inside: 10, outside: 10 }, bleed: 0 });
  const s = shapesOf(doc.deck, 0);
  addShape(s, [0, 0, 6, size.height], ACCENT(1), { name: 'Repère' });
  addText(s, [14, 10, size.width - 22, size.height - 20], ['«Nom»', '«Adresse»', '«Code postal» «Ville»'].map((t, i) => para(t, body(i === 0 ? 10 : 9, i === 0 ? { bold: true } : {}))), {}, { name: 'Adresse', anchor: 'ctr' });
  doc.pub = { ...doc.pub, imposition: { kind: 'cards', sheet: { width: A4.width, height: A4.height }, cols: 3, rows: 8, gapX: 0, gapY: 0 } };
  return doc;
}

export function banner(): PubDocument {
  const size = { width: mm(1000), height: mm(300), type: 'custom' };
  const doc = newDoc(size, 1, 'banner', { margins: { top: 40, bottom: 40, inside: 40, outside: 40 } });
  const s = shapesOf(doc.deck, 0);
  const { width: W, height: H } = size;
  addShape(s, [0, 0, W, H], DARK, { name: 'Fond' });
  addShape(s, [0, H - 60, W, 60], ACCENT(2), { name: 'Bande' });
  addShape(s, [W - 700, -200, 900, 900], solid(sc('accent1', [{ name: 'alpha', val: 60000 }])), { preset: 'ellipse', name: 'Disque' });
  heading(s, [80, 150, W - 900, 220], 'JOYEUX ANNIVERSAIRE !', 150, { color: sc('bg1') });
  lines(s, [80, 400, W - 900, 80], ['Tous nos vœux pour cette nouvelle année'], body(54, { color: sc('accent2') }));
  return doc;
}

export type BlankFormat = 'a4' | 'a3' | 'a5' | 'letter';

export function blank(format: BlankFormat | SlideSize = 'a4', landscape = false): PubDocument {
  const base = typeof format === 'string' ? SLIDE_SIZES[format] : format;
  const size = landscape && base.height > base.width ? { ...base, width: base.height, height: base.width } : base;
  return newDoc(size, 1, 'blank');
}
