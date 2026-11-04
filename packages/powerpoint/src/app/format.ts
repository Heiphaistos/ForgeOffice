// Mise en forme : caracteres et paragraphes (texte en edition ou formes selectionnees), remplissage, contour, effets.
import { resolveColor, type Color, type Effects, type Fill, type Line, type ParagraphProps, type RunProps, type Shape, type TableShape, type TextBody } from '@forgeoffice/pptx';
import { applyParagraphProps, applyRunProps, changeCase, commonRunProps, endPos, isCollapsed, wordAt, type CaseMode, type ParagraphPatch, type RunPatch, type TextRange } from '../canvas/text.ts';
import { locate } from '../canvas/ops.ts';
import type { Editor } from './editor.ts';

const fullRange = (body: TextBody): TextRange => ({ start: { p: 0, o: 0 }, end: endPos(body) });

/** Corps de texte vises : plage du texte en edition, ou tout le texte des formes / cellules selectionnees. */
function forEachTarget(shapes: Shape[], ed: Editor, visit: (body: TextBody, range: TextRange, isEditing: boolean) => void): void {
  const t = ed.selection.text;
  if (t) {
    const found = locate(shapes, t.shapeId);
    const shape = found?.shape;
    if (!shape) return;
    let body: TextBody | undefined;
    if (shape.kind === 'table' && t.cell) body = shape.table.rows[t.cell.row]?.cells[t.cell.col]?.text;
    else if (shape.kind === 'shape') body = shape.text ??= { props: {}, paragraphs: [] };
    if (!body) return;
    let range = t.range;
    if (isCollapsed(range)) {
      const word = wordAt(body, range.start);
      if (!isCollapsed(word)) range = word;
    }
    visit(body, range, true);
    return;
  }
  const cells = ed.selection.cells;
  for (const id of ed.selection.ids) {
    const shape = locate(shapes, id)?.shape;
    if (!shape) continue;
    if (shape.kind === 'shape') {
      shape.text ??= { props: {}, paragraphs: [{ props: {}, runs: [] }] };
      if (!shape.text.paragraphs.length) shape.text.paragraphs.push({ props: {}, runs: [] });
      visit(shape.text, fullRange(shape.text), false);
    } else if (shape.kind === 'table') {
      shape.table.rows.forEach((row, r) =>
        row.cells.forEach((cell, c) => {
          if (cells && cells.shapeId === id && (r < cells.r0 || r > cells.r1 || c < cells.c0 || c > cells.c1)) return;
          if (!cell.text.paragraphs.length) cell.text.paragraphs.push({ props: {}, runs: [] });
          visit(cell.text, fullRange(cell.text), false);
        }),
      );
    } else if (shape.kind === 'group') {
      const walk = (list: Shape[]): void => {
        for (const child of list) {
          if (child.kind === 'shape' && child.text) visit(child.text, fullRange(child.text), false);
          if (child.kind === 'group') walk(child.children);
        }
      };
      walk(shape.children);
    }
  }
}

/** Applique une mise en forme de caracteres. */
export function applyRun(ed: Editor, patch: RunPatch, group = 'format'): void {
  ed.editShapes((shapes) => forEachTarget(shapes, ed, (body, range) => applyRunProps(body, range, patch)), group);
}

export function applyParagraph(ed: Editor, patch: ParagraphPatch | ((props: ParagraphProps, index: number) => ParagraphProps), group = 'paragraph'): void {
  ed.editShapes((shapes) => forEachTarget(shapes, ed, (body, range) => applyParagraphProps(body, range, patch)), group);
}

export function applyCase(ed: Editor, mode: CaseMode): void {
  ed.editShapes((shapes) => forEachTarget(shapes, ed, (body, range) => changeCase(body, range, mode)), 'case');
}

/** Proprietes du corps de texte (ancrage, colonnes, orientation, ajustement). */
export function applyBody(ed: Editor, patch: Partial<TextBody['props']>): void {
  ed.editShapes((shapes) => {
    const ids = ed.selection.text ? [ed.selection.text.shapeId] : ed.selection.ids;
    for (const id of ids) {
      const shape = locate(shapes, id)?.shape;
      if (shape?.kind !== 'shape') continue;
      shape.text ??= { props: {}, paragraphs: [{ props: {}, runs: [] }] };
      shape.text.props = { ...shape.text.props, ...patch };
    }
  }, 'body');
}

