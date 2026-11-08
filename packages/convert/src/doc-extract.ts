// Contenu d'un document Word vers d'autres modeles : ses tableaux vers un classeur (une feuille par tableau),
// ses titres et paragraphes vers un diaporama (un titre de niveau 1 ou 2 = une diapositive). Sans DOM, teste.
import { blocksText, paragraphText, type Block, type Paragraph, type WordDocument } from '@forgeoffice/docx';
import { createBlankWorkbook, createSheet, setValue, type Workbook } from '@forgeoffice/xlsx';
import { addSlide, createBlankDeck, paragraphsFromText, type Deck } from '@forgeoffice/pptx';
import { S } from './strings.ts';

/** Niveau de titre d'un paragraphe (1 a 9) d'apres son style ou son niveau hierarchique ; 0 sinon. */
export function headingLevel(p: Paragraph): number {
  const m = (p.styleId ?? '').match(/^(?:Heading|Titre)\s*([1-9])$/i);
  if (m) return Number(m[1]);
  const outline = p.props.outlineLevel;
  return typeof outline === 'number' && outline >= 0 && outline < 9 ? outline + 1 : 0;
}

function collectTables(blocks: readonly Block[], out: Extract<Block, { type: 'table' }>[]): void {
  for (const b of blocks) {
    if (b.type === 'table') out.push(b);
    else if (b.type === 'contentControl' || b.type === 'toc') collectTables(b.blocks, out);
  }
}

/** Un classeur : une feuille « Tableau n » par tableau de premier niveau ; erreur claire s'il n'y en a pas. */
export function documentTablesToWorkbook(doc: WordDocument): Workbook {
  const tables: Extract<Block, { type: 'table' }>[] = [];
  collectTables(doc.body, tables);
  if (tables.length === 0) throw new Error(S.extract.noTable);
  const wb = createBlankWorkbook();
  wb.sheets.length = 0;
  tables.forEach((t, i) => {
    const sheet = createSheet(S.extract.table(i + 1));
    t.rows.forEach((row, r) => {
      let c = 0;
      for (const cell of row.cells) {
        if (cell.props.vMerge !== 'continue') {
          const text = blocksText(cell.blocks).replace(/\n+/g, ' ').trim();
          const n = Number(text.replace(/\s/g, '').replace(',', '.'));
          if (text !== '') setValue(sheet, r, c, /^-?\d+([.,]\d+)?$/.test(text.replace(/\s/g, '')) && Number.isFinite(n) ? n : text);
        }
        c += cell.props.gridSpan && cell.props.gridSpan > 1 ? cell.props.gridSpan : 1;
      }
    });
    wb.sheets.push(sheet);
  });
  wb.activeSheet = 0;
  return wb;
}

interface SlideDraft { title: string; lines: string[] }

/** Diapositives d'apres les titres : titre de niveau 1 ou 2 = nouvelle diapositive ; sinon 7 paragraphes par diapositive. */
export function documentOutline(doc: WordDocument): SlideDraft[] {
  const slides: SlideDraft[] = [];
  let current: SlideDraft | null = null;
  const hasHeadings = doc.body.some((b) => b.type === 'paragraph' && headingLevel(b) > 0 && headingLevel(b) <= 2);
  for (const b of doc.body) {
    if (b.type === 'table') {
      const text = blocksText([b], { cellSeparator: ' | ' });
      if (!current) slides.push((current = { title: S.extract.untitled, lines: [] }));
      current.lines.push(...text.split('\n').filter((l) => l.trim() !== ''));
      continue;
    }
    if (b.type !== 'paragraph') continue;
    const text = paragraphText(b).trim();
    if (text === '') continue;
    const level = headingLevel(b);
    if (level > 0 && level <= 2) slides.push((current = { title: text, lines: [] }));
    else {
      if (!current || (!hasHeadings && current.lines.length >= 7)) slides.push((current = { title: hasHeadings ? S.extract.untitled : doc.properties.title || S.extract.untitled, lines: [] }));
      current.lines.push(level > 2 ? `${'\t'.repeat(Math.min(level - 2, 4))}${text}` : text);
    }
  }
  return slides.filter((s) => s.title !== '' || s.lines.length > 0);
}

/** Diaporama 16:9 : une diapositive « Titre et contenu » par entree du plan. */
export function documentToDeck(doc: WordDocument): Deck {
  const outline = documentOutline(doc);
  if (outline.length === 0) throw new Error(S.extract.empty);
  const deck = createBlankDeck('widescreen', { titleSlide: false });
  const layout = deck.masters[0]?.layouts.find((l) => l.type === 'obj') ?? deck.masters[0]?.layouts[1] ?? deck.masters[0]?.layouts[0];
  if (!layout) throw new Error(S.extract.empty);
  deck.properties.title = doc.properties.title ?? '';
  for (const s of outline) {
    const slide = addSlide(deck, layout.id);
    for (const shape of slide.shapes) {
      if (shape.kind !== 'shape' || !shape.placeholder) continue;
      const t = shape.placeholder.type;
      if (t === 'title' || t === 'ctrTitle') shape.text = { props: {}, paragraphs: paragraphsFromText(s.title) };
      else if (t === 'body' || t === 'obj') shape.text = { props: {}, paragraphs: paragraphsFromText(s.lines.join('\n')) };
    }
  }
  return deck;
}
