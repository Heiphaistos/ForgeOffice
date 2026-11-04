// Briques partagees des onglets : contexte, apercu des formes, listes de formes predefinies, menus d'organisation.
import { memo } from 'react';
import type { MenuItem } from '@forgeoffice/ui';
import { buildGeometry, flipShapes, groupShapes, LINE_PRESETS, reorder, rotateShapes, ungroup } from '@forgeoffice/powerpoint/canvas';
import type { PubDocument } from '../../fopub.ts';
import { S } from '../../strings.ts';
import type { Editor } from '../editor.ts';
import { alignSelection } from '../ops.ts';

export interface AppActions {
  save: () => void;
  saveAs: () => void;
  backstage: (page: string) => void;
  newFrom: (doc: PubDocument) => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  copyFormat: () => void;
  painterActive: boolean;
  drawShape: (preset: string) => void;
  print: () => void;
}

export interface TabContext {
  ed: Editor;
  app: AppActions;
}

export const SHAPE_GROUPS: ReadonlyArray<{ id: keyof typeof S.shapesMenu; presets: readonly string[] }> = [
  { id: 'lines', presets: ['line', 'straightConnector1', 'bentConnector3', 'curvedConnector3'] },
  { id: 'basic', presets: ['rect', 'roundRect', 'ellipse', 'triangle', 'rtTriangle', 'parallelogram', 'trapezoid', 'diamond', 'pentagon', 'hexagon', 'octagon', 'plaque', 'can', 'cube', 'donut', 'heart', 'sun', 'moon', 'cloud', 'frame', 'halfFrame', 'teardrop', 'pie', 'chord', 'blockArc', 'smileyFace', 'foldedCorner', 'bevel'] },
  { id: 'arrows', presets: ['rightArrow', 'leftArrow', 'upArrow', 'downArrow', 'leftRightArrow', 'upDownArrow', 'quadArrow', 'bentArrow', 'uturnArrow', 'curvedRightArrow', 'chevron', 'homePlate', 'notchedRightArrow', 'stripedRightArrow'] },
  { id: 'stars', presets: ['star4', 'star5', 'star6', 'star8', 'star10', 'star12', 'star16', 'star24', 'irregularSeal1', 'irregularSeal2', 'ribbon2', 'ribbon', 'wave', 'doubleWave', 'horizontalScroll', 'verticalScroll'] },
  { id: 'callouts', presets: ['wedgeRectCallout', 'wedgeRoundRectCallout', 'wedgeEllipseCallout', 'cloudCallout', 'borderCallout1', 'accentCallout1'] },
];

/** Vignette d'une forme predefinie. */
export const ShapeIcon = memo(function ShapeIcon({ preset, size = 20 }: { preset: string; size?: number }) {
  const line = LINE_PRESETS.has(preset);
  const h = line ? size * 0.7 : size * 0.8;
  const geo = buildGeometry({ type: 'preset', preset: preset === 'line' ? 'line' : preset }, size - 2, h - 2);
  return (
    <svg width={size} height={size} viewBox={`-1 ${-(size - h) / 2 - 1} ${size} ${size}`} aria-hidden>
      {geo.paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill === 'none' || line ? 'none' : 'currentColor'} fillOpacity={0.12} stroke={p.stroke ? 'currentColor' : 'none'} strokeWidth={1} />
      ))}
    </svg>
  );
});

/** Menu « Formes » : groupes de formes predefinies (outil de trace). */
export function shapeMenu(app: AppActions): MenuItem[] {
  return SHAPE_GROUPS.flatMap((g) => [
    { id: `h-${g.id}`, kind: 'header' as const, label: S.shapesMenu[g.id] },
    ...g.presets.map((p) => ({ id: p, label: S.shapeNames[p] ?? p, adornment: <ShapeIcon preset={p} size={18} />, onClick: () => app.drawShape(p) })),
  ]);
}

