// Presentation de test riche : titre, texte, formes, image, tableau, graphique, notes.
import * as P from '../../../../packages/pptx/src/index.ts';

const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

function setTitle(slide: P.Slide, title: string, sub?: string): void {
  const texts = slide.shapes.filter((s): s is P.AutoShape => s.kind === 'shape' && !!s.placeholder);
  const [t, s] = texts;
  if (t) t.text = { props: {}, paragraphs: P.paragraphsFromText(title) };
  if (s && sub) s.text = { props: {}, paragraphs: P.paragraphsFromText(sub) };
}

export async function powerpointFixture(): Promise<Uint8Array> {
  const deck = P.createBlankDeck('widescreen', { titleSlide: false });
  const s1 = P.addSlide(deck, 'layout1');
  setTitle(s1, 'Bienvenue à ForgeOffice', 'Présentation de conformité');
  const s2 = P.addSlide(deck, 'layout2');
  setTitle(s2, 'Contenu et formes', 'Premier point\nDeuxième point');
  P.addTextBox(s2, { x: 60, y: 330, width: 300, height: 40 }, 'Zone de texte libre');
  const rect = P.addAutoShape(s2, 'rect', { x: 400, y: 330, width: 140, height: 90 }, 'Rectangle');
  rect.text = { props: {}, paragraphs: P.paragraphsFromText('Forme avec texte') };
  P.addAutoShape(s2, 'ellipse', { x: 560, y: 330, width: 120, height: 90 }, 'Ellipse');
  P.addPicture(deck, s2, PNG, 'png', { x: 700, y: 330, width: 120, height: 90 }, 'Logo');
  const s3 = P.addSlide(deck, 'layout6');
  setTitle(s3, 'Tableau');
  P.addTable(s3, 3, 3, { x: 60, y: 130, width: 500, height: 150 }, [['Produit', 'Quantité', 'Prix'], ['Pomme', '3', '1,20'], ['Poire', '5', '2,10']]);
  const s4 = P.addSlide(deck, 'layout6');
  setTitle(s4, 'Graphique');
  P.addChart(s4, 'bar', ['T1', 'T2', 'T3'], [{ name: 'Ventes', values: [10, 20, 15] }], { x: 60, y: 130, width: 500, height: 300 });
  P.setNotes(s4, 'Notes de la diapositive graphique');
  P.addSlide(deck, 'layout7');
  return P.writePptx(deck);
}
