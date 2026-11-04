// Compositions de plusieurs pages : carte de voeux pliee, brochure trois volets, lettre d'information, calendrier.
import { addTable, SLIDE_SIZES, type AutoShape, type Slide, type SlideSize } from '@forgeoffice/pptx';
import { addLine, addShape, addText, pageNumberParagraph, para, sc, solid, MASTER_SHAPE_BASE, NO_FILL } from '../build.ts';
import { MONTHS, WEEKDAYS, monthGrid } from '../calendar.ts';
import type { PubDocument } from '../fopub.ts';
import type { Chain } from '../model.ts';
import { ACCENT, body, DARK, heading, lines, newDoc, PALE, paragraphs, photo, SAMPLE, shapesOf, title } from './kit.ts';

const A4: SlideSize = SLIDE_SIZES.a4;
const A4_LANDSCAPE: SlideSize = { width: A4.height, height: A4.width };

/** Carte pliee en deux : 4 pages A5 (couverture, interieur gauche et droit, dos), imprimees 2 par feuille A4. */
export function greetingCard(): PubDocument {
  const size = SLIDE_SIZES.a5;
  const doc = newDoc(size, 4, 'greetingCard', { margins: { top: 28, bottom: 28, inside: 28, outside: 28 } });
  doc.pub.imposition = { kind: 'fold', sheet: { width: A4.height, height: A4.width }, cols: 2, rows: 1, gapX: 0, gapY: 0 };
  const { width: W, height: H } = size;
  const front = shapesOf(doc.deck, 0);
  addShape(front, [0, 0, W, H], DARK, { name: 'Fond' });
  photo(front, [28, 28, W - 56, H * 0.55]);
  heading(front, [28, H * 0.55 + 50, W - 56, 60], 'Meilleurs vœux', 38, { color: sc('bg1') }, 'ctr');
  lines(front, [28, H * 0.55 + 112, W - 56, 30], ['pour cette nouvelle année'], body(14, { italic: true, color: sc('accent2') }), 'ctr');
  const left = shapesOf(doc.deck, 1);
  addText(left, [40, H / 2 - 80, W - 80, 160], [para('« Le bonheur est la seule chose qui se double si on le partage. »', body(16, { italic: true, color: sc('accent1') }), { align: 'ctr' }), para('Albert Schweitzer', body(10, { color: sc('tx2') }), { align: 'ctr', spaceBefore: { type: 'pts', value: 12 } })], {}, { anchor: 'ctr', name: 'Citation' });
  const right = shapesOf(doc.deck, 2);
  addText(right, [40, 80, W - 80, H - 160], [
    para('Chers amis,', title(16, { color: sc('accent1') }), { spaceAfter: { type: 'pts', value: 12 } }),
    para("Que cette année vous apporte la joie, la santé et la réussite dans tous vos projets. Merci pour votre fidélité et votre confiance tout au long de l'année écoulée.", body(12), { spaceAfter: { type: 'pts', value: 12 } }),
    para('Très chaleureusement,', body(12, { italic: true })),
    para('Toute l’équipe', body(12, { bold: true })),
  ], {}, { name: 'Message' });
  const back = shapesOf(doc.deck, 3);
  addShape(back, [W / 2 - 18, H - 120, 36, 36], ACCENT(2), { preset: 'ellipse', name: 'Logo' });
  lines(back, [28, H - 76, W - 56, 30], ['Atelier Lumière · www.exemple.fr'], body(8, { color: sc('tx2') }), 'ctr');
  return doc;
}

/** Brochure trois volets A4 paysage : 2 pages (exterieur, interieur), reperes de 3 colonnes. */
export function trifold(): PubDocument {
  const m = 28;
  const doc = newDoc(A4_LANDSCAPE, 2, 'trifold', { margins: { top: m, bottom: m, inside: m, outside: m }, columns: { count: 3, gap: 2 * m } });
  const { width: W, height: H } = A4_LANDSCAPE;
  const panel = (W - 6 * m) / 3;
  const x = (i: number): number => m + i * (panel + 2 * m);
  const out = shapesOf(doc.deck, 0);
  // Volet rabattu (gauche), dos (centre), couverture (droite).
  heading(out, [x(0), m, panel, 30], 'Qui sommes-nous ?', 18, { color: sc('accent1') });
  addText(out, [x(0), m + 40, panel, 250], paragraphs([SAMPLE.body, SAMPLE.short], body(10.5)), {}, { name: 'Présentation' });
  photo(out, [x(0), m + 310, panel, 200]);
  addShape(out, [x(1) - m, 0, panel + 2 * m, H], PALE, { name: 'Fond du dos' });
  heading(out, [x(1), H / 2 - 120, panel, 30], 'Nous contacter', 16, { color: sc('accent1') }, 'ctr');
  lines(out, [x(1), H / 2 - 80, panel, 120], ['Atelier Lumière', '12 rue des Arts', '69001 Lyon', '04 00 00 00 00', 'contact@exemple.fr'], body(11), 'ctr');
  addShape(out, [x(2) - m, 0, panel + 2 * m, H], DARK, { name: 'Fond de couverture' });
  photo(out, [x(2), m + 20, panel, 260]);
  heading(out, [x(2), m + 300, panel, 90], 'Découvrez nos ateliers', 28, { color: sc('bg1') }, 'ctr');
  lines(out, [x(2), m + 400, panel, 40], ['Création · Formation · Conseil'], body(12, { color: sc('accent2') }), 'ctr');
  const inner = shapesOf(doc.deck, 1);
  const titles = ['Nos ateliers', 'Nos formations', 'Nos tarifs'];
  titles.forEach((t, i) => {
    addShape(inner, [x(i), m, panel, 6], ACCENT(i === 1 ? 2 : 1), { name: `Filet ${i + 1}` });
    heading(inner, [x(i), m + 14, panel, 34], t, 20, { color: sc('accent1') });
    addText(inner, [x(i), m + 56, panel, i === 1 ? 220 : 420], paragraphs([SAMPLE.body, SAMPLE.short, SAMPLE.short], body(10.5)), {}, { name: `Texte ${i + 1}` });
  });
  photo(inner, [x(1), m + 290, panel, 180]);
  return doc;
}