/** Commandes d'organisation communes (Accueil, onglets contextuels). */
export function arrangeMenus(ed: Editor, toMargins: boolean) {
  const ids = ed.selection.ids;
  const none = !ids.length;
  const order = (move: 'front' | 'back' | 'forward' | 'backward') => () => ed.editShapes((s) => reorder(s, ids, move), 'order');
  const align: MenuItem[] = [
    { id: 'l', label: S.cmd.alignLeftObj, icon: 'align_left', onClick: () => alignSelection(ed, 'left', toMargins) },
    { id: 'c', label: S.cmd.alignCenterObj, icon: 'align_center_horizontal', onClick: () => alignSelection(ed, 'center', toMargins) },
    { id: 'r', label: S.cmd.alignRightObj, icon: 'align_right', onClick: () => alignSelection(ed, 'right', toMargins) },
    { id: 's1', kind: 'separator' },
    { id: 't', label: S.cmd.alignTopObj, icon: 'align_top', onClick: () => alignSelection(ed, 'top', toMargins) },
    { id: 'm', label: S.cmd.alignMiddleObj, icon: 'align_center_vertical', onClick: () => alignSelection(ed, 'middle', toMargins) },
    { id: 'b', label: S.cmd.alignBottomObj, icon: 'align_bottom', onClick: () => alignSelection(ed, 'bottom', toMargins) },
  ];
  const rotate: MenuItem[] = [
    { id: 'r', label: S.cmd.rotateRight, icon: 'rotate_right', onClick: () => ed.editShapes((s) => rotateShapes(s, ids, 90), 'rotate') },
    { id: 'l', label: S.cmd.rotateLeft, icon: 'rotate_left', onClick: () => ed.editShapes((s) => rotateShapes(s, ids, -90), 'rotate') },
    { id: 'h', label: S.cmd.flipH, icon: 'flip_horizontal', onClick: () => ed.editShapes((s) => flipShapes(s, ids, 'h'), 'flip') },
    { id: 'v', label: S.cmd.flipV, icon: 'flip_vertical', onClick: () => ed.editShapes((s) => flipShapes(s, ids, 'v'), 'flip') },
  ];
  const group = (): void => {
    let gid: number | null = null;
    ed.editShapes((s) => { gid = groupShapes(s, ids, 'Groupe'); }, 'group');
    if (gid !== null) ed.setSelection({ ids: [gid] });
  };
  const ungroupSel = (): void => {
    let kids: number[] = [];
    ed.editShapes((s) => { kids = ids.flatMap((id) => ungroup(s, id)); }, 'ungroup');
    ed.setSelection({ ids: kids });
  };
  return {
    front: { kind: 'split' as const, id: 'front', label: S.cmd.front, icon: 'position_forward' as const, disabled: none, onClick: order('forward'), items: [{ id: 'f', label: S.cmd.front, onClick: order('forward') }, { id: 'ff', label: S.cmd.toFront, onClick: order('front') }] },
    back: { kind: 'split' as const, id: 'back', label: S.cmd.back, icon: 'position_backward' as const, disabled: none, onClick: order('backward'), items: [{ id: 'b', label: S.cmd.back, onClick: order('backward') }, { id: 'bb', label: S.cmd.toBack, onClick: order('back') }] },
    group: { kind: 'split' as const, id: 'group', label: S.cmd.group, icon: 'group' as const, disabled: none, onClick: ids.length > 1 ? group : ungroupSel, items: [{ id: 'g', label: S.cmd.group, disabled: ids.length < 2, onClick: group }, { id: 'u', label: S.cmd.ungroup, onClick: ungroupSel }] },
    align: { kind: 'menu' as const, id: 'align', label: S.cmd.align, icon: 'align_left' as const, disabled: none, items: [...align, { id: 's2', kind: 'separator' as const }, { id: 'margins', label: S.cmd.relativeToMargins, checked: toMargins || ids.length === 1 }] },
    rotate: { kind: 'menu' as const, id: 'rotate', label: S.cmd.rotate, icon: 'rotate_right' as const, disabled: none, items: rotate },
  };
}
