// Onglet contextuel « Format de forme » : forme, remplissage, contour, position, habillage, ordre, taille, texte.
import type { MenuItem, RibbonTab } from '@forgeoffice/ui';
import type { ShapeInline } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { updateAtom } from '../editor/commands.ts';
import { IMAGE_WRAPS, nudge, withAlign, wrapOf, wrapPatch, type ImageWrap } from '../editor/images.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';
import { GEOMETRIES } from './geometry.ts';

const O = X.objects;
const SHAPE_COLOR = '#7A3E9D';
const WRAP_LABEL: Readonly<Record<ImageWrap, string>> = {
  inline: T.cmd.wrapInline, square: T.cmd.wrapSquare, tight: T.cmd.wrapTight, topAndBottom: T.cmd.wrapTopBottom, behind: T.cmd.wrapBehind, front: T.cmd.wrapFront,
};

export function shapeTab(c: Ctl): RibbonTab {
  const shp = c.sel.shape;
  const data = shp?.data;
  const update = (patch: Partial<ShapeInline>): void => {
    if (shp) c.run(updateAtom(shp.pos, { ...shp.data, ...patch }));
  };
  const geometries: [string, string][] = GEOMETRIES.map((g) => [g.id, g.label]);
  const z = (d: number): void => {
    if (shp?.data.floating) update({ floating: { ...shp.data.floating, zIndex: Math.max(0, shp.data.floating.zIndex + d) } });
  };
  const place = (a: 'left' | 'center' | 'right'): void => {
    if (shp) c.run(updateAtom(shp.pos, withAlign(shp.data, a)));
  };
  const move = (dx: number, dy: number): void => {
    if (shp) c.run(updateAtom(shp.pos, nudge(shp.data, dx, dy)));
  };
  const positions: MenuItem[] = [['left', T.ctx.alignLeft], ['center', T.ctx.alignCenter], ['right', T.ctx.alignRight]]
    .map(([a, label]) => ({ id: `pos-${a}`, label: label!, disabled: !data?.floating, checked: data?.floating?.horizontal.align === a, onClick: () => place(a as 'left' | 'center' | 'right') }));
  return {
    id: 'shape', label: O.tab, contextual: { set: O.set, color: SHAPE_COLOR }, hidden: !shp,
    groups: [
      {
        id: 'shape', label: O.shape, icon: 'shapes',
        controls: [
          { kind: 'menu', id: 'geometry', label: O.change, icon: 'shapes', size: 'large', items: geometries.map(([id, label]) => ({ id, label, checked: data?.geometry === id, onClick: () => update({ geometry: id }) })) },
          { kind: 'button', id: 'edittext', label: O.editText, icon: 'textbox', size: 'large', onClick: () => c.openDialog('shapeText') },
        ],
      },
      {
        id: 'style', label: O.style, icon: 'paint_bucket',
        controls: [
          { kind: 'color', id: 'fill', label: O.fill, icon: 'paint_bucket', size: 'large', value: data?.fill ? `#${data.fill}` : '#DAE9F7', emptyMode: 'none', onChange: (hex) => update({ fill: hex ? hex.slice(1).toUpperCase() : undefined }) },
          { kind: 'color', id: 'outline', label: O.outline, icon: 'edit', size: 'large', value: data?.line ? `#${data.line.color}` : '#156082', emptyMode: 'none', onChange: (hex) => update({ line: hex ? { color: hex.slice(1).toUpperCase(), width: data?.line?.width ?? 1 } : undefined }) },
          { kind: 'number', id: 'lineWidth', label: O.lineWidth, value: data?.line?.width ?? 0, min: 0, max: 20, step: 0.5, unit: 'pt', width: 70, onChange: (w) => update({ line: w > 0 ? { color: data?.line?.color ?? '156082', width: w } : undefined }) },
        ],
      },
      {
        id: 'arrange', label: O.arrange, icon: 'text_wrap',
        controls: [
          { kind: 'menu', id: 'wrap', label: T.cmd.wrapText, icon: 'text_wrap', size: 'large', items: IMAGE_WRAPS.map((m) => ({ id: m, label: WRAP_LABEL[m], checked: !!data && wrapOf(data) === m, onClick: () => data && update(wrapPatch(data, m)) })) },
          { kind: 'menu', id: 'position', label: T.cmd.position, icon: 'align_left', size: 'large', items: positions },
          { kind: 'toggle', id: 'selpane', label: O.selectionPane, icon: 'layer', pressed: c.ui.pane === 'selection', onToggle: (v) => c.setUi({ pane: v ? 'selection' : null }) },
          { kind: 'button', id: 'front', label: O.bringForward, icon: 'arrow_up', disabled: !data?.floating, onClick: () => z(1) },
          { kind: 'button', id: 'back', label: O.sendBackward, icon: 'arrow_down', disabled: !data?.floating, onClick: () => z(-1) },
          { kind: 'button', id: 'left', label: O.moveLeft, icon: 'arrow_left', disabled: !data?.floating, onClick: () => move(-6, 0) },
          { kind: 'button', id: 'right', label: O.moveRight, icon: 'arrow_right', disabled: !data?.floating, onClick: () => move(6, 0) },
          { kind: 'button', id: 'up', label: O.moveUp, icon: 'arrow_up', disabled: !data?.floating, onClick: () => move(0, -6) },
          { kind: 'button', id: 'down', label: O.moveDown, icon: 'arrow_down', disabled: !data?.floating, onClick: () => move(0, 6) },
        ],
      },
      {
        id: 'size', label: T.groups.size, icon: 'resize',
        controls: [
          { kind: 'number', id: 'angle', label: O.rotation, value: data?.rotation ?? 0, min: 0, max: 359, step: 15, unit: '°', width: 70, onChange: (v) => update({ rotation: (((Math.round(v) % 360) + 360) % 360) || undefined }) },
          { kind: 'number', id: 'h', label: T.cmd.height, value: ptToCm(data?.height ?? 0), min: 0.1, max: 55, step: 0.1, unit: 'cm', width: 70, onChange: (v) => update({ height: cmToPt(v) }) },
          { kind: 'number', id: 'w', label: T.cmd.width, value: ptToCm(data?.width ?? 0), min: 0.1, max: 55, step: 0.1, unit: 'cm', width: 70, onChange: (v) => update({ width: cmToPt(v) }) },
        ],
      },
    ],
  };
}
