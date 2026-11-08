// Commandes de l'application : mise en forme du texte et des formes, insertion, organisation, pages, liaisons.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icon, type IconName } from '@forgeoffice/ui';
import {
  addAutoShape, addMedia, addTable, resolveColor, type Color, type Connector, type Deck, type Effects, type Fill, type Line, type ParagraphProps, type RunProps, type Shape, type Slide, type TextBody, type Transform,
} from '@forgeoffice/pptx';
import {
  alignOffsets, applyParagraphProps, applyRunProps, boundsOf, changeCase, commonRunProps, endPos, isCollapsed, locate, pageBox, setPageBox, wordAt, xfrmOfBox,
  type AlignMode, type CaseMode, type CreateRequest, type ParagraphPatch, type RunPatch, type TextRange,
} from '@forgeoffice/powerpoint/canvas';
import { addText, MASTER_SHAPE_BASE, para, sc } from '../build.ts';
import { linkBoxes, unlinkAfter } from '../chain.ts';
import { marginBox } from '../guides.ts';
import { fieldToken } from '../merge.ts';
import { shapeKey, type BoxRef, type WrapMode } from '../model.ts';
import { deletePages, duplicatePage, insertPages, movePage, pastePage } from '../pubdeck.ts';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';

const fullRange = (body: TextBody): TextRange => ({ start: { p: 0, o: 0 }, end: endPos(body) });

/** Corps vises : plage en edition, sinon tout le texte des formes et cellules selectionnees. */
function forEachTarget(shapes: Shape[], ed: Editor, visit: (body: TextBody, range: TextRange) => void): void {
  const t = ed.selection.text;
  if (t) {
    const shape = locate(shapes, t.shapeId)?.shape;
    let body: TextBody | undefined;
    if (shape?.kind === 'table' && t.cell) body = shape.table.rows[t.cell.row]?.cells[t.cell.col]?.text;
    else if (shape?.kind === 'shape') body = shape.text ??= { props: {}, paragraphs: [] };
    if (!body) return;
    let range = t.range;
    if (isCollapsed(range)) {
      const word = wordAt(body, range.start);
      if (!isCollapsed(word)) range = word;
    }
    visit(body, range);
    return;
  }
  const walk = (list: Shape[], ids: readonly number[] | null): void => {
    for (const shape of list) {
      if (ids && !ids.includes(shape.id)) continue;
      if (shape.kind === 'shape') {
        shape.text ??= { props: {}, paragraphs: [{ props: {}, runs: [] }] };
        if (!shape.text.paragraphs.length) shape.text.paragraphs.push({ props: {}, runs: [] });
        visit(shape.text, fullRange(shape.text));
      } else if (shape.kind === 'table') {
        const cells = ed.selection.cells;
        shape.table.rows.forEach((row, r) => row.cells.forEach((cell, c) => {
          if (cells && cells.shapeId === shape.id && (r < cells.r0 || r > cells.r1 || c < cells.c0 || c > cells.c1)) return;
          if (!cell.text.paragraphs.length) cell.text.paragraphs.push({ props: {}, runs: [] });
          visit(cell.text, fullRange(cell.text));
        }));
      } else if (shape.kind === 'group') walk(shape.children, null);
    }
  };
  for (const id of ed.selection.ids) {
    const found = locate(shapes, id);
    if (found) walk([found.shape], null);
  }
}

export function applyRun(ed: Editor, patch: RunPatch, group = 'format'): void {
  ed.editShapes((shapes) => forEachTarget(shapes, ed, (body, range) => applyRunProps(body, range, patch)), group);
}

export function applyParagraph(ed: Editor, patch: ParagraphPatch | ((props: ParagraphProps, index: number) => ParagraphProps), group = 'paragraph'): void {
  ed.editShapes((shapes) => forEachTarget(shapes, ed, (body, range) => applyParagraphProps(body, range, patch)), group);
}

export function applyCase(ed: Editor, mode: CaseMode): void {
  ed.editShapes((shapes) => forEachTarget(shapes, ed, (body, range) => changeCase(body, range, mode)), 'case');
}

/** Proprietes de la zone de texte (ancrage, colonnes, marges, ajustement). */
export function applyBody(ed: Editor, patch: Partial<TextBody['props']>): void {
  const ids = ed.selection.text ? [ed.selection.text.shapeId] : ed.selection.ids;
  ed.editShapes((shapes) => {
    for (const id of ids) {
      const shape = locate(shapes, id)?.shape;
      if (shape?.kind !== 'shape') continue;
      shape.text ??= { props: {}, paragraphs: [{ props: {}, runs: [] }] };
      shape.text.props = { ...shape.text.props, ...patch };
    }
  }, 'body');
}

