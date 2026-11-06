// PDF de test de 3 pages : texte, formulaire (champ texte + case) et annotation (note).
import { PDFDocument, PDFName, PDFString, StandardFonts } from '@cantoo/pdf-lib';

export async function pdfFixture(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const p1 = pdf.addPage([595, 842]);
  p1.drawText('Document PDF de conformité', { x: 60, y: 760, size: 24, font });
  p1.drawText('Premiere page : texte courant pour la recherche et le surlignage.', { x: 60, y: 720, size: 12, font });
  const p2 = pdf.addPage([595, 842]);
  p2.drawText('Page deux : formulaire', { x: 60, y: 760, size: 18, font });
  const form = pdf.getForm();
  const tf = form.createTextField('nom');
  tf.addToPage(p2, { x: 60, y: 700, width: 200, height: 24 });
  tf.setText('Dupont');
  const cb = form.createCheckBox('accepte');
  cb.addToPage(p2, { x: 60, y: 660, width: 18, height: 18 });
  const p3 = pdf.addPage([595, 842]);
  p3.drawText('Page trois : annotation', { x: 60, y: 760, size: 18, font });
  const note = pdf.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [60, 700, 80, 720], Contents: PDFString.of('Note de test'), Name: PDFName.of('Comment'), C: [1, 0.8, 0] });
  p3.node.set(PDFName.of('Annots'), pdf.context.obj([pdf.context.register(note)]));
  pdf.setTitle('Conformité');
  return pdf.save();
}
