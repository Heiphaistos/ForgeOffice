// Ecriture des elements en attente dans le PDF avec pdf-lib (sans DOM, teste) :
// - annotations reelles (voir appearance.ts) et modification/suppression de celles deja presentes dans le fichier ;
// - champs de formulaire crees, valeurs saisies (forms.ts), aplatissement ;
// - signature visuelle (image) et correction de texte « couvrir et reecrire » (repli sans moteur natif).
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import { removeAnnotations } from './annots.ts';
import { coverText, drawSignature, writeItem, type Ctx } from './appearance.ts';
import { writeValues } from './forms.ts';
import { geomOf } from './geom.ts';
import { toPdfRect, type DocState, type Item } from './model.ts';

export { geomOf };

/** Sur une page pivotee, le contenu du champ est tourne (MK/R) pour rester droit a l'ecran. */
function turnWidgets(field: { acroField: { getWidgets(): { getOrCreateAppearanceCharacteristics(): { setRotation(n: number): void } }[] } }, rotate: number): void {
  if (rotate === 0) return;
  for (const w of field.acroField.getWidgets()) w.getOrCreateAppearanceCharacteristics().setRotation(rotate);
}

export interface ApplyOptions {
  /** Corrections de texte ecrites en « couvrir et reecrire » (sans moteur natif). */
  coverTextEdits: boolean;
  /** Aplatir le formulaire apres ecriture. */
  flatten?: boolean;
}

/** Ecrit les elements (hors caviardage, et hors corrections si `coverTextEdits` est faux) et les valeurs de champs. */
export async function applyItems(bytes: Uint8Array, state: Pick<DocState, 'items' | 'values' | 'annotEdits'>, o: ApplyOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const c: Ctx = { doc, helv: await doc.embedFont(StandardFonts.Helvetica), helvBold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const pages = doc.getPages();
  const form = doc.getForm();
  // Annotations deja dans le fichier : l'ancienne est retiree, la version modifiee (si elle existe) est reecrite.
  removeAnnotations(doc, Object.keys(state.annotEdits));
  const edited = Object.values(state.annotEdits).filter((i): i is Item => i !== null);
  for (const item of [...edited, ...state.items]) {
    const page = pages[item.page];
    if (!page) continue;
    const g = geomOf(page);
    if (item.kind === 'signature') drawSignature(page, g, item.rect, await doc.embedPng(item.png));
    else if (item.kind === 'textedit') {
      if (o.coverTextEdits) coverText(c, page, g, item.rect, item.text, item.size);
    } else if (item.kind === 'field') {
      const [x0, y0, x1, y1] = toPdfRect(item.rect, g);
      const box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0, font: c.helv };
      switch (item.field) {
        case 'texte':
        case 'zone_texte': {
          const f = form.createTextField(item.name);
          if (item.field === 'zone_texte') f.enableMultiline();
          if (item.value) f.setText(item.value);
          f.addToPage(page, box);
          turnWidgets(f, g.rotate);
          break;
        }
        case 'case': {
          const f = form.createCheckBox(item.name);
          f.addToPage(page, box);
          turnWidgets(f, g.rotate);
          if (item.value === 'oui') f.check();
          break;
        }
        case 'radio': {
          const f = form.getFieldMaybe(item.name) ? form.getRadioGroup(item.name) : form.createRadioGroup(item.name);
          f.addOptionToPage(item.value || item.id, page, box);
          turnWidgets(f, g.rotate);
          break;
        }
        case 'liste_deroulante':
        case 'liste': {
          const f = item.field === 'liste' ? form.createOptionList(item.name) : form.createDropdown(item.name);
          f.addOptions(item.options);
          f.addToPage(page, box);
          turnWidgets(f, g.rotate);
          break;
        }
      }
    } else if (item.kind !== 'redact') writeItem(c, page, g, item);
  }
  writeValues(doc, state.values);
  if (o.flatten) form.flatten();
  return doc.save({ useObjectStreams: true });
}