function targetBody(ed: Editor): { body: TextBody | undefined; range: TextRange | null } {
  const t = ed.selection.text;
  const id = t?.shapeId ?? ed.selection.ids[0];
  const raw = id === undefined ? undefined : locate(ed.pageShapes, id)?.shape;
  if (!raw) return { body: undefined, range: null };
  const shape = ed.ctx.resolve(raw);
  const body = shape.kind === 'shape' ? shape.text : shape.kind === 'table' ? shape.table.rows[t?.cell?.row ?? 0]?.cells[t?.cell?.col ?? 0]?.text : undefined;
  return { body, range: t ? t.range : body ? fullRange(body) : null };
}

export function currentRun(ed: Editor): RunProps {
  const { body, range } = targetBody(ed);
  return body?.paragraphs.length && range ? commonRunProps(body, range) : {};
}

export function currentParagraph(ed: Editor): ParagraphProps {
  const { body, range } = targetBody(ed);
  return body?.paragraphs[range?.start.p ?? 0]?.props ?? {};
}

export function currentBody(ed: Editor): TextBody['props'] {
  return targetBody(ed).body?.props ?? {};
}

// ---- Couleurs et formes ----

export const hexOf = (ed: Editor, color: Color): string => `#${resolveColor(color, ed.ctx.theme, ed.ctx.colorMap).hex}`;

/** Couleur choisie (#RRGGBB) vers le modele : couleur du theme si elle correspond (suit le modele de couleurs). */
export function colorFromHex(ed: Editor, hex: string): Color {
  const value = hex.replace('#', '').toUpperCase();
  const slots = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const;
  for (const slot of slots) {
    if (hexOf(ed, { type: 'scheme', value: slot }).slice(1).toUpperCase() === value) {
      return { type: 'scheme', value: slot === 'lt1' ? 'bg1' : slot === 'dk1' ? 'tx1' : slot === 'lt2' ? 'bg2' : slot === 'dk2' ? 'tx2' : slot };
    }
  }
  return { type: 'rgb', value };
}

