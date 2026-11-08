// Notebook Jupyter (.ipynb, JSON) vers Markdown : cellules de texte, code en blocs, sorties texte et images PNG/JPEG.
// Le Markdown produit passe ensuite par les ecrivains du paquet Texte (docx, odt, html, rtf, pdf...). Sans DOM, teste.
import { S } from './strings.ts';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const isObj = (v: Json | undefined): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Le champ « source » ou « text » d'un notebook est une chaine ou une liste de lignes. */
function joined(v: Json | undefined): string {
  if (typeof v === 'string') return v;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').join('') : '';
}

/** Bloc de code dont la cloture est plus longue que toute suite de ` du contenu. */
function fenced(text: string, lang = ''): string {
  const longest = (text.match(/`+/g) ?? []).reduce((m, s) => Math.max(m, s.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${text.replace(/\n+$/, '')}\n${fence}`;
}

/** Retire les sequences d'echappement ANSI (couleurs des traces d'erreur). */
const plain = (s: string): string => s.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');

function outputBlocks(output: Obj): string[] {
  if (output.output_type === 'stream') return [fenced(plain(joined(output.text)))];
  if (output.output_type === 'error') {
    const trace = Array.isArray(output.traceback) ? joined(output.traceback.map((l) => (typeof l === 'string' ? `${l}\n` : ''))) : '';
    return [fenced(plain(trace || `${String(output.ename ?? '')}: ${String(output.evalue ?? '')}`))];
  }
  const data = isObj(output.data) ? output.data : {};
  const blocks: string[] = [];
  for (const mime of ['image/png', 'image/jpeg']) {
    const img = joined(data[mime]).replace(/\s+/g, '');
    if (img) blocks.push(`![${S.notebook.output}](data:${mime};base64,${img})`);
  }
  const text = joined(data['text/plain']);
  if (blocks.length === 0 && text) blocks.push(fenced(text));
  return blocks;
}

/** Contenu Markdown d'un notebook ; leve une erreur claire si le fichier n'est pas un notebook. */
export function notebookToMarkdown(json: string): string {
  let nb: Json;
  try {
    nb = JSON.parse(json.replace(/^﻿/, '')) as Json;
  } catch {
    throw new Error(S.notebook.invalid);
  }
  if (!isObj(nb) || !Array.isArray(nb.cells)) throw new Error(S.notebook.invalid);
  const meta = isObj(nb.metadata) ? nb.metadata : {};
  const lang = isObj(meta.language_info) && typeof meta.language_info.name === 'string' ? meta.language_info.name : '';
  const parts: string[] = [];
  for (const cell of nb.cells) {
    if (!isObj(cell)) continue;
    const source = joined(cell.source);
    if (cell.cell_type === 'markdown') parts.push(source);
    else if (cell.cell_type === 'code') {
      if (source.trim()) parts.push(fenced(source, lang));
      if (Array.isArray(cell.outputs)) for (const o of cell.outputs) if (isObj(o)) parts.push(...outputBlocks(o));
    } else if (cell.cell_type === 'raw' && source.trim()) parts.push(fenced(source));
  }
  return `${parts.join('\n\n')}\n`;
}
