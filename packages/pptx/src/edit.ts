// Operations d'edition sur le modele (sans DOM) : diapositives, formes, medias, texte.
import { withMetafilePreview } from './metafile-preview.ts';
import { createChart, type ChartOptions, type ChartType, type SimpleSeries } from './chart.ts';
import type { Geometry, Paragraph, RunProps, TextBody, Transform } from './dml.ts';
import type { AutoShape, ChartShape, Deck, MediaItem, Picture, Shape, Slide, TableCell, TableShape } from './model.ts';
import { findLayout } from './model.ts';
import { MEDIA_TYPES } from './xmlns.ts';
import { PLACEHOLDER_NAMES, STRINGS } from './strings.ts';

/** Toutes les formes, groupes developpes (profondeur d'abord). */
export function flattenShapes(shapes: readonly Shape[]): Shape[] {
  const out: Shape[] = [];
  for (const shape of shapes) {
    out.push(shape);
    if (shape.kind === 'group') out.push(...flattenShapes(shape.children));
  }
  return out;
}

/** Prochain identifiant de forme libre dans une liste (groupes compris). */
export function nextShapeId(shapes: readonly Shape[]): number {
  return flattenShapes(shapes).reduce((max, shape) => Math.max(max, shape.id), 1) + 1;
}

/** Prochain identifiant de diapositive (256 et plus, comme PowerPoint). */
export function nextSlideId(deck: Deck): number {
  return deck.slides.reduce((max, slide) => Math.max(max, slide.id), 255) + 1;
}

export const emptyText = (): TextBody => ({ props: {}, paragraphs: [{ props: {}, runs: [] }] });

/** Paragraphes depuis un texte brut (une ligne = un paragraphe ; tabulations initiales = niveau). */
export function paragraphsFromText(value: string, props: RunProps = {}): Paragraph[] {
  return value.split(/\r\n|\r|\n/).map((line) => {
    const level = line.match(/^\t*/)?.[0].length ?? 0;
    const content = line.slice(level);
    return { props: level ? { level } : {}, runs: content ? [{ type: 'text', text: content, props: { ...props } }] : [] };
  });
}

/** Ajoute une diapositive sur une disposition, avec ses espaces reserves vides (hors date, pied et numero). */
export function addSlide(deck: Deck, layoutId: string, index = deck.slides.length): Slide {
  const firstLayout = deck.masters[0]?.layouts[0];
  const layout = findLayout(deck, layoutId)?.layout ?? firstLayout;
  if (!layout) throw new Error(`Disposition introuvable : ${layoutId}`);
  const shapes: Shape[] = [];
  let id = 2;
  for (const source of layout.shapes) {
    const ph = source.placeholder;
    if (!ph || ph.type === 'dt' || ph.type === 'ftr' || ph.type === 'sldNum' || ph.type === 'hdr') continue;
    const placeholder = { ...ph };
    delete placeholder.hasCustomPrompt;
    shapes.push({
      kind: 'shape',
      id,
      name: `${PLACEHOLDER_NAMES[ph.type]} ${id - 1}`,
      placeholder,
      locks: { noGrp: true },
      geometry: { type: 'preset', preset: 'rect' },
      text: emptyText(),
    });
    id++;
  }
  const slide: Slide = { id: nextSlideId(deck), layoutId: layout.id, shapes, animations: [], comments: [] };
  deck.slides.splice(Math.max(0, Math.min(index, deck.slides.length)), 0, slide);
  return slide;
}

/** Duplique une diapositive juste apres l'originale. */
export function duplicateSlide(deck: Deck, slideId: number): Slide | undefined {
  const index = deck.slides.findIndex((s) => s.id === slideId);
  const source = deck.slides[index];
  if (!source) return undefined;
  const copy = structuredClone(source);
  copy.id = nextSlideId(deck);
  deck.slides.splice(index + 1, 0, copy);
  for (const section of deck.sections) {
    const at = section.slideIds.indexOf(slideId);
    if (at >= 0) section.slideIds.splice(at + 1, 0, copy.id);
  }
  return copy;
}

export function removeSlide(deck: Deck, slideId: number): boolean {
  const index = deck.slides.findIndex((s) => s.id === slideId);
  if (index < 0) return false;
  deck.slides.splice(index, 1);
  for (const section of deck.sections) section.slideIds = section.slideIds.filter((id) => id !== slideId);
  return true;
}

export function moveSlide(deck: Deck, slideId: number, toIndex: number): boolean {
  const index = deck.slides.findIndex((s) => s.id === slideId);
  const [slide] = index >= 0 ? deck.slides.splice(index, 1) : [];
  if (!slide) return false;
  deck.slides.splice(Math.max(0, Math.min(toIndex, deck.slides.length)), 0, slide);
  return true;
}