/** Les 10 couleurs du modele de couleurs (selecteurs). */
export function themeSwatches(ed: Editor): string[] {
  return (['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const).map((v) => hexOf(ed, { type: 'scheme', value: v }));
}

export function setFill(ed: Editor, fill: Fill): void {
  ed.editSelected((shape) => {
    if (shape.kind === 'shape' || shape.kind === 'group') shape.fill = fill;
    if (shape.kind === 'table') {
      const cells = ed.selection.cells;
      shape.table.rows.forEach((row, r) => row.cells.forEach((cell, c) => {
        if (!cells || (r >= cells.r0 && r <= cells.r1 && c >= cells.c0 && c <= cells.c1)) cell.fill = fill;
      }));
    }
  }, 'fill');
}

export function setLine(ed: Editor, patch: Partial<Line> | null): void {
  ed.editSelected((shape) => {
    if (shape.kind !== 'shape' && shape.kind !== 'picture' && shape.kind !== 'connector') return;
    shape.line = patch === null ? { fill: { type: 'none' } } : { ...(shape.line ?? {}), ...patch };
  }, 'line');
}

export function setEffects(ed: Editor, effects: Effects | null): void {
  ed.editSelected((shape) => {
    if (shape.kind === 'shape' || shape.kind === 'picture' || shape.kind === 'connector') shape.effects = effects ?? {};
  }, 'effects');
}

// ---- Creation et insertion ----

const minId = (ed: Editor): number => (ed.ref.kind === 'master' ? MASTER_SHAPE_BASE : 2);

/** Forme tracee a la souris (zone de texte, forme, trait). */
export function createFromRequest(ed: Editor, request: CreateRequest): number | null {
  let id: number | null = null;
  ed.editShapes((shapes) => {
    if (request.kind === 'textbox') {
      const box = request.clicked || request.box.width < 8 ? { x: request.box.x, y: request.box.y, width: 180, height: 72 } : request.box;
      id = addText(shapes, [box.x, box.y, box.width, box.height], [para('', { size: 11, font: '+mn-lt' })], {}, { minId: minId(ed) }).id;
      return;
    }
    if (request.kind !== 'shape') return;
    const xfrm: Transform = xfrmOfBox(request.box.width < 2 && request.box.height < 2 ? { ...request.box, width: 72, height: 72 } : request.box);
    if (['line', 'straightConnector1', 'bentConnector3', 'curvedConnector3'].includes(request.preset)) {
      const cid = Math.max(minId(ed), ...shapes.map((s) => s.id + 1));
      const connector: Connector = {
        kind: 'connector', id: cid, name: `Connecteur ${cid - 1}`, xfrm,
        geometry: { type: 'preset', preset: request.preset === 'line' ? 'straightConnector1' : request.preset },
        line: { fill: { type: 'solid', color: sc('accent1') }, width: 1.5, ...(request.preset === 'straightConnector1' ? { tail: { type: 'triangle' as const } } : {}) },
      };
      if (request.start) connector.start = request.start;
      if (request.end) connector.end = request.end;
      shapes.push(connector);
      id = cid;
      return;
    }
    const shape = addAutoShape({ shapes } as Slide, request.preset, xfrm, 'Forme');
    if (ed.ref.kind === 'master' && shape.id < MASTER_SHAPE_BASE) shape.id = Math.max(MASTER_SHAPE_BASE, ...shapes.map((s) => s.id + 1));
    id = shape.id;
  }, 'insert');
  return id;
}

/** Zone libre d'insertion : dans les marges de la page, centree. */
function frameFor(ed: Editor, width: number, height: number): Transform {
  const area = marginBox(ed.deck.size, ed.pub, ed.pageIndex);
  const k = Math.min(1, (area.width * 0.8) / width, (area.height * 0.8) / height);
  const w = width * k;
  const h = height * k;
  return { x: area.x + (area.width - w) / 2, y: area.y + (area.height - h) / 2, width: w, height: h };
}

export function insertTextBox(ed: Editor, text = ''): number {
  const f = frameFor(ed, 260, 90);
  let id = 0;
  ed.editShapes((shapes) => {
    id = addText(shapes, [f.x, f.y, f.width, f.height], [para(text, { size: 11, font: '+mn-lt' })], {}, { minId: minId(ed) }).id;
  }, 'insert');
  ed.setSelection({ ids: [id], text: { shapeId: id, range: { start: { p: 0, o: text.length }, end: { p: 0, o: text.length } } } });
  return id;
}

const IMAGE_TYPES: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };
export const IMAGE_FILTERS = [{ name: 'Images', extensions: Object.keys(IMAGE_TYPES) }] as const;
const MAX_IMAGE = 256 * 1024 * 1024;

async function naturalSize(bytes: Uint8Array, type: string): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: (img.naturalWidth || 300) * 0.75, height: (img.naturalHeight || 200) * 0.75 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Insere une image ; si un cadre d'image (forme ou image) est selectionne, l'image le remplace en gardant sa place. */
export async function insertPictureBytes(ed: Editor, bytes: Uint8Array, name: string, svg?: Uint8Array): Promise<void> {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const type = IMAGE_TYPES[ext];
  if (!type || bytes.length > MAX_IMAGE) {
    ed.notify(S.insert.badImage(name), 'error');
    return;
  }
  const natural = await naturalSize(bytes, type);
  const sel = ed.selectedShapes[0];
  const replace = sel && sel.xfrm && (sel.kind === 'picture' || (sel.kind === 'shape' && !sel.textBox)) ? sel : undefined;
  let xfrm = frameFor(ed, natural.width, natural.height);
  let crop: { left: number; top: number; right: number; bottom: number } | undefined;
  if (replace?.xfrm) {
    // Remplissage du cadre en gardant les proportions (recadrage centre), comme « Changer l'image » de Publisher.
    xfrm = { ...replace.xfrm };
    const frameRatio = xfrm.width / xfrm.height;
    const imgRatio = natural.width / natural.height;
    const cut = imgRatio > frameRatio ? ((1 - frameRatio / imgRatio) / 2) * 100 : ((1 - imgRatio / frameRatio) / 2) * 100;
    crop = imgRatio > frameRatio ? { left: cut, right: cut, top: 0, bottom: 0 } : { left: 0, right: 0, top: cut, bottom: cut };
  }
  const deck: Deck = { ...ed.deck, media: { ...ed.deck.media } };
  const mediaId = addMedia(deck, bytes, ext === 'jpg' ? 'jpeg' : ext, type);
  const svgId = svg ? addMedia(deck, svg, 'svg', 'image/svg+xml') : undefined;
  let id = 0;
  const pageRef = ed.ref;
  ed.commit({ deck, pub: ed.pub });
  ed.editShapes((shapes) => {
    id = Math.max(minId(ed), ...shapes.map((s) => s.id + 1));
    const pic: Shape = { kind: 'picture', id, name: `Image ${id - 1}`, description: name.replace(/\.[^.]+$/, ''), mediaId, fillMode: 'stretch', geometry: { type: 'preset', preset: 'rect' }, xfrm, locks: { noChangeAspect: true }, ...(crop ? { crop } : {}), ...(svgId ? { svgMediaId: svgId } : {}) };
    const at = replace ? shapes.findIndex((s) => s.id === replace.id) : -1;
    if (at >= 0) shapes.splice(at, 1, pic);
    else shapes.push(pic);
  }, 'insert', pageRef);
  ed.setSelection({ ids: [id] });
}

export async function insertPicture(ed: Editor): Promise<void> {
  const file = await ed.services.openFile(IMAGE_FILTERS);
  if (file) await insertPictureBytes(ed, file.bytes, file.name);
}

async function svgToPng(svg: string, size: number): Promise<Uint8Array> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')?.drawImage(img, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Icone Fluent inseree en image vectorielle (SVG + repli PNG), couleur d'accentuation du modele. */
export async function insertIcon(ed: Editor, name: IconName): Promise<void> {
  const color = hexOf(ed, { type: 'scheme', value: 'accent1' });
  const markup = renderToStaticMarkup(createElement(Icon, { name, size: 96, color, filled: true }))
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/ aria-hidden="true"| focusable="false"| class="[^"]*"| style="[^"]*"/g, '');
  const png = await svgToPng(markup, 256);
  const keep = ed.selection;
  ed.setSelection({ ids: [] });
  await insertPictureBytes(ed, png, `${S.insert.iconName} ${name.replace(/_/g, ' ')}.png`, new TextEncoder().encode(markup));
  if (keep.ids.length && !ed.selection.ids.length) ed.setSelection(keep);
}

