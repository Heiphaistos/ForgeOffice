// Objets du document (formes, zones de texte, images) pour le volet Sélection, dans l'ordre du texte.
import type { Node as PMNode } from 'prosemirror-model';
import type { Inline } from '@forgeoffice/docx';
import { geometryLabel } from './geometry.ts';

export interface DocObject {
  pos: number;
  kind: 'shape' | 'image';
  label: string;
  floating: boolean;
  zIndex: number;
}

export function listObjects(doc: PMNode): DocObject[] {
  const out: DocObject[] = [];
  let shapes = 0;
  let images = 0;
  doc.descendants((node, pos) => {
    if (node.type.name !== 'atom') return true;
    const d = node.attrs.data as Inline;
    if (d.type === 'shape') {
      const first = d.text?.[0];
      const text = first?.type === 'paragraph' ? first.inlines.map((i) => (i.type === 'text' ? i.text : '')).join('').slice(0, 24) : '';
      out.push({ pos, kind: 'shape', label: d.name || `${d.text ? 'Zone de texte' : geometryLabel(d.geometry)} ${++shapes}${text ? ` : ${text}` : ''}`, floating: !!d.floating, zIndex: d.floating?.zIndex ?? 0 });
    } else if (d.type === 'image') out.push({ pos, kind: 'image', label: d.name || d.alt || `Image ${++images}`, floating: !!d.floating, zIndex: d.floating?.zIndex ?? 0 });
    return true;
  });
  return out;
}
