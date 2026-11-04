// Conversion modele docx <-> document ProseMirror, sans perte : ce qui n'est pas editable est conserve dans les attributs.
import type { Fragment, Mark, Node as PMNode, Schema } from 'prosemirror-model';
import type {
  Block, ContentControlProps, Hyperlink, Inline, InlineContentControl, Paragraph, RunProps, Table, TableCell, TableCellProps,
  TableRow, TextRun, WordDocument,
} from '@forgeoffice/docx';
import { RUN_KEYS, markName, type RunKey } from './schema.ts';

const PT_TO_PX = 4 / 3;

/** Marques d'un ensemble de proprietes de caracteres (+ style de caractere). */
export function runMarks(schema: Schema, props: RunProps | undefined, styleId?: string): Mark[] {
  const marks: Mark[] = [];
  if (styleId) marks.push(schema.marks.cstyle!.create({ id: styleId }));
  if (!props) return marks;
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    const type = (RUN_KEYS as readonly string[]).includes(key) ? schema.marks[markName(key as RunKey)] : undefined;
    if (type) marks.push(type.create({ v: value }));
    else rest[key] = value;
  }
  if (Object.keys(rest).length) marks.push(schema.marks.rp_rest!.create({ props: rest }));
  return marks;
}

/** Proprietes de caracteres portees par un ensemble de marques. */
export function propsFromMarks(marks: readonly Mark[]): { props: RunProps; styleId?: string } {
  const props: Record<string, unknown> = {};
  let styleId: string | undefined;
  for (const m of marks) {
    const name = m.type.name;
    if (name === 'cstyle') styleId = String(m.attrs.id);
    else if (name === 'rp_rest') Object.assign(props, m.attrs.props as RunProps);
    else if (name.startsWith('rp_')) props[name.slice(3)] = m.attrs.v;
  }
  return styleId ? { props: props as RunProps, styleId } : { props: props as RunProps };
}

function inlinesToPM(schema: Schema, inlines: readonly Inline[], outer: readonly Mark[]): PMNode[] {
  const out: PMNode[] = [];
  const withMarks = (extra: Mark[]): Mark[] => {
    let set: readonly Mark[] = outer;
    for (const m of extra) set = m.addToSet(set);
    return [...set];
  };
  for (const inline of inlines) {
    switch (inline.type) {
      case 'text': {
        if (!inline.text) break;
        const extra = runMarks(schema, inline.props, inline.styleId);
        if (inline.revision) extra.push(schema.marks.revision!.create({ rev: inline.revision }));
        if (inline.formatChange) extra.push(schema.marks.fmtchange!.create({ change: inline.formatChange }));
        out.push(schema.text(inline.text, withMarks(extra)));
        break;
      }
      case 'tab': {
        const extra = runMarks(schema, inline.props);
        if (inline.revision) extra.push(schema.marks.revision!.create({ rev: inline.revision }));
        out.push(schema.text('\t', withMarks(extra)));
        break;
      }
      case 'break':
        if (inline.kind === 'line') out.push(schema.nodes.hard_break!.create({ data: inline }, null, withMarks([])));
        else out.push(schema.nodes.atom!.create({ data: inline }, null, withMarks([])));
        break;
      case 'hyperlink': {
        const link = schema.marks.link!.create({ url: inline.url ?? null, anchor: inline.anchor ?? null, tooltip: inline.tooltip ?? null, revision: inline.revision ?? null });
        out.push(...inlinesToPM(schema, inline.inlines, withMarks([link])));
        break;
      }
      case 'inlineControl': {
        const control = schema.marks.control!.create({ props: inline.props });
        out.push(...inlinesToPM(schema, inline.inlines, withMarks([control])));
        break;
      }
      default:
        out.push(schema.nodes.atom!.create({ data: inline }, null, withMarks([])));
    }
  }
  return out;
}

function paragraphToPM(schema: Schema, p: Paragraph): PMNode {
  return schema.nodes.paragraph!.create({
    styleId: p.styleId ?? null, props: p.props, markProps: p.markProps ?? null, markRevision: p.markRevision ?? null,
    formatChange: p.formatChange ?? null, sectionBreak: p.sectionBreak ?? null, paraId: p.paraId ?? null,
  }, inlinesToPM(schema, p.inlines, []));
}

const emptyBlocks = (schema: Schema, blocks: readonly Block[]): PMNode[] => {
  const nodes = blocksToPM(schema, blocks);
  return nodes.length ? nodes : [schema.nodes.paragraph!.create()];
};