export function insertTable(ed: Editor, rows: number, cols: number): void {
  const f = frameFor(ed, cols * 90, rows * 24);
  let id = 0;
  ed.editShapes((shapes) => {
    const t = addTable({ shapes } as Slide, Math.max(1, Math.min(rows, 60)), Math.max(1, Math.min(cols, 30)), f);
    id = t.id;
  }, 'insert');
  ed.setSelection({ ids: [id] });
}

/** Styles WordArt (galerie Insertion). */
export const WORDART: ReadonlyArray<{ id: string; props: RunProps }> = [
  { id: 'plain', props: { color: sc('tx2') } },
  { id: 'accent', props: { color: sc('accent1'), effects: { outerShadow: { color: { type: 'rgb', value: '000000', mods: [{ name: 'alpha', val: 35000 }] }, blur: 3, distance: 2, direction: 45 } } } },
  { id: 'gradient', props: { textFill: { type: 'gradient', kind: 'linear', angle: 90, stops: [{ position: 0, color: sc('accent2') }, { position: 100, color: sc('accent1') }] } } },
  { id: 'outline', props: { textFill: { type: 'solid', color: sc('bg1') }, outline: { width: 1.25, fill: { type: 'solid', color: sc('accent1') } } } },
  { id: 'glow', props: { color: sc('accent2'), effects: { glow: { radius: 8, color: sc('accent2', [{ name: 'alpha', val: 40000 }]) } } } },
  { id: 'arch', props: { color: sc('accent1'), bold: true } },
];

export function insertWordArt(ed: Editor, styleId: string): void {
  const style = WORDART.find((w) => w.id === styleId) ?? WORDART[0];
  const f = frameFor(ed, 420, 90);
  let id = 0;
  ed.editShapes((shapes) => {
    const box = addText(shapes, [f.x, f.y, f.width, f.height], [para(S.insert.wordArt, { size: 48, bold: true, font: '+mj-lt', ...(style?.props ?? {}) }, { align: 'ctr' })], {}, { anchor: 'ctr', minId: minId(ed) });
    if (styleId === 'arch' && box.text) box.text.props = { ...box.text.props, warp: { preset: 'textArchUp' } };
    id = box.id;
  }, 'insert');
  ed.setSelection({ ids: [id] });
}

