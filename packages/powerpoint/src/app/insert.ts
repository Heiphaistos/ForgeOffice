// Commandes d'insertion : images, icones, tableaux, graphiques, WordArt, medias, champs, liens.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icon, type IconName } from '@forgeoffice/ui';
import {
  addChart, addMedia, addPicture, addTable, addTextBox, nextShapeId,
  type ChartType, type Deck, type MediaShape, type Picture, type RunProps, type Shape, type Slide, type Transform,
} from '@forgeoffice/pptx';
import { locate } from '../canvas/ops.ts';
import { insertText, orderRange, deleteRange } from '../canvas/text.ts';
import { editPage } from './deck-ops.ts';
import type { Editor } from './editor.ts';
import { applyRun } from './format.ts';
import { S } from '../strings.ts';

export const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] }] as const;
export const VIDEO_FILTERS = [{ name: 'Vidéos', extensions: ['mp4', 'webm', 'm4v', 'mov'] }] as const;
export const AUDIO_FILTERS = [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }] as const;
const MAX_MEDIA = 512 * 1024 * 1024;

const EXT_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
};

export const extensionOf = (name: string): string => name.slice(name.lastIndexOf('.') + 1).toLowerCase();

/** Zone libre ou espace reserve vide selectionne ou se placera un contenu. */
function targetFrame(ed: Editor, width: number, height: number): { xfrm: Transform; replace?: number } {
  const page = ed.deck.size;
  const sel = ed.selectedShapes[0];
  if (sel && sel.placeholder && sel.kind === 'shape' && !sel.text?.paragraphs.some((p) => p.runs.length)) {
    const eff = ed.ctx.resolve(sel);
    if (eff.xfrm) {
      const k = Math.min(eff.xfrm.width / width, eff.xfrm.height / height);
      const w = width * k;
      const h = height * k;
      return { xfrm: { x: eff.xfrm.x + (eff.xfrm.width - w) / 2, y: eff.xfrm.y + (eff.xfrm.height - h) / 2, width: w, height: h }, replace: sel.id };
    }
  }
  const k = Math.min(1, (page.width * 0.8) / width, (page.height * 0.8) / height);
  const w = width * k;
  const h = height * k;
  return { xfrm: { x: (page.width - w) / 2, y: (page.height - h) / 2, width: w, height: h } };
}