const family = (type: string): string => (type === 'ctrTitle' || type === 'title' ? 'title' : type === 'pic' ? 'pic' : 'body');

/** Change la disposition : les espaces reserves sont rattaches par famille, ceux sans equivalent deviennent des zones de texte. */
export function applyLayout(deck: Deck, slide: Slide, layoutId: string): void {
  const found = findLayout(deck, layoutId);
  if (!found) throw new Error(`Disposition introuvable : ${layoutId}`);
  const targets = found.layout.shapes.filter((s) => s.placeholder && !['dt', 'ftr', 'sldNum', 'hdr'].includes(s.placeholder.type));
  const used = new Set<number>();
  for (const shape of slide.shapes) {
    const ph = shape.placeholder;
    if (!ph || ['dt', 'ftr', 'sldNum', 'hdr'].includes(ph.type)) continue;
    const match = targets.findIndex((t, i) => !used.has(i) && t.placeholder !== undefined && family(t.placeholder.type) === family(ph.type));
    const target = targets[match]?.placeholder;
    if (target) {
      used.add(match);
      shape.placeholder = { ...target };
      delete shape.placeholder.hasCustomPrompt;
      delete shape.xfrm;
    } else {
      delete shape.placeholder;
      if (shape.kind === 'shape') shape.textBox = true;
    }
  }
  slide.layoutId = found.layout.id;
}

/** Enregistre un media et renvoie son identifiant (les octets identiques sont partages). */
export function addMedia(deck: Deck, bytes: Uint8Array, extension: string, contentType?: string): string {
  const ext = extension.replace(/^\./, '').toLowerCase();
  for (const item of Object.values(deck.media)) {
    if (item.extension === ext && item.bytes.length === bytes.length && item.bytes.every((b, i) => b === bytes[i])) return item.id;
  }
  let n = Object.keys(deck.media).length + 1;
  while (deck.media[`media${n}`]) n++;
  const item: MediaItem = withMetafilePreview({ id: `media${n}`, extension: ext, contentType: contentType ?? MEDIA_TYPES[ext] ?? 'application/octet-stream', bytes });
  deck.media[item.id] = item;
  return item.id;
}

export function addTextBox(slide: Slide, xfrm: Transform, value: string, props: RunProps = {}): AutoShape {
  const id = nextShapeId(slide.shapes);
  const shape: AutoShape = {
    kind: 'shape',
    id,
    name: `${STRINGS.textBoxName} ${id - 1}`,
    xfrm,
    textBox: true,
    geometry: { type: 'preset', preset: 'rect' },
    fill: { type: 'none' },
    text: { props: { wrap: true, autofit: { type: 'shape' } }, paragraphs: paragraphsFromText(value, props) },
  };
  slide.shapes.push(shape);
  return shape;
}

/** Forme predefinie avec le style de theme d'Office (remplissage accent1, contour assombri, texte clair). */
export function addAutoShape(slide: Slide, preset: string, xfrm: Transform, name?: string): AutoShape {
  const id = nextShapeId(slide.shapes);
  const geometry: Geometry = { type: 'preset', preset };
  const shape: AutoShape = {
    kind: 'shape',
    id,
    name: `${name ?? preset} ${id - 1}`,
    xfrm,
    geometry,
    style: {
      line: { index: 2, color: { type: 'scheme', value: 'accent1', mods: [{ name: 'shade', val: 15000 }] } },
      fill: { index: 1, color: { type: 'scheme', value: 'accent1' } },
      effect: { index: 0, color: { type: 'scheme', value: 'accent1' } },
      font: { index: 'minor', color: { type: 'scheme', value: 'lt1' } },
    },
    text: { props: { anchor: 'ctr', rtlColumns: false }, paragraphs: [{ props: { align: 'ctr' }, runs: [] }] },
  };
  slide.shapes.push(shape);
  return shape;
}

export function addPicture(deck: Deck, slide: Slide, bytes: Uint8Array, extension: string, xfrm: Transform, description?: string): Picture {
  const mediaId = addMedia(deck, bytes, extension);
  const id = nextShapeId(slide.shapes);
  const picture: Picture = {
    kind: 'picture',
    id,
    name: `${STRINGS.pictureName} ${id - 1}`,
    xfrm,
    mediaId,
    fillMode: 'stretch',
    geometry: { type: 'preset', preset: 'rect' },
    locks: { noChangeAspect: true },
  };
  if (description) picture.description = description;
  slide.shapes.push(picture);
  return picture;
}

