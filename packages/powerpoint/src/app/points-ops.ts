// Entree dans la modification des points : la forme predefinie devient une forme libre equivalente.
import type { AutoShape, Shape } from '@forgeoffice/pptx';
import { localSubPaths } from '../canvas/boolean-ops/merge.ts';
import { locate } from '../canvas/ops.ts';
import { toGeometry } from '../canvas/path-edit/model.ts';
import type { Editor } from './editor.ts';

/** Forme simple unique dont on peut editer les points. */
export function pointsTarget(ed: Editor): AutoShape | undefined {
  if (ed.selection.ids.length !== 1) return undefined;
  const shape = locate(ed.pageShapes, ed.selection.ids[0] as number)?.shape;
  return shape?.kind === 'shape' ? shape : undefined;
}

export function startEditPoints(ed: Editor): void {
  const target = pointsTarget(ed);
  if (!target) return;
  const frame = ed.ctx.resolve(target as Shape).xfrm;
  if (!frame) return;
  if (target.geometry.type !== 'custom') {
    const subs = localSubPaths(target, frame.width, frame.height, false);
    const filled = target.geometry.type === 'preset' && subs.some((s) => s.closed);
    ed.editShapes((list) => {
      const found = locate(list, target.id);
      if (found?.shape.kind !== 'shape') return;
      found.shape.xfrm = { ...frame };
      found.shape.geometry = toGeometry(subs, 0, 0, frame.width, frame.height, filled);
    }, 'edit-points-start');
  }
  ed.setUi({ editPoints: target.id });
}
