// Publipostage : lecture CSV (separateur detecte, guillemets), champs MERGEFIELD, fusion en un document.
import type { Block, Field, Inline } from '@forgeoffice/docx';

export interface Csv {
  headers: string[];
  rows: string[][];
}

/** Analyse un CSV (« ; », « , » ou tabulation detecte sur la premiere ligne). Lignes bornees a `maxRows`. */
export function parseCsv(text: string, maxRows = 10_000): Csv {
  const clean = text.replace(/^\ufeff/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', '\t', ','].map((s) => [s, firstLine.split(s).length] as const).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      if (rows.length > maxRows) break;
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((f) => f !== '')) rows.push(row);
  }
  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { headers, rows: rows.slice(0, maxRows) };
}

/** Nom du champ d'une instruction « MERGEFIELD Nom \* MERGEFORMAT ». */
export function mergeFieldName(instruction: string): string | null {
  const m = instruction.match(/^\s*MERGEFIELD\s+("([^"]+)"|(\S+))/i);
  return m ? (m[2] ?? m[3] ?? null) : null;
}

export function mergeField(name: string): Field {
  const safe = name.replace(/["\\]/g, '');
  return { type: 'field', instruction: ` MERGEFIELD "${safe}" \\* MERGEFORMAT `, code: 'MERGEFIELD', result: [{ type: 'text', text: `«${safe}»`, props: {} }] };
}

function mapInlines(inlines: readonly Inline[], value: (name: string) => string | null): Inline[] {
  return inlines.map((i): Inline => {
    if (i.type === 'field' && i.code === 'MERGEFIELD') {
      const name = mergeFieldName(i.instruction);
      const v = name ? value(name) : null;
      return v === null ? i : { ...i, result: [{ type: 'text', text: v, props: i.props ?? {} }] };
    }
    if (i.type === 'hyperlink') return { ...i, inlines: mapInlines(i.inlines, value) };
    if (i.type === 'inlineControl') return { ...i, inlines: mapInlines(i.inlines, value) };
    return i;
  });
}

/** Remplace les resultats des champs de fusion par les valeurs d'un enregistrement. */
export function fillBlocks(blocks: readonly Block[], csv: Csv, row: readonly string[]): Block[] {
  const value = (name: string): string | null => {
    const idx = csv.headers.findIndex((h) => h.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'));
    return idx < 0 ? null : (row[idx] ?? '');
  };
  return blocks.map((b): Block => {
    switch (b.type) {
      case 'paragraph': return { ...b, inlines: mapInlines(b.inlines, value) };
      case 'table': return { ...b, rows: b.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, blocks: fillBlocks(c.blocks, csv, row) })) })) };
      case 'contentControl':
      case 'toc': return { ...b, blocks: fillBlocks(b.blocks, csv, row) };
      default: return b;
    }
  });
}

/** Fusion complete : une copie par enregistrement, separees par des sauts de page. */
export function mergeAll(blocks: readonly Block[], csv: Csv): Block[] {
  const out: Block[] = [];
  csv.rows.forEach((row, i) => {
    const filled = fillBlocks(blocks, csv, row);
    if (i > 0) {
      const first = filled[0];
      if (first?.type === 'paragraph') filled[0] = { ...first, props: { ...first.props, pageBreakBefore: true } };
      else out.push({ type: 'paragraph', props: {}, inlines: [{ type: 'break', kind: 'page' }] });
    }
    out.push(...filled);
  });
  return out;
}