/** Tableau (style moyen 2 - accentuation 1, ligne d'en-tete et lignes a bandes, comme Office). */
export function addTable(slide: Slide, rows: number, columns: number, xfrm: Transform, values?: string[][]): TableShape {
  const id = nextShapeId(slide.shapes);
  const rowHeight = xfrm.height / Math.max(1, rows);
  const cell = (r: number, c: number): TableCell => {
    const value = values?.[r]?.[c];
    return { text: value ? { props: {}, paragraphs: paragraphsFromText(value) } : emptyText() };
  };
  const shape: TableShape = {
    kind: 'table',
    id,
    name: `${STRINGS.tableName} ${id - 1}`,
    xfrm,
    locks: { noGrp: true },
    table: {
      columns: Array.from({ length: columns }, () => xfrm.width / Math.max(1, columns)),
      rows: Array.from({ length: rows }, (_, r) => ({ height: rowHeight, cells: Array.from({ length: columns }, (_, c) => cell(r, c)) })),
      styleId: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}',
      firstRow: true,
      bandRow: true,
    },
  };
  slide.shapes.push(shape);
  return shape;
}

/** Fusionne une plage de cellules (coin superieur gauche + etendue). */
export function mergeCells(shape: TableShape, row: number, col: number, rowSpan: number, colSpan: number): void {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      const cell = shape.table.rows[r]?.cells[c];
      if (!cell) continue;
      delete cell.gridSpan;
      delete cell.rowSpan;
      delete cell.hMerge;
      delete cell.vMerge;
      if (r === row && c === col) {
        if (colSpan > 1) cell.gridSpan = colSpan;
        if (rowSpan > 1) cell.rowSpan = rowSpan;
      } else {
        if (c > col) cell.hMerge = true;
        if (r > row) cell.vMerge = true;
      }
    }
  }
}

export function addChart(slide: Slide, type: ChartType, categories: string[], series: SimpleSeries[], xfrm: Transform, options?: ChartOptions): ChartShape {
  const id = nextShapeId(slide.shapes);
  const shape: ChartShape = { kind: 'chart', id, name: `${STRINGS.chartName} ${id - 1}`, xfrm, chart: createChart(type, categories, series, options) };
  slide.shapes.push(shape);
  return shape;
}

/** Texte brut d'un corps de texte (paragraphes separes par \n, sauts de ligne par \v). */
export function textOfBody(body: TextBody | undefined): string {
  if (!body) return '';
  return body.paragraphs.map((p) => p.runs.map((r) => (r.type === 'break' ? '\v' : r.text)).join('')).join('\n');
}

/** Texte brut d'une forme (tableaux, groupes et rendus de repli compris). */
export function textOfShape(shape: Shape): string {
  switch (shape.kind) {
    case 'shape':
      return textOfBody(shape.text);
    case 'table':
      return shape.table.rows.map((row) => row.cells.map((cell) => textOfBody(cell.text)).join('\t')).join('\n');
    case 'group':
      return shape.children.map(textOfShape).filter(Boolean).join('\n');
    case 'smartart':
    case 'raw':
      return shape.fallback.map(textOfShape).filter(Boolean).join('\n');
    default:
      return '';
  }
}

/** Titre d'une diapositive (espace reserve titre), chaine vide si aucun. */
export function slideTitle(slide: Slide): string {
  const title = slide.shapes.find((s) => s.placeholder && (s.placeholder.type === 'title' || s.placeholder.type === 'ctrTitle'));
  return title ? textOfShape(title).replace(/[\v\n]+/g, ' ').trim() : '';
}

/** Texte complet des formes d'une diapositive. */
export function slideText(slide: Slide): string {
  return slide.shapes.map(textOfShape).filter(Boolean).join('\n');
}

/** Remplace un texte dans tous les segments (sans traverser leurs limites). Renvoie le nombre de remplacements. */
export function replaceText(deck: Deck, search: string, replacement: string, matchCase = false): number {
  if (!search) return 0;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, matchCase ? 'g' : 'gi');
  let count = 0;
  const visitBody = (paragraphs: Paragraph[] | undefined): void => {
    for (const paragraph of paragraphs ?? []) {
      for (const run of paragraph.runs) {
        if (run.type !== 'text') continue;
        run.text = run.text.replace(pattern, () => {
          count++;
          return replacement;
        });
      }
    }
  };
  const visit = (shape: Shape): void => {
    if (shape.kind === 'shape') visitBody(shape.text?.paragraphs);
    else if (shape.kind === 'table') shape.table.rows.forEach((row) => row.cells.forEach((cell) => visitBody(cell.text.paragraphs)));
    else if (shape.kind === 'group') shape.children.forEach(visit);
  };
  for (const slide of deck.slides) {
    slide.shapes.forEach(visit);
    visitBody(slide.notes);
  }
  return count;
}

/** Notes du presentateur en texte brut. */
export function notesText(slide: Slide): string {
  return slide.notes ? textOfBody({ props: {}, paragraphs: slide.notes }) : '';
}

export function setNotes(slide: Slide, value: string): void {
  if (value) slide.notes = paragraphsFromText(value);
  else delete slide.notes;
}
