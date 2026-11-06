// Menus contextuels du module PDF (clic droit) : texte selectionne, annotation, champ de formulaire, fond de page.
// Fonctions pures (testees) : elles recoivent le contexte du clic et les actions de l'application, et renvoient les elements de menu.
import type { MenuItem } from '@forgeoffice/ui';
import { INK_COLORS, MARK_COLORS, restyle, type Item, type MarkKind, type Point, type Rect } from './model.ts';
import { S } from './strings.ts';

/** Ce qui se trouve sous le pointeur au moment du clic droit. */
export interface MenuContext {
  page: number;
  /** Position dans le repere de la page. */
  point: Point;
  item: Item | null;
  field: { name: string; type: 'texte' | 'case' | 'radio' | 'liste' | 'signature' | 'autre'; signed: boolean; rect: Rect } | null;
  selection: string;
  /** Rectangles du texte selectionne sur cette page (repere de la page). */
  selectionRects: readonly Rect[];
}

/** Actions que l'application met a disposition des menus. */
export interface MenuActions {
  editable: boolean;
  copy(text: string): void;
  addMarkup(kind: MarkKind, rects: readonly Rect[], text: string): void;
  addNote(page: number, at: Point): void;
  addFreeText(page: number, at: Point): void;
  search(text: string): void;
  speak(text: string): void;
  changeItem(item: Item): void;
  removeItem(id: string): void;
  editText(id: string): void;
  rotatePage(page: number, dir: 1 | -1): void;
  insertBlank(page: number): void;
  deletePage(page: number): void;
  extractPage(page: number): void;
  pageCount: number;
  fit(kind: 'width' | 'page'): void;
  properties(): void;
  clearField(name: string): void;
  resetForm(): void;
  signField(page: number, rect: Rect): void;
  hasFormValues: boolean;
  applyRedactions(): void;
}

const sep = (id: string): MenuItem => ({ id, kind: 'separator' });

/** Menu d'une annotation ou d'un element ajoute. */
function itemMenu(item: Item, a: MenuActions): MenuItem[] {
  const out: MenuItem[] = [];
  const text = 'text' in item ? item.text : '';
  if (item.kind === 'note' || item.kind === 'freetext') out.push({ id: 'edit', label: S.menus.editText, icon: 'edit', disabled: !a.editable, onClick: () => a.editText(item.id) });
  if (text) out.push({ id: 'copy', label: S.menus.copyText, icon: 'copy', onClick: () => a.copy(text) });
  if (restyle(item, { color: '#000000' })) {
    const colors = item.kind === 'mark' ? MARK_COLORS : INK_COLORS;
    out.push({
      id: 'color', label: S.floating.color, icon: 'color', disabled: !a.editable,
      items: colors.map((c) => ({ id: c, label: c.toUpperCase(), onClick: () => { const next = restyle(item, { color: c }); if (next) a.changeItem(next); } })),
    });
  }
  if (item.kind === 'shape' || item.kind === 'ink') {
    out.push({ id: 'width', label: S.thickness, disabled: !a.editable, items: [1, 2, 4, 6, 10].map((w) => ({ id: `w${w}`, label: `${w} pt`, checked: item.width === w, onClick: () => { const next = restyle(item, { width: w }); if (next) a.changeItem(next); } })) });
  }
  if (item.kind === 'freetext') {
    out.push({ id: 'size', label: S.fontSize, disabled: !a.editable, items: [10, 12, 14, 18, 24, 36].map((n) => ({ id: `s${n}`, label: `${n} pt`, checked: item.size === n, onClick: () => { const next = restyle(item, { size: n }); if (next) a.changeItem(next); } })) });
  }
  if (item.kind === 'redact') out.push({ id: 'apply', label: S.applyRedactions, icon: 'checkmark', disabled: !a.editable, onClick: a.applyRedactions });
  if (out.length > 0) out.push(sep('s1'));
  out.push({ id: 'delete', label: S.floating.delete, icon: 'delete', shortcut: 'Suppr', disabled: !a.editable, onClick: () => a.removeItem(item.id) });
  return out;
}