function tableToPM(schema: Schema, t: Table): PMNode {
  // Fusions verticales Word (restart / continue) -> rowspan ProseMirror.
  const gridCols = (row: TableRow): { cell: TableCell; col: number }[] => {
    let col = 0;
    return row.cells.map((cell) => {
      const at = { cell, col };
      col += cell.props.gridSpan ?? 1;
      return at;
    });
  };
  const layout = t.rows.map(gridCols);
  const rows = t.rows.map((row, r) => {
    const cells: PMNode[] = [];
    for (const { cell, col } of layout[r] ?? []) {
      if (cell.props.vMerge === 'continue') continue;
      let rowspan = 1;
      if (cell.props.vMerge === 'restart') {
        for (let below = r + 1; below < t.rows.length; below++) {
          const hit = layout[below]?.find((c) => c.col === col);
          if (hit?.cell.props.vMerge !== 'continue') break;
          rowspan++;
        }
      }
      const span = cell.props.gridSpan ?? 1;
      const widths = t.grid.slice(col, col + span).map((w) => Math.round(w * PT_TO_PX));
      const { gridSpan: _g, vMerge: _v, ...props } = cell.props;
      cells.push(schema.nodes.table_cell!.create(
        { colspan: span, rowspan, colwidth: widths.length === span && widths.every((w) => w > 0) ? widths : null, props },
        emptyBlocks(schema, cell.blocks),
      ));
    }
    if (!cells.length) cells.push(schema.nodes.table_cell!.create({ props: {} }, [schema.nodes.paragraph!.create()]));
    return schema.nodes.table_row!.create({ props: row.props }, cells);
  });
  return schema.nodes.table!.create({ styleId: t.styleId ?? null, props: t.props, grid: t.grid }, rows);
}

export function blocksToPM(schema: Schema, blocks: readonly Block[]): PMNode[] {
  return blocks.map((b): PMNode => {
    switch (b.type) {
      case 'paragraph': return paragraphToPM(schema, b);
      case 'table': return tableToPM(schema, b);
      case 'contentControl': return schema.nodes.control_block!.create({ props: b.props }, emptyBlocks(schema, b.blocks));
      case 'toc': return schema.nodes.toc!.create({ instruction: b.instruction, id: b.id ?? null }, emptyBlocks(schema, b.blocks));
      case 'raw': return schema.nodes.raw_block!.create({ block: b });
    }
  });
}

/** Corps du document -> noeud doc ProseMirror. */
export function documentToPM(schema: Schema, doc: Pick<WordDocument, 'body'>): PMNode {
  return schema.nodes.doc!.create(null, emptyBlocks(schema, doc.body));
}

// ---------------------------------------------------------------------------------------------------
// ProseMirror -> modele
// ---------------------------------------------------------------------------------------------------

interface Item {
  inline: Inline;
  link?: Mark;
  control?: Mark;
}

function textInlines(node: PMNode): Inline[] {
  const { props, styleId } = propsFromMarks(node.marks);
  const rev = node.marks.find((m) => m.type.name === 'revision')?.attrs.rev as TextRun['revision'] | undefined;
  const change = node.marks.find((m) => m.type.name === 'fmtchange')?.attrs.change as TextRun['formatChange'] | undefined;
  const out: Inline[] = [];
  const parts = (node.text ?? '').split('\t');
  parts.forEach((part, i) => {
    if (i > 0) {
      const tab: Inline = Object.keys(props).length ? { type: 'tab', props } : { type: 'tab' };
      if (rev) tab.revision = rev;
      out.push(tab);
    }
    if (!part) return;
    const run: TextRun = { type: 'text', text: part, props: { ...props } };
    if (styleId) run.styleId = styleId;
    if (rev) run.revision = rev;
    if (change) run.formatChange = change;
    out.push(run);
  });
  return out;
}

function group(items: readonly Item[]): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i]!;
    if (item.control) {
      const ctrl = item.control;
      const sub: Item[] = [];
      while (i < items.length && items[i]!.control?.eq(ctrl)) {
        sub.push({ ...items[i]!, control: undefined });
        i++;
      }
      const node: InlineContentControl = { type: 'inlineControl', props: ctrl.attrs.props as ContentControlProps, inlines: group(sub) };
      out.push(node);
    } else if (item.link) {
      const link = item.link;
      const sub: Inline[] = [];
      while (i < items.length && !items[i]!.control && items[i]!.link?.eq(link)) {
        sub.push(items[i]!.inline);
        i++;
      }
      const h: Hyperlink = { type: 'hyperlink', inlines: sub };
      if (link.attrs.url) h.url = String(link.attrs.url);
      if (link.attrs.anchor) h.anchor = String(link.attrs.anchor);
      if (link.attrs.tooltip) h.tooltip = String(link.attrs.tooltip);
      if (link.attrs.revision) h.revision = link.attrs.revision as Hyperlink['revision'];
      out.push(h);
    } else {
      out.push(item.inline);
      i++;
    }
  }
  return out;
}