/** Champ de fusion « Nom » insere au curseur (ou nouvelle zone de texte). */
export function insertMergeField(ed: Editor, field: string): void {
  insertTextAtCaret(ed, fieldToken(field));
}

export function insertTextAtCaret(ed: Editor, text: string): void {
  const t = ed.selection.text;
  if (!t) {
    insertTextBox(ed, text);
    return;
  }
  let at = t.range.end;
  ed.editShapes((shapes) => {
    const shape = locate(shapes, t.shapeId)?.shape;
    if (shape?.kind !== 'shape') return;
    const body = (shape.text ??= { props: {}, paragraphs: [{ props: {}, runs: [] }] });
    const p = body.paragraphs[t.range.end.p];
    if (!p) return;
    let offset = 0;
    let inserted = false;
    for (let i = 0; i < p.runs.length && !inserted; i++) {
      const run = p.runs[i];
      if (!run) continue;
      const len = run.type === 'break' ? 1 : run.text.length;
      if (run.type === 'text' && t.range.end.o <= offset + len) {
        const o = t.range.end.o - offset;
        run.text = run.text.slice(0, o) + text + run.text.slice(o);
        inserted = true;
      }
      offset += len;
    }
    if (!inserted) p.runs.push({ type: 'text', text, props: { ...(p.runs[p.runs.length - 1]?.props ?? p.endProps ?? {}) } });
    at = { p: t.range.end.p, o: t.range.end.o + text.length };
  }, 'typing');
  ed.setSelection({ ...ed.selection, text: { ...t, range: { start: at, end: at } } });
}

// ---- Organisation ----

/** Aligne la selection : entre objets, ou par rapport aux reperes de marge (objet seul ou option cochee). */
export function alignSelection(ed: Editor, mode: AlignMode, toMargins: boolean): void {
  const ids = ed.selection.ids;
  ed.editShapes((shapes) => {
    const items = ids.map((id) => locate(shapes, id)).filter((f): f is NonNullable<typeof f> => !!f);
    const boxes = items.map((f) => pageBox(f)).filter((b): b is NonNullable<typeof b> => !!b);
    if (!boxes.length) return;
    const rects = boxes.map(boundsOf);
    const reference = toMargins || rects.length === 1
      ? marginBox(ed.deck.size, ed.pub, ed.pageIndex)
      : rects.reduce((a, r) => ({ x: Math.min(a.x, r.x), y: Math.min(a.y, r.y), width: Math.max(a.x + a.width, r.x + r.width) - Math.min(a.x, r.x), height: Math.max(a.y + a.height, r.y + r.height) - Math.min(a.y, r.y) }));
    const offsets = alignOffsets(rects, mode, reference);
    items.forEach((f, i) => {
      const b = boxes[i];
      const d = offsets[i];
      if (b && d) setPageBox(f, { ...b, x: b.x + d.x, y: b.y + d.y });
    });
  }, 'align');
}

// ---- Habillage, lettrine, liaison ----

export function setWrap(ed: Editor, mode: WrapMode): void {
  if (ed.ref.kind !== 'page') return;
  const page = ed.ref.id;
  const wraps = { ...ed.pub.wraps };
  for (const id of ed.selection.ids) wraps[shapeKey(page, id)] = mode;
  ed.commitPub({ ...ed.pub, wraps }, 'wrap');
}

export function setDropCap(ed: Editor, lines: number | null): void {
  if (ed.ref.kind !== 'page') return;
  const page = ed.ref.id;
  const dropCaps = { ...ed.pub.dropCaps };
  const ids = ed.selection.text ? [ed.selection.text.shapeId] : ed.selection.ids;
  for (const id of ids) {
    if (lines) dropCaps[shapeKey(page, id)] = lines;
    else delete dropCaps[shapeKey(page, id)];
  }
  ed.commitPub({ ...ed.pub, dropCaps }, 'dropcap');
}

/** Zone de texte selectionnee (reference page:forme). */
export function selectedBox(ed: Editor): BoxRef | null {
  const id = ed.selection.text?.shapeId ?? ed.selection.ids[0];
  const shape = id === undefined ? undefined : ed.pageShapes.find((s) => s.id === id);
  return ed.ref.kind === 'page' && shape?.kind === 'shape' && shape.text ? { page: ed.ref.id, shape: shape.id } : null;
}

