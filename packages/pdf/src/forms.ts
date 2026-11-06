// Formulaires AcroForm reels (sans DOM, teste) : lecture des champs avec leur place sur la page affichee (/Rotate et CropBox compris),
// ecriture des valeurs (/V + apparence /AP regeneree + NeedAppearances), detection XFA et JavaScript (jamais execute).
import {
  PDFArray, PDFBool, PDFObject, PDFRawStream, PDFCheckBox, PDFDict, PDFDocument, PDFDropdown, PDFName, PDFOptionList, PDFRadioGroup, PDFSignature, PDFTextField, type PDFField,
} from '@cantoo/pdf-lib';
import { fromPdfRect, type Rect } from './model.ts';
import { geomOf } from './geom.ts';

/** Champ existant du formulaire, avec sa position sur la page affichee. */
export interface FieldInfo {
  name: string;
  type: 'texte' | 'case' | 'radio' | 'liste' | 'signature' | 'autre';
  value: string | boolean;
  options: string[];
  multiline: boolean;
  readOnly: boolean;
  /** Champ de signature deja signe. */
  signed: boolean;
  widgets: { page: number; rect: Rect; option?: string }[];
}

export const loadForRead = (bytes: Uint8Array): Promise<PDFDocument> => PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true, throwOnInvalidObject: false, preserveXFA: true });

/** Champs du formulaire (pdf-lib) avec les rectangles normalises de leurs widgets. */
export async function readFields(bytes: Uint8Array, loaded?: PDFDocument): Promise<FieldInfo[]> {
  const doc = loaded ?? await loadForRead(bytes);
  const pages = doc.getPages();
  const refPage = new Map<string, number>();
  pages.forEach((p, i) => {
    const annots = p.node.Annots();
    for (let k = 0; k < (annots?.size() ?? 0); k++) {
      const ref = annots?.get(k);
      if (ref) refPage.set(ref.toString(), i);
    }
  });
  const out: FieldInfo[] = [];
  for (const field of doc.getForm().getFields()) {
    const name = field.getName();
    let type: FieldInfo['type'] = 'autre';
    let value: string | boolean = '';
    let options: string[] = [];
    let multiline = false;
    let signed = false;
    if (field instanceof PDFTextField) {
      type = 'texte';
      value = field.getText() ?? '';
      multiline = field.isMultiline();
    } else if (field instanceof PDFCheckBox) {
      type = 'case';
      value = field.isChecked();
    } else if (field instanceof PDFRadioGroup) {
      type = 'radio';
      value = field.getSelected() ?? '';
      options = field.getOptions();
    } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
      type = 'liste';
      value = field.getSelected()[0] ?? '';
      options = field.getOptions();
    } else if (field instanceof PDFSignature) {
      type = 'signature';
      signed = field.acroField.dict.lookupMaybe(PDFName.of('V'), PDFDict) !== undefined;
    }
    const widgets: FieldInfo['widgets'] = [];
    field.acroField.getWidgets().forEach((w, wi) => {
      const ref = doc.context.getObjectRef(w.dict);
      const index = ref ? refPage.get(ref.toString()) : undefined;
      const page = index === undefined ? undefined : pages[index];
      if (index === undefined || !page) return;
      const r = w.getRectangle();
      const rect = fromPdfRect([r.x, r.y, r.x + r.width, r.y + r.height], geomOf(page));
      widgets.push({ page: index, rect, option: type === 'radio' ? radioOption(w.getOnValue()?.decodeText(), options, wi) : undefined });
    });
    out.push({ name, type, value, options, multiline, readOnly: field.isReadOnly(), signed, widgets });
  }
  return out;
}

/** Valeur d'export d'un bouton radio : l'etat « actif » est soit la valeur, soit l'indice dans /Opt. */
function radioOption(on: string | undefined, options: readonly string[], index: number): string | undefined {
  if (on !== undefined && /^[0-9]+$/.test(on) && options[Number(on)] !== undefined) return options[Number(on)];
  return on ?? options[index];
}

/** Texte accepte par la police standard des apparences (WinAnsi) : le reste devient « ? ». */
const WIN_ANSI = /[^ -~ -ÿ€‘’“”•–—…\n]/g;
export const winAnsi = (s: string): string => s.replace(WIN_ANSI, '?');

function select(field: PDFDropdown | PDFOptionList | PDFRadioGroup, value: string): void {
  if (!(field instanceof PDFRadioGroup) && !field.getOptions().includes(value)) field.addOptions([value]);
  field.select(value);
}

/** Ecrit les valeurs saisies dans les champs existants (/V), regenere les apparences et demande aux lecteurs de les redessiner. */
export function writeValues(doc: PDFDocument, values: Readonly<Record<string, string | boolean>>): void {
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    const field: PDFField | undefined = form.getFieldMaybe(name);
    if (!field) continue;
    if (field instanceof PDFTextField) field.setText(winAnsi(String(value)));
    else if (field instanceof PDFCheckBox) {
      if (value === true) field.check();
      else field.uncheck();
    } else if (field instanceof PDFDropdown || field instanceof PDFOptionList || field instanceof PDFRadioGroup) {
      if (value === '') field.clear(); // effacer le champ
      else select(field, String(value));
    }
  }
  if (Object.keys(values).length > 0) form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
}

/** Particularites d'un document qui demandent un avis a l'utilisateur. */
export interface DocFlags {
  /** Formulaire XFA (non pris en charge : seuls les champs AcroForm sont utilises). */
  xfa: boolean;
  /** Code JavaScript embarque (jamais execute). */
  javascript: boolean;
}

export async function inspectFlags(bytes: Uint8Array, loaded?: PDFDocument): Promise<DocFlags> {
  const doc = loaded ?? await loadForRead(bytes);
  const acro = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  const xfa = acro?.has(PDFName.of('XFA')) ?? false;
  let javascript = false;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (hasScript(obj)) {
      javascript = true;
      break;
    }
  }
  return { xfa, javascript };
}

/** Action JavaScript dans un objet (dictionnaires et tableaux en ligne ; les references sont parcourues a part). */
function hasScript(obj: PDFObject, depth = 0): boolean {
  if (depth > 12) return false;
  const dict = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : undefined;
  if (dict) {
    const s = dict.get(PDFName.of('S'));
    if (dict.has(PDFName.of('JS')) || (s instanceof PDFName && s.decodeText() === 'JavaScript')) return true;
    return dict.values().some((v) => hasScript(v, depth + 1));
  }
  if (obj instanceof PDFArray) return obj.asArray().some((v) => hasScript(v, depth + 1));
  return false;
}