/** Menu d'un champ de formulaire. */
function fieldMenu(ctx: MenuContext, a: MenuActions): MenuItem[] {
  const f = ctx.field;
  if (!f) return [];
  const out: MenuItem[] = [];
  if (f.type === 'signature') out.push({ id: 'sign', label: S.sign.signField, icon: 'signature', disabled: f.signed || !a.editable, onClick: () => a.signField(ctx.page, f.rect) });
  else out.push({ id: 'clear', label: S.menus.clearField, icon: 'eraser', disabled: !a.editable, onClick: () => a.clearField(f.name) });
  out.push({ id: 'reset', label: S.menus.resetForm, icon: 'arrow_counterclockwise', disabled: !a.editable || !a.hasFormValues, onClick: a.resetForm });
  if (ctx.selection) out.push(sep('s1'), { id: 'copy', label: S.menus.copyText, icon: 'copy', onClick: () => a.copy(ctx.selection) });
  return out;
}

/** Menu du texte selectionne. */
function selectionMenu(ctx: MenuContext, a: MenuActions): MenuItem[] {
  const text = ctx.selection.trim();
  const mark = (kind: MarkKind, label: string, icon: MenuItem['icon']): MenuItem => ({ id: kind, label, icon, disabled: !a.editable || ctx.selectionRects.length === 0, onClick: () => a.addMarkup(kind, ctx.selectionRects, text) });
  return [
    { id: 'copy', label: S.menus.copyText, icon: 'copy', shortcut: 'Ctrl+C', onClick: () => a.copy(text) },
    sep('s1'),
    mark('highlight', S.tools.highlight, 'highlight'),
    mark('underline', S.tools.underline, 'text_underline'),
    mark('strike', S.tools.strike, 'text_strikethrough'),
    sep('s2'),
    { id: 'search', label: S.menus.searchSelection(text.length > 24 ? `${text.slice(0, 24)}…` : text), icon: 'search', onClick: () => a.search(text) },
    { id: 'speak', label: S.menus.readSelection, icon: 'speaker_2', onClick: () => a.speak(text) },
  ];
}

/** Menu du fond de la page. */
function pageMenu(ctx: MenuContext, a: MenuActions): MenuItem[] {
  return [
    { id: 'note', label: S.menus.noteHere, icon: 'note', disabled: !a.editable, onClick: () => a.addNote(ctx.page, ctx.point) },
    { id: 'free', label: S.menus.textHere, icon: 'textbox', disabled: !a.editable, onClick: () => a.addFreeText(ctx.page, ctx.point) },
    sep('s1'),
    { id: 'rl', label: S.rotateLeft, icon: 'arrow_counterclockwise', disabled: !a.editable, onClick: () => a.rotatePage(ctx.page, -1) },
    { id: 'rr', label: S.rotateRight, icon: 'arrow_clockwise', disabled: !a.editable, onClick: () => a.rotatePage(ctx.page, 1) },
    { id: 'blank', label: S.menus.blankAfter, icon: 'document_one_page_add', disabled: !a.editable, onClick: () => a.insertBlank(ctx.page) },
    { id: 'extract', label: S.menus.extractThis, icon: 'document_arrow_up', onClick: () => a.extractPage(ctx.page) },
    { id: 'del', label: S.menus.deleteThis, icon: 'delete', disabled: !a.editable || a.pageCount <= 1, onClick: () => a.deletePage(ctx.page) },
    sep('s2'),
    { id: 'fw', label: S.fitWidth, icon: 'arrow_fit', onClick: () => a.fit('width') },
    { id: 'fp', label: S.fitPage, icon: 'page_fit', onClick: () => a.fit('page') },
    { id: 'props', label: S.metadata, icon: 'info', disabled: !a.editable, onClick: a.properties },
  ];
}

/** Menu a afficher pour ce clic droit (priorite : champ, annotation, texte selectionne, fond de page). */
export function buildContextMenu(ctx: MenuContext, a: MenuActions): MenuItem[] {
  if (ctx.field) return fieldMenu(ctx, a);
  if (ctx.item) return itemMenu(ctx.item, a);
  if (ctx.selection.trim() !== '') return selectionMenu(ctx, a);
  return pageMenu(ctx, a);
}