export function finishLink(ed: Editor, to: BoxRef): void {
  const from = ed.ui.linking;
  ed.setUi({ linking: null });
  if (!from) return;
  const result = linkBoxes(ed.deck, ed.pub, from, to);
  if (typeof result === 'string') {
    ed.notify(S.link[result as keyof typeof S.link] as string, 'warning');
    return;
  }
  // La zone de destination ne deborde jamais visiblement et ne s'agrandit pas.
  const deck = { ...ed.deck, slides: ed.deck.slides.map((s) => (s.id !== to.page && s.id !== from.page ? s : { ...s, shapes: s.shapes.map((sh) => ((s.id === to.page && sh.id === to.shape) || (s.id === from.page && sh.id === from.shape)) && sh.kind === 'shape' && sh.text ? { ...sh, text: { ...sh.text, props: { ...sh.text.props, autofit: { type: 'none' as const }, vertOverflow: 'clip' as const } } } : sh) })) };
  ed.commit({ deck, pub: result }, 'link');
  ed.notify(S.link.done, 'success');
}

export function breakLink(ed: Editor): void {
  const box = selectedBox(ed);
  if (!box) return;
  ed.commit(unlinkAfter(ed.deck, ed.pub, box), 'unlink');
}

// ---- Pages ----

export function addPages(ed: Editor, count: number, before = false, at = ed.pageIndex): void {
  const deck = structuredClone(ed.deck);
  const created = insertPages(deck, at - (before ? 1 : 0), count);
  ed.commitDeck(deck);
  const first = created[0];
  if (first) ed.goto(deck.slides.indexOf(deck.slides.find((s) => s.id === first.id) as Slide));
}

export function duplicateCurrentPage(ed: Editor, pageId = ed.page?.id): void {
  if (pageId === undefined) return;
  const deck = structuredClone(ed.deck);
  const copy = duplicatePage(deck, pageId);
  ed.commitDeck(deck);
  if (copy) ed.goto(deck.slides.findIndex((s) => s.id === copy.id));
}

export function deleteCurrentPage(ed: Editor, ids?: readonly number[]): void {
  const targets = ids ?? (ed.page ? [ed.page.id] : []);
  if (targets.length >= ed.deck.slides.length) {
    ed.notify(S.app.lastPage, 'warning');
    return;
  }
  const deck = structuredClone(ed.deck);
  deletePages(deck, targets);
  const pub = { ...ed.pub, chains: ed.pub.chains.map((c) => ({ ...c, boxes: c.boxes.filter((b) => !targets.includes(b.page)) })) };
  const index = ed.pageIndex;
  ed.commit({ deck, pub });
  ed.goto(Math.min(index, deck.slides.length - 1));
}

export function movePageTo(ed: Editor, pageId: number, toIndex: number): void {
  const deck = structuredClone(ed.deck);
  movePage(deck, pageId, toIndex);
  ed.commitDeck(deck, 'move');
  ed.goto(deck.slides.findIndex((s) => s.id === pageId));
}

/** Presse-papiers des pages (meme fenetre) : couper / copier / coller une page depuis le volet ou le menu. */
let pageClipboard: Slide | null = null;
export const hasPageClip = (): boolean => pageClipboard !== null;

export function copyPage(ed: Editor, pageId: number, cut: boolean): void {
  const slide = ed.deck.slides.find((s) => s.id === pageId);
  if (!slide) return;
  pageClipboard = structuredClone(slide);
  if (cut) deleteCurrentPage(ed, [pageId]);
}

export function pastePageAfter(ed: Editor, index: number): void {
  if (!pageClipboard) return;
  const deck = structuredClone(ed.deck);
  const copy = pastePage(deck, pageClipboard, index);
  ed.commitDeck(deck);
  ed.goto(deck.slides.findIndex((s) => s.id === copy.id));
}

/** Mise en forme memorisee (reproduire la mise en forme, Ctrl+Maj+C / Ctrl+Maj+V). */
export interface FormatClip { run: ReturnType<typeof currentRun>; shape: Shape | undefined }

export const captureFormat = (ed: Editor): FormatClip => ({ run: currentRun(ed), shape: ed.selectedShapes[0] });

export function applyFormatClip(ed: Editor, clip: FormatClip): void {
  applyRun(ed, { ...clip.run });
  const src = clip.shape;
  if (src?.kind !== 'shape') return;
  ed.editSelected((s) => {
    if (s.kind !== 'shape') return;
    if (src.fill) s.fill = structuredClone(src.fill);
    if (src.line) s.line = structuredClone(src.line);
  }, 'painter');
}
