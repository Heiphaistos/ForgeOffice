// Exportation d'une table ou d'un resultat : texte delimite (usage francais) et document HTML echappe.
import type { Json } from '../types.ts';
import { displayValue } from './values.ts';

export interface ExportData {
  title: string;
  columns: string[];
  rows: Json[][];
}

function csvCell(v: Json, sep: string): string {
  let text: string;
  if (v === null) text = '';
  else if (typeof v === 'number') text = String(v).replace('.', ',');
  else if (typeof v === 'boolean') text = v ? 'Oui' : 'Non';
  else if (typeof v === 'string') text = displayValue(v, null);
  else text = displayValue(v, null);
  // Protection tableur : une cellule qui commence par = + - @ ne doit pas devenir une formule.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /["\r\n]/.test(text) || text.includes(sep) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV : separateur « ; », decimale virgule, BOM pour le tableur, fin de ligne CRLF. */
export function toCsv(data: ExportData, sep = ';'): string {
  const lines = [data.columns.map((c) => csvCell(c, sep)).join(sep), ...data.rows.map((r) => r.map((v) => csvCell(v, sep)).join(sep))];
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Document HTML autonome (aucun script, contenu echappe). */
export function toHtml(data: ExportData): string {
  const head = data.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const body = data.rows
    .map((r) => `<tr>${r.map((v) => `<td${typeof v === 'number' ? ' class="n"' : ''}>${escapeHtml(displayValue(v, null))}</td>`).join('')}</tr>`)
    .join('\n');
  const title = escapeHtml(data.title);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>body{font-family:"Segoe UI",sans-serif;margin:24px}table{border-collapse:collapse}th,td{border:1px solid #c8c6c4;padding:4px 8px;text-align:left}th{background:#f3f2f1}td.n{text-align:right}caption{font-weight:600;font-size:1.2em;margin-bottom:8px;text-align:left}</style>
</head>
<body>
<table>
<caption>${title}</caption>
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
</body>
</html>
`;
}

/** Nom de fichier sur pour un objet (caracteres interdits retires). */
export function fileNameFor(name: string, ext: string): string {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'Export';
  return `${clean}.${ext}`;
}
