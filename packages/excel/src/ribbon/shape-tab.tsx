// Onglet contextuel « Format de forme » : remplissage, contour, epaisseur, couleur du texte, taille, rotation.
import type { RibbonTab, MenuItem } from '@forgeoffice/ui';
import type { ShapeObject } from '@forgeoffice/xlsx';
import { SHAPE_COLORS, SHAPE_WEIGHTS } from '../logic/shapes.ts';
import { RB, S } from '../strings/index.ts';
import type { RibbonEnv } from './env.ts';

const ACCENT = '#107C41';
const swatch = (c: string) => <span className="xl-barprev" style={{ background: `#${c}`, width: 16, height: 16, border: '1px solid #bbb' }} />;

const colorItems = (current: string | undefined, none: string, onPick: (c: string | null) => void): MenuItem[] => [
  { id: 'none', label: none, onClick: () => onPick(null) },
  ...SHAPE_COLORS.map((c) => ({ id: c, label: `#${c}`, checked: current === c, adornment: swatch(c), onClick: () => onPick(c) })),
];

export function shapeTab(e: RibbonEnv): RibbonTab | null {
  const sh: ShapeObject | undefined = e.shapeObj;
  if (!sh) return null;
  return {
    id: 'shapeFormat', label: RB.tabs.shape, contextual: { set: RB.sets.shape, color: ACCENT },
    groups: [
      { id: 'styles', label: S.shapeFmt.styles, icon: 'color', controls: [
        { kind: 'menu', id: 'fill', label: S.shapeFmt.fill, icon: 'color_fill', size: 'large', items: colorItems(sh.fill?.color, S.shapeFmt.noFill, (c) => e.shapeEdit({ fill: c === null ? { none: true } : { color: c } })) },
        { kind: 'menu', id: 'line', label: S.shapeFmt.outline, icon: 'color_line', size: 'large', items: colorItems(sh.line?.color, S.shapeFmt.noOutline, (c) => e.shapeEdit({ line: c === null ? { ...sh.line, none: true } : { ...sh.line, color: c, none: false } })) },
        { kind: 'menu', id: 'weight', label: S.shapeFmt.weight, icon: 'color_line', items: SHAPE_WEIGHTS.map((w) => ({ id: String(w), label: `${w} pt`.replace('.', ','), checked: (sh.line?.width ?? 1) === w, onClick: () => e.shapeEdit({ line: { ...sh.line, width: w, none: false } }) })) },
      ] },
      { id: 'text', label: S.shapeFmt.text, icon: 'text_t', controls: [
        { kind: 'menu', id: 'textColor', label: S.shapeFmt.textColor, icon: 'text_color', items: colorItems(sh.textColor, S.shapeFmt.automatic, (c) => e.shapeEdit({ textColor: c ?? '000000' })) },
        { kind: 'number', id: 'fontSize', label: S.shapeFmt.fontSize, value: sh.fontSize ?? 11, min: 6, max: 96, step: 1, width: 56, onChange: (v) => e.shapeEdit({ fontSize: v }) },
      ] },
      { id: 'arrange', label: S.shapeFmt.arrange, icon: 'rotate_right', controls: [
        { kind: 'button', id: 'rotR', label: S.shapeFmt.rotateRight, icon: 'rotate_right', onClick: () => e.shapeEdit({ rotation: ((sh.rotation ?? 0) + 90) % 360 }) },
        { kind: 'button', id: 'rotL', label: S.shapeFmt.rotateLeft, icon: 'rotate_left', onClick: () => e.shapeEdit({ rotation: ((sh.rotation ?? 0) + 270) % 360 }) },
      ] },
    ],
  };
}
