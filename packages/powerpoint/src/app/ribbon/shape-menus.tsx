// Menus Contour et Effets d'une forme (Accueil > Dessin, Format de forme).
import type { MenuItem } from '@forgeoffice/ui';
import type { Color, Effects } from '@forgeoffice/pptx';
import { setEffects, setLine } from '../format.ts';
import type { Editor } from '../editor.ts';
import { themeSwatches } from '../themes.ts';
import { S } from '../../strings.ts';

const swatch = (hex: string) => <span style={{ width: 14, height: 14, background: hex, border: '1px solid rgba(0,0,0,.25)', display: 'inline-block' }} />;

const SLOTS = ['bg1', 'tx1', 'bg2', 'tx2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const;
const STANDARD = ['C00000', 'FF0000', 'FFC000', 'FFFF00', '92D050', '00B050', '00B0F0', '0070C0', '002060', '7030A0'];

/** Sous-menu de couleurs du theme et standard. */
export function colorItems(ed: Editor, pick: (color: Color) => void): MenuItem[] {
  const hexes = themeSwatches(ed.ctx.theme.colors);
  return [
    { id: 'ht', kind: 'header', label: S.drawing.themeColors },
    ...SLOTS.map((slot, i) => ({ id: slot, label: S.drawing.slotNames[slot], adornment: swatch(hexes[i] ?? '#000'), onClick: () => pick({ type: 'scheme', value: slot }) })),
    { id: 'hs', kind: 'header', label: S.drawing.standardColors },
    ...STANDARD.map((hex) => ({ id: hex, label: `#${hex}`, adornment: swatch(`#${hex}`), onClick: () => pick({ type: 'rgb', value: hex }) })),
  ];
}

export function outlineMenu(ed: Editor): MenuItem[] {
  const weights = [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6];
  const dashes: Array<[string, string]> = [['solid', S.drawing.dashSolid], ['sysDot', S.drawing.dashRoundDot], ['sysDash', S.drawing.dashSquareDot], ['dash', S.drawing.dashDash], ['dashDot', S.drawing.dashDashDot], ['lgDash', S.drawing.dashLong], ['lgDashDot', S.drawing.dashLongDot]];
  return [
    { id: 'colors', label: S.drawing.lineColor, icon: 'color_line', items: colorItems(ed, (color) => setLine(ed, { fill: { type: 'solid', color } })) },
    { id: 'none', label: S.drawing.noOutline, onClick: () => setLine(ed, null) },
    { id: 's', kind: 'separator' },
    { id: 'weight', label: S.drawing.weight, items: weights.map((w) => ({ id: String(w), label: `${String(w).replace('.', ',')} pt`, onClick: () => setLine(ed, { width: w }) })) },
    { id: 'dash', label: S.drawing.dashes, items: dashes.map(([id, label]) => ({ id, label, onClick: () => setLine(ed, { dash: id }) })) },
    {
      id: 'arrows', label: S.drawing.arrows,
      items: [
        { id: 'n', label: S.drawing.arrowNone, onClick: () => setLine(ed, { head: { type: 'none' }, tail: { type: 'none' } }) },
        { id: 'e', label: S.drawing.arrowEnd, onClick: () => setLine(ed, { head: { type: 'none' }, tail: { type: 'triangle' } }) },
        { id: 's', label: S.drawing.arrowStart, onClick: () => setLine(ed, { head: { type: 'triangle' }, tail: { type: 'none' } }) },
        { id: 'b', label: S.drawing.arrowBoth, onClick: () => setLine(ed, { head: { type: 'triangle' }, tail: { type: 'triangle' } }) },
        { id: 'o', label: S.drawing.arrowOval, onClick: () => setLine(ed, { head: { type: 'oval' }, tail: { type: 'stealth' } }) },
      ],
    },
  ];
}

const black = (alpha: number): Color => ({ type: 'rgb', value: '000000', mods: [{ name: 'alpha', val: alpha }] });

export function effectsMenu(ed: Editor): MenuItem[] {
  const shadow = (direction: number, distance: number, blur: number) => () => setEffects(ed, { outerShadow: { color: black(40000), blur, distance, direction } });
  const glow = (slot: 'accent1' | 'accent2' | 'accent3' | 'accent4' | 'accent5' | 'accent6', radius: number) => () =>
    setEffects(ed, { glow: { radius, color: { type: 'scheme', value: slot, mods: [{ name: 'alpha', val: 40000 }] } } });
  const reflection = (end: number, distance: number): Effects['reflection'] => ({ blur: 0.5, startAlpha: 50, startPosition: 0, endAlpha: 0.3, endPosition: end, distance, direction: 90, fadeDirection: 90, scaleX: 100, scaleY: -100, align: 'bl', rotateWithShape: false });
  return [
    {
      id: 'shadow', label: S.drawing.shadow, icon: 'square_multiple',
      items: [
        { id: 'none', label: S.drawing.noShadow, onClick: () => setEffects(ed, {}, 'outerShadow') },
        { id: 'br', label: S.drawing.shadowBR, onClick: shadow(45, 3, 4) },
        { id: 'b', label: S.drawing.shadowB, onClick: shadow(90, 3, 4) },
        { id: 'bl', label: S.drawing.shadowBL, onClick: shadow(135, 3, 4) },
        { id: 'c', label: S.drawing.shadowCenter, onClick: shadow(0, 0, 8) },
        { id: 'far', label: S.drawing.shadowFar, onClick: shadow(45, 8, 12) },
      ],
    },
    {
      id: 'reflection', label: S.drawing.reflection,
      items: [
        { id: 'none', label: S.drawing.noReflection, onClick: () => setEffects(ed, {}, 'reflection') },
        { id: 'tight', label: S.drawing.reflectionTight, onClick: () => setEffects(ed, { reflection: reflection(35, 0) }) },
        { id: 'half', label: S.drawing.reflectionHalf, onClick: () => setEffects(ed, { reflection: reflection(55, 2) }) },
        { id: 'full', label: S.drawing.reflectionFull, onClick: () => setEffects(ed, { reflection: reflection(90, 4) }) },
      ],
    },
    {
      id: 'glow', label: S.drawing.glow, icon: 'lightbulb',
      items: [
        { id: 'none', label: S.drawing.noGlow, onClick: () => setEffects(ed, {}, 'glow') },
        ...(['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const).flatMap((slot) => [
          { id: `${slot}5`, label: `${S.drawing.slotNames[slot]} - 5 pt`, onClick: glow(slot, 5) },
          { id: `${slot}11`, label: `${S.drawing.slotNames[slot]} - 11 pt`, onClick: glow(slot, 11) },
        ]),
      ],
    },
    {
      id: 'soft', label: S.drawing.softEdges,
      items: [0, 1, 2.5, 5, 10, 25].map((r) => ({ id: String(r), label: r ? `${String(r).replace('.', ',')} pt` : S.drawing.noSoftEdge, onClick: () => (r ? setEffects(ed, { softEdge: r }) : setEffects(ed, {}, 'softEdge')) })),
    },
    { id: 's', kind: 'separator' },
    { id: 'clear', label: S.drawing.noEffects, onClick: () => setEffects(ed, null) },
  ];
}
