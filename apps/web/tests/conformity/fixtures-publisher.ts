// Composition de test : lettre d'information (pages, zones chainees) avec image, formes et zone de texte supplementaire.
import { addPicture, addTable } from '../../../../packages/pptx/src/index.ts';
import { writeFopub } from '../../../../packages/publisher/src/fopub.ts';
import { newsletter } from '../../../../packages/publisher/src/templates/multi.ts';
import { addShape, addText, hex, solid } from '../../../../packages/publisher/src/build.ts';

const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

export async function publisherFixture(): Promise<Uint8Array> {
  const doc = newsletter();
  const page = doc.deck.slides[0];
  if (page) {
    addText(page.shapes, [60, 60, 260, 40], 'Publication de conformité', {}, { name: 'Zone essai', minId: 5000 });
    addShape(page.shapes, [60, 110, 120, 60], solid(hex('C00000')), { preset: 'rect', name: 'Rectangle essai', minId: 5100 });
    addTable(page, 3, 3, { x: 60, y: 190, width: 240, height: 90 }, [['A', 'B', 'C'], ['1', '2', '3'], ['4', '5', '6']]);
    addPicture(doc.deck, page, PNG, 'png', { x: 200, y: 110, width: 100, height: 60 }, 'Image essai');
  }
  return writeFopub(doc);
}