/** Taille naturelle d'une image (en points, 96 ppp). */
async function imageSize(bytes: Uint8Array, type: string): Promise<{ width: number; height: number }> {
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

/** Ajoute une forme a la page courante en remplacant l'espace reserve vise. */
function placeShape(ed: Editor, build: (holder: Slide, deck: Deck) => Shape, replace?: number): void {
  let id = 0;
  const deck = { ...ed.deck, media: { ...ed.deck.media } };
  const next = editPage(deck, ed.page, (shapes) => {
    const holder = { shapes } as Slide;
    const shape = build(holder, deck);
    id = shape.id;
    if (replace !== undefined) {
      const old = locate(shapes, replace);
      if (old) {
        if (old.shape.placeholder) shape.placeholder = { ...old.shape.placeholder, type: shape.kind === 'picture' ? 'pic' : old.shape.placeholder.type };
        shapes.splice(shapes.indexOf(shape), 1);
        old.list.splice(old.index, 1, shape);
      }
    }
  });
  ed.commit({ ...next, media: deck.media }, 'insert');
  ed.setSelection({ ids: [id], text: null });
}

export async function insertPictureBytes(ed: Editor, bytes: Uint8Array, name: string): Promise<void> {
  const ext = extensionOf(name);
  const type = EXT_TYPES[ext];
  if (!type?.startsWith('image/') || bytes.length > MAX_MEDIA) {
    ed.notify(S.insert.badImage(name), 'error');
    return;
  }
  const size = await imageSize(bytes, type);
  const frame = targetFrame(ed, size.width, size.height);
  placeShape(ed, (holder, deck) => addPicture(deck, holder, bytes, ext === 'jpg' ? 'jpeg' : ext, frame.xfrm, name.replace(/\.[^.]+$/, '')), frame.replace);
}

export async function insertPicture(ed: Editor): Promise<void> {
  const file = await ed.services.openFile(IMAGE_FILTERS);
  if (file) await insertPictureBytes(ed, file.bytes, file.name);
}

/** Remplace l'image selectionnee en gardant sa position et sa mise en forme. */
export async function changePicture(ed: Editor): Promise<void> {
  const target = ed.selectedShapes.find((s) => s.kind === 'picture');
  if (!target) return;
  const file = await ed.services.openFile(IMAGE_FILTERS);
  if (!file) return;
  const ext = extensionOf(file.name);
  const deck = { ...ed.deck, media: { ...ed.deck.media } };
  const mediaId = addMedia(deck, file.bytes, ext === 'jpg' ? 'jpeg' : ext);
  const next = editPage(deck, ed.page, (shapes) => {
    const found = locate(shapes, target.id);
    if (found?.shape.kind === 'picture') {
      found.shape.mediaId = mediaId;
      delete found.shape.svgMediaId;
      delete found.shape.crop;
    }
  });
  ed.commit({ ...next, media: deck.media }, 'picture');
}

/** PNG d'un SVG (repli matriciel exige par PowerPoint pour les icones). */
async function svgToPng(svg: string, size: number): Promise<Uint8Array> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')?.drawImage(img, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error(S.insert.iconFailed);
  return new Uint8Array(await blob.arrayBuffer());
}

/** Icone Fluent inseree comme image vectorielle (SVG + repli PNG). */
export async function insertIcon(ed: Editor, name: IconName, color = '#000000'): Promise<void> {
  const markup = renderToStaticMarkup(createElement(Icon, { name, size: 96, color, filled: true }))
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/ aria-hidden="true"| focusable="false"| class="[^"]*"| style="[^"]*"/g, '');
  const svgBytes = new TextEncoder().encode(markup);
  const png = await svgToPng(markup, 256);
  const frame = targetFrame(ed, 72, 72);
  placeShape(ed, (holder, deck) => {
    const pic = addPicture(deck, holder, png, 'png', frame.xfrm, name.replace(/_/g, ' '));
    pic.svgMediaId = addMedia(deck, svgBytes, 'svg', 'image/svg+xml');
    pic.name = `${S.insert.iconName} ${pic.id - 1}`;
    return pic;
  }, frame.replace);
}

export function insertTable(ed: Editor, rows: number, cols: number): void {
  const width = Math.min(ed.deck.size.width * 0.85, cols * 120);
  const height = rows * 37;
  const frame = targetFrame(ed, width, height);
  const xfrm = frame.replace ? { ...frame.xfrm, height } : frame.xfrm;
  if (frame.replace) {
    const sel = ed.ctx.resolve(ed.selectedShapes[0] as Shape).xfrm;
    if (sel) Object.assign(xfrm, { x: sel.x, y: sel.y, width: sel.width });
  }
  placeShape(ed, (holder) => addTable(holder, Math.max(1, Math.min(rows, 75)), Math.max(1, Math.min(cols, 75)), xfrm), frame.replace);
}

