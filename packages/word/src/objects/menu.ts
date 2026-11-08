// Menu contextuel d'une forme ou d'une zone de texte : habillage, position, ordre, rotation, texte, suppression.
import type { MenuItem } from '@forgeoffice/ui';
import type { Inline, ShapeInline } from '@forgeoffice/docx';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { updateAtom } from '../editor/commands.ts';
import { IMAGE_WRAPS, withAlign, wrapOf, wrapPatch, type ImageWrap } from '../editor/images.ts';

const O = X.objects;
const LABEL: Readonly<Record<ImageWrap, string>> = {
  inline: T.cmd.wrapInline, square: T.cmd.wrapSquare, tight: T.cmd.wrapTight, topAndBottom: T.cmd.wrapTopBottom, behind: T.cmd.wrapBehind, front: T.cmd.wrapFront,
};

/** Position ProseMirror de la forme qui affiche cet element du DOM, ou null. */
export function shapePosOf(c: Ctl, el: HTMLElement): number | null {
  const view = c.view();
  let found: number | null = null;
  view?.state.doc.descendants((node, pos) => {
    if (found === null && node.type.name === 'atom' && (node.attrs.data as Inline).type === 'shape' && view.nodeDOM(pos) === el) found = pos;
    return found === null;
  });
  return found;
}

export function shapeItems(c: Ctl, pos: number): MenuItem[] {
  const read = (): ShapeInline | null => {
    const node = c.state()?.doc.nodeAt(pos);
    const d = node?.attrs.data as Inline | undefined;
    return d?.type === 'shape' ? d : null;
  };
  const update = (patch: (s: ShapeInline) => Partial<ShapeInline>): void => {
    const s = read();
    if (s) c.run(updateAtom(pos, { ...s, ...patch(s) }));
  };
  const select = (): void => {
    c.run((state, dispatch) => {
      if (dispatch) dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
      return true;
    });
  };
  const s = read();
  const floating = !!s?.floating;
  return [
    { id: 's-wrap', label: T.cmd.wrapText, icon: 'text_wrap', items: IMAGE_WRAPS.map((m): MenuItem => ({ id: `w-${m}`, label: LABEL[m], checked: !!s && wrapOf(s) === m, onClick: () => update((x) => wrapPatch(x, m)) })) },
    { id: 's-pos', label: T.cmd.position, disabled: !floating, items: (['left', 'center', 'right'] as const).map((a): MenuItem => ({ id: `p-${a}`, label: T.ctx[a === 'left' ? 'alignLeft' : a === 'center' ? 'alignCenter' : 'alignRight'], onClick: () => update((x) => withAlign(x, a)) })) },
    { id: 's-front', label: O.bringForward, disabled: !floating, onClick: () => update((x) => ({ floating: x.floating && { ...x.floating, zIndex: x.floating.zIndex + 1 } })) },
    { id: 's-back', label: O.sendBackward, disabled: !floating, onClick: () => update((x) => ({ floating: x.floating && { ...x.floating, zIndex: Math.max(0, x.floating.zIndex - 1) } })) },
    { id: 's-rot', label: O.rotateRight, onClick: () => update((x) => ({ rotation: (((x.rotation ?? 0) + 90) % 360) || undefined })) },
    { id: 's-text', label: O.editText, icon: 'textbox', onClick: () => { select(); c.openDialog('shapeText'); } },
    { id: 's-del', label: O.deleteShape, icon: 'delete', onClick: () => c.run((state, dispatch) => { if (dispatch) dispatch(state.tr.delete(pos, pos + 1).setSelection(TextSelection.near(state.doc.resolve(pos)))); return true; }) },
    { id: 'sep-shape', kind: 'separator' },
  ];
}