/** Elements en ligne d'un noeud de texte ProseMirror (paragraphe). */
export function inlinesFromPM(node: PMNode): Inline[] {
  const items: Item[] = [];
  node.forEach((child) => {
    const link = child.marks.find((m) => m.type.name === 'link');
    const control = child.marks.find((m) => m.type.name === 'control');
    const ctx = { link, control };
    if (child.isText) for (const inline of textInlines(child)) items.push({ inline, ...ctx });
    else items.push({ inline: child.attrs.data as Inline, ...ctx });
  });
  return group(items);
}

function paragraphFromPM(node: PMNode): Paragraph {
  const a = node.attrs;
  const p: Paragraph = { type: 'paragraph', props: a.props as Paragraph['props'], inlines: inlinesFromPM(node) };
  if (a.styleId) p.styleId = String(a.styleId);
  if (a.markProps) p.markProps = a.markProps as RunProps;
  if (a.markRevision) p.markRevision = a.markRevision as Paragraph['markRevision'];
  if (a.formatChange) p.formatChange = a.formatChange as Paragraph['formatChange'];
  if (a.sectionBreak) p.sectionBreak = a.sectionBreak as Paragraph['sectionBreak'];
  if (a.paraId) p.paraId = String(a.paraId);
  return p;
}

function tableFromPM(node: PMNode): Table {
  // rowspan -> cellules « continue » recreees a la bonne colonne de la grille.
  const pending = new Map<number, { left: number; span: number; props: TableCellProps }>();
  const rows: TableRow[] = [];
  node.forEach((rowNode) => {
    const cells: TableCell[] = [];
    let col = 0;
    const flushAt = (): void => {
      let p = pending.get(col);
      while (p) {
        const props: TableCellProps = { ...p.props, vMerge: 'continue' };
        if (p.span > 1) props.gridSpan = p.span;
        cells.push({ props, blocks: [{ type: 'paragraph', props: {}, inlines: [] }] });
        p.left--;
        if (p.left <= 0) pending.delete(col);
        col += p.span;
        p = pending.get(col);
      }
    };
    rowNode.forEach((cellNode) => {
      flushAt();
      const span = Number(cellNode.attrs.colspan) || 1;
      const rowspan = Number(cellNode.attrs.rowspan) || 1;
      const props: TableCellProps = { ...(cellNode.attrs.props as TableCellProps) };
      if (span > 1) props.gridSpan = span;
      if (rowspan > 1) {
        props.vMerge = 'restart';
        pending.set(col, { left: rowspan - 1, span, props: cellNode.attrs.props as TableCellProps });
      }
      cells.push({ props, blocks: blocksFromPM(cellNode) });
      col += span;
    });
    flushAt();
    rows.push({ props: rowNode.attrs.props as TableRow['props'], cells });
  });
  const t: Table = { type: 'table', props: node.attrs.props as Table['props'], grid: node.attrs.grid as number[], rows };
  if (node.attrs.styleId) t.styleId = String(node.attrs.styleId);
  return t;
}

/** Blocs enfants d'un noeud conteneur (doc, cellule, table des matieres...). */
export function blocksFromPM(container: PMNode | Fragment): Block[] {
  const out: Block[] = [];
  container.forEach((node) => {
    switch (node.type.name) {
      case 'paragraph': out.push(paragraphFromPM(node)); break;
      case 'table': out.push(tableFromPM(node)); break;
      case 'control_block': out.push({ type: 'contentControl', props: node.attrs.props as ContentControlProps, blocks: blocksFromPM(node) }); break;
      case 'toc': {
        const toc: Block = { type: 'toc', instruction: String(node.attrs.instruction), blocks: blocksFromPM(node) };
        if (node.attrs.id !== null) toc.id = Number(node.attrs.id);
        out.push(toc);
        break;
      }
      case 'raw_block': out.push(node.attrs.block as Block); break;
      default: break;
    }
  });
  return out;
}

/** Document complet : meta (styles, sections, notes, medias, parties conservees) + corps edite. */
export function documentFromPM(pmDoc: PMNode, meta: WordDocument): WordDocument {
  return { ...meta, body: blocksFromPM(pmDoc) };
}

