// Lecture des parties annexes d'une feuille : tableaux, notes (+ VML), commentaires modernes, personnes.
import { parseXml, textOf, XmlError, type XmlElement } from '@forgeoffice/opc';
import { parseCell, parseRange } from '../address.ts';
import type { Note, Person, Table, TableColumn, ThreadedComment, TotalsRowFunction } from '../model.ts';
import { fromFileFormula } from './formula-names.ts';
import { readAutoFilter, readSortState } from './read-sheet-rules.ts';
import { readRichText } from './read-sheet.ts';
import { bool, deep, int, kid, kids, optBool, str } from './xml-util.ts';

export function readTable(root: XmlElement): Table | undefined {
  const ref = parseRange(str(root, 'ref') ?? '');
  if (!ref) return undefined;
  const name = str(root, 'name') ?? str(root, 'displayName') ?? 'Tableau1';
  const table: Table = {
    id: int(root, 'id') ?? 1,
    name,
    displayName: str(root, 'displayName') ?? name,
    ref,
    headerRowCount: int(root, 'headerRowCount') ?? 1,
    totalsRowShown: bool(root, 'totalsRowShown', true),
    totalsRowCount: int(root, 'totalsRowCount') ?? 0,
    columns: kids(kid(root, 'tableColumns'), 'tableColumn').map((c, i): TableColumn => {
      const column: TableColumn = { id: int(c, 'id') ?? i + 1, name: str(c, 'name') ?? `Colonne${i + 1}` };
      const fn = str(c, 'totalsRowFunction');
      if (fn) column.totalsRowFunction = fn as TotalsRowFunction;
      const label = str(c, 'totalsRowLabel');
      if (label !== undefined) column.totalsRowLabel = label;
      const calculated = kid(c, 'calculatedColumnFormula');
      if (calculated) column.calculatedFormula = fromFileFormula(textOf(calculated));
      const totals = kid(c, 'totalsRowFormula');
      if (totals) column.totalsRowFormula = fromFileFormula(textOf(totals));
      const dxf = int(c, 'dataDxfId');
      if (dxf !== undefined) column.dataDxfId = dxf;
      return column;
    }),
  };
  const info = kid(root, 'tableStyleInfo');
  if (info) {
    table.style = {
      name: str(info, 'name') ?? '',
      showFirstColumn: bool(info, 'showFirstColumn', false),
      showLastColumn: bool(info, 'showLastColumn', false),
      showRowStripes: bool(info, 'showRowStripes', false),
      showColumnStripes: bool(info, 'showColumnStripes', false),
    };
  }
  const filter = readAutoFilter(kid(root, 'autoFilter'));
  if (filter) table.autoFilter = filter;
  const sort = readSortState(kid(root, 'sortState'));
  if (sort) table.sort = sort;
  const comment = str(root, 'comment');
  if (comment) table.comment = comment;
  return table;
}

/** Notes historiques ; les espaces reserves des commentaires modernes (« tc={...} ») sont ignores. */
export function readComments(root: XmlElement): Note[] {
  const authors = kids(kid(root, 'authors'), 'author').map((a) => textOf(a));
  const notes: Note[] = [];
  for (const node of kids(kid(root, 'commentList'), 'comment')) {
    const ref = parseCell(str(node, 'ref') ?? '');
    if (!ref) continue;
    const author = authors[int(node, 'authorId') ?? 0] ?? '';
    if (author.startsWith('tc=')) continue;
    const content = readRichText(kid(node, 'text'));
    const note: Note = { ref, author, text: content.text };
    if (content.rich) note.rich = content.rich;
    notes.push(note);
  }
  return notes;
}

/** Applique la visibilite et la taille des bulles depuis le dessin VML (tolerant : VML souvent mal forme). */
export function applyVmlToNotes(vml: string, notes: Note[]): void {
  let root: XmlElement;
  try {
    root = parseXml(vml.replace(/<br>/gi, '<br/>'));
  } catch (error) {
    if (error instanceof XmlError) return;
    throw error;
  }
  for (const shape of deep(root, 'shape')) {
    const data = kid(shape, 'ClientData');
    if (!data || str(data, 'ObjectType') !== 'Note') continue;
    const row = Number(textOf(kid(data, 'Row')));
    const col = Number(textOf(kid(data, 'Column')));
    const note = notes.find((n) => n.ref.row === row && n.ref.col === col);
    if (!note) continue;
    if (kid(data, 'Visible')) note.visible = true;
    const style = str(shape, 'style') ?? '';
    const width = style.match(/width:\s*([\d.]+)pt/);
    const height = style.match(/height:\s*([\d.]+)pt/);
    if (width?.[1]) note.width = Math.round((Number(width[1]) * 96) / 72);
    if (height?.[1]) note.height = Math.round((Number(height[1]) * 96) / 72);
  }
}

export function readThreadedComments(root: XmlElement): ThreadedComment[] {
  const threads: ThreadedComment[] = [];
  const byId = new Map<string, ThreadedComment>();
  for (const node of kids(root, 'threadedComment')) {
    const id = str(node, 'id') ?? '';
    const parent = str(node, 'parentId');
    const text = textOf(kid(node, 'text'));
    const date = str(node, 'dT');
    const personId = str(node, 'personId') ?? '';
    if (parent) {
      const thread = byId.get(parent);
      if (thread) thread.replies.push(date ? { id, personId, text, date } : { id, personId, text });
      continue;
    }
    const ref = parseCell(str(node, 'ref') ?? '');
    if (!ref) continue;
    const thread: ThreadedComment = { id, ref, personId, text, replies: [] };
    if (date) thread.date = date;
    if (optBool(node, 'done')) thread.done = true;
    const mentions = kids(kid(node, 'mentions'), 'mention').map((m) => str(m, 'mentionpersonId') ?? '').filter(Boolean);
    if (mentions.length) thread.mentions = mentions;
    byId.set(id, thread);
    threads.push(thread);
  }
  return threads;
}

export function readPersons(root: XmlElement): Person[] {
  return kids(root, 'person').map((p) => {
    const person: Person = { id: str(p, 'id') ?? '', displayName: str(p, 'displayName') ?? '' };
    const userId = str(p, 'userId');
    if (userId) person.userId = userId;
    const provider = str(p, 'providerId');
    if (provider) person.providerId = provider;
    return person;
  });
}