export function insertChart(ed: Editor, type: ChartType, options: { barDirection?: 'bar' | 'col'; grouping?: 'clustered' | 'stacked' | 'percentStacked' | 'standard' } = {}): void {
  const frame = targetFrame(ed, 480, 320);
  const pie = type === 'pie' || type === 'doughnut';
  const categories = pie ? ['1er trim.', '2e trim.', '3e trim.', '4e trim.'] : ['Catégorie 1', 'Catégorie 2', 'Catégorie 3', 'Catégorie 4'];
  const series = pie
    ? [{ name: S.insert.sales, values: [8.2, 3.2, 1.4, 1.2] }]
    : type === 'scatter' || type === 'bubble'
      ? [{ name: 'Valeurs Y', values: [2.7, 3.2, 0.8, 2.4], xValues: [0.7, 1.8, 2.6, 3.1], sizes: type === 'bubble' ? [10, 4, 8, 6] : undefined }]
      : [
          { name: 'Série 1', values: [4.3, 2.5, 3.5, 4.5] },
          { name: 'Série 2', values: [2.4, 4.4, 1.8, 2.8] },
          { name: 'Série 3', values: [2, 2, 3, 5] },
        ];
  placeShape(ed, (holder) => addChart(holder, type, categories, series, frame.xfrm, { title: pie ? S.insert.sales : undefined, ...options }), frame.replace);
}

export function insertTextBoxAtCenter(ed: Editor, text: string, props: RunProps = {}): number {
  let id = 0;
  const { width, height } = ed.deck.size;
  ed.editShapes((shapes) => {
    const box = addTextBox({ shapes } as Slide, { x: width * 0.2, y: height * 0.4, width: width * 0.6, height: 60 }, text, { lang: 'fr-FR', ...props });
    if (box.text) box.text.props = { ...box.text.props, wrap: true, autofit: { type: 'shape' } };
    if (box.text?.paragraphs[0]) box.text.paragraphs[0].props = { align: 'ctr' };
    id = box.id;
  }, 'insert');
  ed.setSelection({ ids: [id], text: null });
  return id;
}

/** Styles WordArt : remplissage, contour, ombre (galerie Insertion > WordArt). */
export const WORDART: ReadonlyArray<{ id: string; props: RunProps }> = [
  { id: 'plain', props: { color: { type: 'scheme', value: 'tx1' } } },
  { id: 'accent1', props: { color: { type: 'scheme', value: 'accent1' }, effects: { outerShadow: { color: { type: 'rgb', value: '000000', mods: [{ name: 'alpha', val: 35000 }] }, blur: 3, distance: 2, direction: 45 } } } },
  { id: 'gradient', props: { textFill: { type: 'gradient', kind: 'linear', angle: 90, stops: [{ position: 0, color: { type: 'scheme', value: 'accent2' } }, { position: 100, color: { type: 'scheme', value: 'accent1' } }] } } },
  { id: 'outline', props: { textFill: { type: 'solid', color: { type: 'scheme', value: 'bg1' } }, outline: { width: 1.25, fill: { type: 'solid', color: { type: 'scheme', value: 'accent1' } } } } },
  { id: 'glow', props: { color: { type: 'scheme', value: 'accent2' }, effects: { glow: { radius: 8, color: { type: 'scheme', value: 'accent2', mods: [{ name: 'alpha', val: 40000 }] } } } } },
  { id: 'dark', props: { color: { type: 'scheme', value: 'tx2' }, effects: { outerShadow: { color: { type: 'rgb', value: '000000', mods: [{ name: 'alpha', val: 50000 }] }, blur: 6, distance: 4, direction: 45 } } } },
];

export function insertWordArt(ed: Editor, styleId: string): void {
  const style = WORDART.find((w) => w.id === styleId) ?? WORDART[0];
  insertTextBoxAtCenter(ed, S.insert.wordArtText, { size: 54, bold: true, ...(style?.props ?? {}) });
}

