// Fusion de formes sur la selection : remplace les formes par une forme libre (formatage de la premiere forme selectionnee).
import type { AutoShape, Shape } from '@forgeoffice/pptx';
import type { MenuItem } from '@forgeoffice/ui';
import { mergeShapes, type MergeOp } from '../canvas/boolean-ops/merge.ts';
import { locate } from '../canvas/ops.ts';
import type { Editor } from './editor.ts';
import { S3 } from './strings-text.ts';

/** Formes simples de la selection, dans l'ordre de selection. */
function mergeable(ed: Editor): AutoShape[] {
  return ed.selection.ids.map((id) => locate(ed.pageShapes, id)?.shape).filter((s): s is AutoShape => s?.kind === 'shape');
}

export function mergeSelection(ed: Editor, op: MergeOp): void {
  const shapes = mergeable(ed);
  if (shapes.length < 2 || shapes.length !== ed.selection.ids.length) return;
  const frames = shapes.flatMap((raw) => {
    const x = ed.ctx.resolve(raw).xfrm;
    return x ? [{ shape: raw, frame: x }] : [];
  });
  const merged = mergeShapes(frames, op);
  if (!merged) {
    ed.notify(S3.merge.empty, 'info');
    return;
  }
  const first = shapes[0] as AutoShape;
  let newId = first.id;
  ed.editShapes((list) => {
    const at = locate(list, first.id);
    if (!at) return;
    const resolved = ed.ctx.resolve(first) as AutoShape;
    const result: AutoShape = { ...structuredClone(first), ...merged, name: `${S3.merge.name} ${first.id}`, fill: resolved.fill ?? first.fill, line: resolved.line ?? first.line };
    delete result.text;
    delete result.placeholder;
    delete result.textBox;
    for (const s of shapes.slice(1)) {
      const found = locate(list, s.id);
      if (found) found.list.splice(found.index, 1);
    }
    const idx = locate(list, first.id);
    if (idx) idx.list[idx.index] = result as Shape;
    newId = result.id;
  }, 'merge-shapes');
  ed.setSelection({ ids: [newId] });
}

/** Sous-menu « Fusionner les formes » (actif avec deux formes simples ou plus). */
export function mergeMenuItems(ed: Editor): MenuItem[] {
  const enabled = mergeable(ed).length >= 2 && mergeable(ed).length === ed.selection.ids.length;
  const entry = (op: MergeOp, label: string): MenuItem => ({ id: `merge-${op}`, label, disabled: !enabled, onClick: () => mergeSelection(ed, op) });
  return [entry('union', S3.merge.union), entry('combine', S3.merge.combine), entry('intersect', S3.merge.intersect), entry('subtract', S3.merge.subtract)];
}