/** Mise en forme courante (pour l'etat du ruban) d'apres les formes effectives. */
export function currentRun(ed: Editor): RunProps {
  const t = ed.selection.text;
  const id = t?.shapeId ?? ed.selection.ids[0];
  if (id === undefined) return {};
  const raw = locate(ed.pageShapes, id)?.shape;
  if (!raw) return {};
  const shape = ed.ctx.resolve(raw);
  let body: TextBody | undefined;
  if (shape.kind === 'shape') body = shape.text;
  else if (shape.kind === 'table') body = shape.table.rows[t?.cell?.row ?? 0]?.cells[t?.cell?.col ?? 0]?.text;
  if (!body || !body.paragraphs.length) return {};
  const range = t ? t.range : fullRange(body);
  return commonRunProps(body, range);
}

export function currentParagraph(ed: Editor): ParagraphProps {
  const t = ed.selection.text;
  const id = t?.shapeId ?? ed.selection.ids[0];
  if (id === undefined) return {};
  const raw = locate(ed.pageShapes, id)?.shape;
  if (!raw) return {};
  const shape = ed.ctx.resolve(raw);
  const body = shape.kind === 'shape' ? shape.text : undefined;
  return body?.paragraphs[t?.range.start.p ?? 0]?.props ?? {};
}

export function currentBody(ed: Editor): TextBody['props'] {
  const id = ed.selection.text?.shapeId ?? ed.selection.ids[0];
  const raw = id === undefined ? undefined : locate(ed.pageShapes, id)?.shape;
  const shape = raw && ed.ctx.resolve(raw);
  return shape?.kind === 'shape' ? (shape.text?.props ?? {}) : {};
}

// ---- Formes ----

export function setFill(ed: Editor, fill: Fill): void {
  ed.editSelected((shape) => {
    if (shape.kind === 'shape' || shape.kind === 'group') shape.fill = fill;
    if (shape.kind === 'table') {
      const cells = ed.selection.cells;
      shape.table.rows.forEach((row, r) =>
        row.cells.forEach((cell, c) => {
          if (!cells || (r >= cells.r0 && r <= cells.r1 && c >= cells.c0 && c <= cells.c1)) cell.fill = fill;
        }),
      );
    }
  }, 'fill');
}

export function setLine(ed: Editor, patch: Partial<Line> | null): void {
  ed.editSelected((shape) => {
    if (shape.kind !== 'shape' && shape.kind !== 'picture' && shape.kind !== 'connector' && shape.kind !== 'media') return;
    if (patch === null) shape.line = { fill: { type: 'none' } };
    else {
      const effective = ed.ctx.resolve(shape);
      const base = 'line' in effective ? (effective.line ?? {}) : {};
      shape.line = { ...base, ...(shape.line ?? {}), ...patch };
    }
  }, 'line');
}

export function setEffects(ed: Editor, patch: Partial<Effects> | null, clear?: keyof Effects): void {
  ed.editSelected((shape) => {
    if (!('effects' in shape) && shape.kind !== 'shape' && shape.kind !== 'picture') return;
    const target = shape as Shape & { effects?: Effects };
    if (patch === null) {
      target.effects = {};
      return;
    }
    const next: Effects = { ...(target.effects ?? {}), ...patch };
    if (clear) delete next[clear];
    target.effects = next;
  }, 'effects');
}

/** Remplissage effectif (couleur hexadecimale) de la premiere forme, pour les boutons du ruban. */
export function currentFillHex(ed: Editor): string | null {
  const raw = ed.selectedShapes[0];
  if (!raw) return null;
  const shape = ed.ctx.resolve(raw);
  return shape.kind === 'shape' && shape.fill?.type === 'solid' ? hexOf(ed, shape.fill.color) : null;
}

export function hexOf(ed: Editor, color: Color): string {
  return `#${resolveColor(color, ed.ctx.theme, ed.ctx.colorMap).hex}`;
}

/** Couleur saisie dans un selecteur (#RRGGBB) vers une couleur du modele (couleur du theme si elle correspond). */
export function colorFromHex(ed: Editor, hex: string): Color {
  const value = hex.replace('#', '').toUpperCase();
  const slots = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const;
  for (const slot of slots) {
    if (hexOf(ed, { type: 'scheme', value: slot }).replace('#', '').toUpperCase() === value) {
      const name = slot === 'lt1' ? 'bg1' : slot === 'dk1' ? 'tx1' : slot === 'lt2' ? 'bg2' : slot === 'dk2' ? 'tx2' : slot;
      return { type: 'scheme', value: name };
    }
  }
  return { type: 'rgb', value };
}

/** Table selectionnee (ou en edition). */
export function selectedTable(ed: Editor): TableShape | undefined {
  const id = ed.selection.text?.shapeId ?? ed.selection.ids[0];
  const shape = id === undefined ? undefined : locate(ed.pageShapes, id)?.shape;
  return shape?.kind === 'table' ? shape : undefined;
}