/** Lettre d'information A4 de 4 pages en vis-a-vis : page maitre (filet et numero), article chaine sur 2 pages. */
export function newsletter(): PubDocument {
  const m = 40;
  const doc = newDoc(A4, 4, 'newsletter', { facing: true, margins: { top: m, bottom: m, inside: 44, outside: 36 }, columns: { count: 3, gap: 14 } });
  const { width: W, height: H } = A4;
  const master = doc.deck.masters[0]?.layouts[0];
  if (master) {
    addLine(master.shapes, 36, H - 30, W - 36, H - 30, sc('accent1'), 0.75, undefined, MASTER_SHAPE_BASE);
    addText(master.shapes, [W / 2 - 40, H - 28, 80, 20], [pageNumberParagraph(body(9, { color: sc('tx2') }), { align: 'ctr' })], {}, { name: 'Numéro de page', minId: MASTER_SHAPE_BASE });
  }
  const colW = (W - 44 - 36 - 28) / 3;
  const col = (i: number): number => 44 + i * (colW + 14);
  const chains: Chain[] = [];
  const chainBox = (shape: AutoShape): AutoShape => {
    if (shape.text) shape.text.props = { ...shape.text.props, vertOverflow: 'clip' };
    return shape;
  };
  const slideId = (i: number): number => (doc.deck.slides[i] as Slide).id;

  const p1 = shapesOf(doc.deck, 0);
  addShape(p1, [0, 0, W, 150], DARK, { name: 'Bandeau' });
  heading(p1, [44, 34, W - 88, 60], 'La Gazette du Quartier', 40, { color: sc('bg1') });
  lines(p1, [44, 98, W - 88, 24], ['Numéro 12 · Printemps 2026 · Lettre d’information de l’association'], body(11, { color: sc('accent2') }));
  heading(p1, [col(0), 166, 2 * colW + 14, 70], 'Le jardin partagé fête ses dix ans', 24, { color: sc('accent1') });
  const a1 = chainBox(addText(p1, [col(0), 240, colW, H - 240 - m - 10], paragraphs([SAMPLE.article, SAMPLE.article, SAMPLE.article], body(10.5)), {}, { name: 'Article 1' }));
  const a2 = chainBox(addText(p1, [col(1), 240, colW, H - 240 - m - 10], [para('', body(10.5))], {}, { name: 'Article 1 (suite)' }));
  const pic = photo(p1, [col(0) + colW / 2, 330, colW + 14, 150]);
  addShape(p1, [col(2), 170, colW, H - 170 - m - 10], PALE, { name: 'Encadré' });
  addText(p1, [col(2) + 6, 180, colW - 12, 300], [
    para('Dans ce numéro', title(14, { color: sc('accent1') }), { spaceAfter: { type: 'pts', value: 8 } }),
    ...['Le jardin partagé fête ses dix ans · 1', 'Portrait : la boulangère du coin · 2', 'Agenda du trimestre · 3', 'Adhérer à l’association · 4'].map((t) => para(t, body(10), { spaceAfter: { type: 'pts', value: 6 } })),
  ], {}, { name: 'Sommaire' });

  const p2 = shapesOf(doc.deck, 1);
  heading(p2, [36, m, W - 80, 30], 'Suite de la une', 14, { color: sc('tx2'), italic: true });
  const a3 = chainBox(addText(p2, [36, m + 40, colW, 320], [para('', body(10.5))], {}, { name: 'Article 1 (fin)' }));
  heading(p2, [36 + colW + 14, m + 40, 2 * colW + 14, 50], 'Portrait : la boulangère du coin', 22, { color: sc('accent1') });
  photo(p2, [36 + colW + 14, m + 100, 2 * colW + 14, 200]);
  addText(p2, [36 + colW + 14, m + 310, 2 * colW + 14, 300], paragraphs([SAMPLE.article], body(10.5)), {}, { name: 'Article 2', columns: 2, gap: 14 });
  chains.push({ id: 'article1', boxes: [{ page: slideId(0), shape: a1.id }, { page: slideId(0), shape: a2.id }, { page: slideId(1), shape: a3.id }], joins: [false, false], empty: [false, true, true] });

  const p3 = shapesOf(doc.deck, 2);
  heading(p3, [44, m, W - 80, 40], 'Agenda du trimestre', 26, { color: sc('accent1') });
  const events: Array<[string, string]> = [['12 avril', 'Troc de plantes au jardin'], ['3 mai', 'Repas de quartier'], ['24 mai', 'Atelier compost'], ['14 juin', 'Fête de la musique'], ['28 juin', 'Assemblée générale']];
  events.forEach(([date, what], i) => {
    const y = m + 60 + i * 64;
    addShape(p3, [44, y, 90, 50], ACCENT(i % 2 ? 2 : 1), { preset: 'roundRect', name: `Date ${i + 1}` });
    lines(p3, [44, y, 90, 50], [date], title(12, { color: sc('bg1') }), 'ctr', { anchor: 'ctr' });
    addText(p3, [146, y + 8, W - 200, 40], [para(what, title(13, { color: sc('tx1') })), para('Rendez-vous à 14 h, entrée libre.', body(10, { color: sc('tx2') }))], {}, { name: `Événement ${i + 1}` });
  });
  addShape(p3, [44, m + 400, W - 80, 2], ACCENT(2), { name: 'Filet' });
  addText(p3, [44, m + 420, W - 80, 300], paragraphs([SAMPLE.article], body(10.5)), {}, { name: 'Article 3', columns: 2, gap: 14 });

  const p4 = shapesOf(doc.deck, 3);
  heading(p4, [36, m, W - 80, 40], 'Adhérer à l’association', 26, { color: sc('accent1') });
  addText(p4, [36, m + 50, W - 80, 160], paragraphs([SAMPLE.body, SAMPLE.short], body(11)), {}, { name: 'Adhésion' });
  addShape(p4, [36, m + 230, W - 80, 170], NO_FILL, { line: { fill: solid(sc('tx2')), width: 1, dash: 'dash' }, name: 'Coupon' });
  addText(p4, [48, m + 240, W - 104, 150], ['Bulletin d’adhésion', 'Nom : ...............................................   Prénom : ...............................................', 'Adresse : ..........................................................................................................', 'Courriel : ..........................................   Cotisation : 15 €'].map((t, i) => para(t, i ? body(11) : title(13, { color: sc('accent1') }), { spaceAfter: { type: 'pts', value: 10 } })), {}, { name: 'Coupon - texte' });
  addShape(p4, [W - 260, H - 230, 220, 140], PALE, { name: 'Adresse postale' });
  lines(p4, [W - 250, H - 220, 200, 120], ['«Nom»', '«Adresse»', '«Code postal» «Ville»'], body(11), 'l', { anchor: 'ctr' });
  doc.pub.chains = chains;
  doc.pub.wraps = { [`${slideId(0)}:${pic}`]: 'square' };
  return doc;
}

