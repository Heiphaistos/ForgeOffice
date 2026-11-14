// Analyse d'un document apres chaque changement d'octets : champs, annotations modifiables, particularites (XFA, JavaScript).
// Un seul chargement pdf-lib pour tout.
import type { Item } from './model.ts';
import { readAnnotations } from './annots.ts';
import { inspectFlags, loadForRead, readFields, type DocFlags, type FieldInfo } from './forms.ts';

export interface Analysis {
  fields: FieldInfo[];
  flags: DocFlags;
  /** Annotations modifiables lues du fichier. */
  existing: Item[];
  /** Octets pour pdf.js : le fichier sans les annotations ci-dessus (redessinees par la couche d'edition). */
  display: Uint8Array;
}

export async function analyze(bytes: Uint8Array): Promise<Analysis> {
  try {
    return await analyzeRaw(bytes);
  } catch (error) {
    // pdf-lib laisse passer des TypeError internes sur un catalogue/arbre de pages malforme : message lisible a la place.
    if (error instanceof TypeError || error instanceof RangeError) throw new Error('Ce fichier PDF est endommagé : structure illisible.');
    throw error;
  }
}

async function analyzeRaw(bytes: Uint8Array): Promise<Analysis> {
  const doc = await loadForRead(bytes);
  const fields = await readFields(bytes, doc);
  const flags = await inspectFlags(bytes, doc);
  const { items, display } = await readAnnotations(bytes, doc); // en dernier : retire les annotations de `doc`
  return { fields, flags, existing: items, display };
}