/** Video ou audio incorpore. */
export async function insertMedia(ed: Editor, kind: 'video' | 'audio'): Promise<void> {
  const file = await ed.services.openFile(kind === 'video' ? VIDEO_FILTERS : AUDIO_FILTERS);
  if (!file) return;
  const ext = extensionOf(file.name);
  if (file.bytes.length > MAX_MEDIA || !EXT_TYPES[ext]) {
    ed.notify(S.insert.badMedia(file.name), 'error');
    return;
  }
  const frame = kind === 'video' ? targetFrame(ed, 640, 360) : { xfrm: { x: ed.deck.size.width / 2 - 24, y: ed.deck.size.height / 2 - 24, width: 48, height: 48 } };
  placeShape(ed, (holder, deck) => {
    const id = nextShapeId(holder.shapes);
    const media: MediaShape = {
      kind: 'media',
      id,
      name: `${file.name.replace(/\.[^.]+$/, '')}`,
      mediaType: kind,
      mediaId: addMedia(deck, file.bytes, ext, EXT_TYPES[ext]),
      geometry: { type: 'preset', preset: 'rect' },
      xfrm: frame.xfrm,
    };
    holder.shapes.push(media);
    return media;
  }, 'replace' in frame ? frame.replace : undefined);
}

/** Insere un champ (numero, date) dans le texte en edition, sinon dans une nouvelle zone de texte. */
export function insertField(ed: Editor, fieldType: 'slidenum' | 'datetime1' | 'datetime2'): void {
  const text = fieldType === 'slidenum' ? String(ed.slideIndex + 1) : fieldType === 'datetime2' ? new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('fr-FR');
  const t = ed.selection.text;
  if (!t) {
    const id = insertTextBoxAtCenter(ed, '');
    ed.editShapes((shapes) => {
      const found = locate(shapes, id);
      if (found?.shape.kind === 'shape' && found.shape.text) found.shape.text.paragraphs = [{ props: { align: 'ctr' }, runs: [{ type: 'field', fieldType, id: `{${crypto.randomUUID().toUpperCase()}}`, text, props: { lang: 'fr-FR' } }] }];
    }, 'insert');
    return;
  }
  ed.editShapes((shapes) => {
    const found = locate(shapes, t.shapeId);
    if (found?.shape.kind !== 'shape') return;
    const body = (found.shape.text ??= { props: {}, paragraphs: [] });
    const at = deleteRange(body, orderRange(t.range));
    const end = insertText(body, at, '\u0000');
    const para = body.paragraphs[end.p];
    if (!para) return;
    for (const [i, run] of para.runs.entries()) {
      if (run.type === 'text' && run.text.includes('\u0000')) {
        const [a = '', b = ''] = run.text.split('\u0000');
        para.runs.splice(i, 1, { ...run, text: a }, { type: 'field', fieldType, id: `{${crypto.randomUUID().toUpperCase()}}`, text, props: { ...run.props } }, { ...run, text: b });
        para.runs = para.runs.filter((r) => r.type !== 'text' || r.text !== '');
        break;
      }
    }
  }, 'field');
}

/** Insere un caractere dans le texte en edition. */
export function insertSymbol(ed: Editor, ch: string): void {
  const t = ed.selection.text;
  if (!t) return;
  let next = t.range;
  ed.editShapes((shapes) => {
    const found = locate(shapes, t.shapeId);
    if (found?.shape.kind !== 'shape') return;
    const body = (found.shape.text ??= { props: {}, paragraphs: [] });
    const end = insertText(body, deleteRange(body, orderRange(t.range)), ch);
    next = { start: end, end };
  }, 'typing');
  ed.setSelection({ ...ed.selection, text: { ...t, range: next } });
}

/** Lien hypertexte sur le texte selectionne ou sur les formes selectionnees. */
export function setLink(ed: Editor, link: { url?: string; slideId?: number } | null): void {
  if (link?.url && !/^(https?:|mailto:|file:)/i.test(link.url)) {
    ed.notify(S.insert.badLink, 'error');
    return;
  }
  const hl = link ? (link.url ? { url: link.url } : { slideId: link.slideId }) : null;
  if (ed.selection.text) {
    applyRun(ed, { link: hl }, 'link');
    return;
  }
  ed.editSelected((shape) => {
    if (hl) shape.click = hl;
    else delete shape.click;
  }, 'link');
}

export type { Picture };