/** Calendrier mensuel A4 paysage : une page par mois, grille en tableau, semaines du lundi au dimanche. */
export function calendar(year = new Date().getFullYear()): PubDocument {
  const doc = newDoc(A4_LANDSCAPE, 12, 'calendar', { margins: { top: 28, bottom: 28, inside: 28, outside: 28 } });
  const { width: W, height: H } = A4_LANDSCAPE;
  const side = 230;
  for (let month = 0; month < 12; month++) {
    const s = shapesOf(doc.deck, month);
    addShape(s, [0, 0, side, H], DARK, { name: 'Bande' });
    photo(s, [20, 20, side - 40, 240]);
    heading(s, [20, 290, side - 40, 50], MONTHS[month] ?? '', 34, { color: sc('bg1') });
    lines(s, [20, 340, side - 40, 36], [String(year)], body(20, { color: sc('accent2'), bold: true }));
    addText(s, [20, H - 160, side - 40, 120], paragraphs(['Notes'], title(12, { color: sc('accent2') })), {}, { name: 'Notes' });
    const weeks = monthGrid(year, month);
    const values = [[...WEEKDAYS], ...weeks.map((w) => w.map((d) => (d === null ? '' : String(d))))];
    const grid = addTable({ shapes: s } as Slide, values.length, 7, { x: side + 24, y: 28, width: W - side - 52, height: H - 56 }, values);
    grid.name = `Calendrier ${MONTHS[month]}`;
    const rowH = (H - 56 - 30) / weeks.length;
    grid.table.rows.forEach((row, r) => {
      row.height = r === 0 ? 30 : rowH;
      row.cells.forEach((cell, c) => {
        cell.anchor = r === 0 ? 'ctr' : 't';
        for (const p of cell.text.paragraphs) {
          p.props = { ...p.props, align: r === 0 ? 'ctr' : 'r' };
          for (const run of p.runs) run.props = { ...run.props, size: r === 0 ? 11 : 14, bold: r === 0 || c >= 5, font: '+mn-lt' };
        }
      });
    });
  }
  return doc;
}

