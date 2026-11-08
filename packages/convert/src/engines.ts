// Execution d'une conversion : paquets de la suite (TypeScript), navigateur (canvas, pdf.js, pdf-lib)
// ou moteur natif forge-convert. Les paquets lourds sont charges a la demande.
import type { NativeBridge } from '@forgeoffice/core';
import { extensionOf, mimeOf, type Engine } from './formats.ts';
import { input, outputTarget, runBytes, type NamedBytes } from './native.ts';
import { imagesToPdf, type ImageKind } from './pdf-ops.ts';
import { S } from './strings.ts';

export interface ConvertOptions {
  /** Qualite JPEG/WebP 1..100. */
  quality: number;
  width: number | null;
  height: number | null;
  rotation: 0 | 90 | 180 | 270;
  highFidelity: boolean;
  /** CSV/TSV depuis un classeur : un fichier par feuille au lieu de la seule feuille active. */
  allSheets: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = { quality: 90, width: null, height: null, rotation: 0, highFidelity: false, allSheets: false };

const stem = (name: string): string => name.replace(/\.[^.]+$/, '') || 'fichier';

/** Diaporama vers PDF vectoriel avec le moteur de la Presentation (texte reel, formes, images, tableaux). */
async function viaDiaporamaPdf(file: NamedBytes, password?: string): Promise<Uint8Array> {
  const pptx = await import('@forgeoffice/pptx');
  const deck = await pptx.openPresentation(file.bytes, { password });
  // Lecture seule du moteur de la Presentation : son export PDF n'est pas expose par le paquet.
  const { vectorPdf } = await import('../../powerpoint/src/app/pdf-export.ts');
  return (await vectorPdf(deck, stem(file.name))).bytes;
}

/** Tableaux d'un document vers un classeur, ou plan d'un document vers un diaporama. */
async function viaExtraction(file: NamedBytes, target: string, password?: string): Promise<Uint8Array> {
  const docx = await import('@forgeoffice/docx');
  const extract = await import('./doc-extract.ts');
  const { document } = await docx.readDocument(file.bytes, file.name, { password });
  if (['pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm', 'odp'].includes(target)) {
    const pptx = await import('@forgeoffice/pptx');
    const deck = extract.documentToDeck(document);
    return target === 'odp' ? pptx.writeOdp(deck) : pptx.writePptx(deck, { format: target as import('@forgeoffice/pptx').DeckFormat });
  }
  const xlsx = await import('@forgeoffice/xlsx');
  return xlsx.writeWorkbook(extract.documentTablesToWorkbook(document), target as import('@forgeoffice/xlsx').SpreadsheetFormat, { csv: { escapeFormulas: true } });
}

async function viaDonnees(file: NamedBytes, target: string, password?: string): Promise<Uint8Array> {
  const xlsx = await import('@forgeoffice/xlsx');
  const data = await import('./sheet-data.ts');
  const text = (t: string): Uint8Array => new TextEncoder().encode(t);
  const st = await import('./structured.ts');
  const ext = extensionOf(file.name);
  const source = new TextDecoder().decode(file.bytes);
  const fromText = ext === 'json' ? JSON.parse(source.replace(/^﻿/, '')) as import('./structured.ts').Json : ext === 'yaml' || ext === 'yml' ? st.parseYaml(source) : ext === 'toml' ? st.parseToml(source) : undefined;
  if (fromText !== undefined && !['json', 'yaml', 'toml', 'xml'].includes(target)) {
    return xlsx.writeWorkbook(data.valueToWorkbook(fromText), target as import('@forgeoffice/xlsx').SpreadsheetFormat, { csv: { escapeFormulas: true } });
  }
  const wb = fromText === undefined ? await xlsx.readWorkbook(file.bytes, file.name, { password }) : null;
  if (['json', 'yaml', 'toml', 'xml'].includes(target)) {
    const value = fromText ?? (JSON.parse(data.workbookToJson(wb as import('@forgeoffice/xlsx').Workbook)) as import('./structured.ts').Json);
    return text(target === 'json' ? JSON.stringify(value, null, 2) : target === 'yaml' ? st.toYaml(value) : target === 'toml' ? st.toToml(value) : st.toXml(value, st.xmlName(stem(file.name))));
  }
  return text(target === 'html' ? data.workbookToHtml(wb as import('@forgeoffice/xlsx').Workbook, stem(file.name)) : data.workbookToMarkdown(wb as import('@forgeoffice/xlsx').Workbook));
}

/** Classeur vers CSV/TSV : une sortie par feuille visible, nommee « classeur-Feuille.csv ». */
async function sheetsToCsv(file: NamedBytes, target: string, outName: string, password?: string): Promise<NamedBytes[]> {
  const xlsx = await import('@forgeoffice/xlsx');
  const wb = await xlsx.readWorkbook(file.bytes, file.name, { password });
  const used = new Set<string>();
  const out: NamedBytes[] = [];
  for (const [i, sheet] of wb.sheets.entries()) {
    if (sheet.state !== 'visible' || sheet.isChartSheet) continue;
    const label = sheet.name.replace(/[\/:*?"<>|]/g, '_');
    let name = `${stem(outName)}-${label}.${target}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${stem(outName)}-${label} (${n}).${target}`;
    used.add(name.toLowerCase());
    out.push({ name, bytes: await xlsx.writeWorkbook(wb, target as 'csv' | 'tsv', { sheetIndex: i, csv: { escapeFormulas: true } }) });
  }
  return out;
}

async function viaSuite(engine: 'texte' | 'tableur' | 'presentation', file: NamedBytes, target: string, password?: string): Promise<Uint8Array> {
  if (engine === 'texte') {
    const docx = await import('@forgeoffice/docx');
    // Notebook Jupyter ou plan OPML : convertis en Markdown, puis lus comme tels.
    const kind = extensionOf(file.name);
    const source = kind === 'ipynb' || kind === 'opml' ? new TextDecoder().decode(file.bytes) : '';
    const notebook = kind === 'ipynb' ? new TextEncoder().encode((await import('./notebook.ts')).notebookToMarkdown(source)) : kind === 'opml' ? new TextEncoder().encode((await import('./opml.ts')).opmlToMarkdown(source)) : null;
    const { document } = notebook ? await docx.readDocument(notebook, `${stem(file.name)}.md`) : await docx.readDocument(file.bytes, file.name, { password });
    return docx.writeDocument(document, target as Exclude<import('@forgeoffice/docx').DocumentFormat, 'doc'>);
  }
  if (engine === 'tableur') {
    const xlsx = await import('@forgeoffice/xlsx');
    // Texte commencant par = + - @ neutralise en CSV/TSV (injection de formules chez le destinataire).
    return xlsx.writeWorkbook(await xlsx.readWorkbook(file.bytes, file.name, { password }), target as import('@forgeoffice/xlsx').SpreadsheetFormat, { csv: { escapeFormulas: true } });
  }
  const pptx = await import('@forgeoffice/pptx');
  const deck = await pptx.openPresentation(file.bytes, { password });
  if (target === 'odp') return pptx.writeOdp(deck);
  return pptx.writePptx(deck, { format: target as import('@forgeoffice/pptx').DeckFormat });
}

/** Decode une image (y compris SVG) avec le navigateur. */
async function decodeImage(file: NamedBytes): Promise<HTMLImageElement> {
  const type = extensionOf(file.name) === 'svg' ? 'image/svg+xml' : mimeOf(extensionOf(file.name));
  const url = URL.createObjectURL(new Blob([file.bytes.slice()], { type }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error(S.errors.canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function viaCanvas(file: NamedBytes, target: string, o: ConvertOptions): Promise<Uint8Array> {
  const { canvasBytes } = await import('./pdfjs.ts');
  const img = await decodeImage(file);
  const w0 = img.naturalWidth || 1024;
  const h0 = img.naturalHeight || 1024;
  // Redimension : une seule dimension donnee = proportions conservees.
  const w = o.width ?? (o.height ? Math.round((w0 * o.height) / h0) : w0);
  const h = o.height ?? (o.width ? Math.round((h0 * o.width) / w0) : h0);
  const quarter = o.rotation === 90 || o.rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = quarter ? h : w;
  canvas.height = quarter ? w : h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(S.errors.canvas);
  if (target === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((o.rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return canvasBytes(canvas, mimeOf(target), o.quality / 100);
}

async function pdfPages(file: NamedBytes, target: 'png' | 'jpg', o: ConvertOptions): Promise<NamedBytes[]> {
  const { openPdf, renderPage, canvasBytes } = await import('./pdfjs.ts');
  const pdf = await openPdf(file.bytes);
  const out: NamedBytes[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = await renderPage(await pdf.getPage(i), 150 / 72, o.rotation);
      out.push({ name: `${stem(file.name)}-page-${i}.${target}`, bytes: await canvasBytes(canvas, mimeOf(target), o.quality / 100) });
    }
  } finally {
    await pdf.loadingTask.destroy();
  }
  return out;
}

async function pdfText(file: NamedBytes): Promise<Uint8Array> {
  const { openPdf, pageText } = await import('./pdfjs.ts');
  const pdf = await openPdf(file.bytes);
  try {
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) parts.push(await pageText(await pdf.getPage(i)));
    return new TextEncoder().encode(parts.join('\n\f'));
  } finally {
    await pdf.loadingTask.destroy();
  }
}

/** Image en PNG ou JPEG embarquable par pdf-lib (les autres formats passent par le canvas). */
async function embeddable(file: NamedBytes, o: ConvertOptions): Promise<{ bytes: Uint8Array; kind: ImageKind }> {
  const ext = extensionOf(file.name);
  const plain = o.width === null && o.height === null && o.rotation === 0;
  if (plain && ext === 'png') return { bytes: file.bytes, kind: 'png' };
  if (plain && (ext === 'jpg' || ext === 'jpeg')) return { bytes: file.bytes, kind: 'jpg' };
  return { bytes: await viaCanvas(file, 'png', o), kind: 'png' };
}

/** Plusieurs images dans un seul PDF (une image par page). */
export async function imagesToOnePdf(files: readonly NamedBytes[], o: ConvertOptions = DEFAULT_OPTIONS): Promise<Uint8Array> {
  const list = [];
  for (const f of files) list.push(await embeddable(f, o));
  return imagesToPdf(list);
}

/** Convertit un fichier ; renvoie un ou plusieurs fichiers produits (PDF en images : une image par page). */
export async function convertFile(
  file: NamedBytes, target: string, engine: Engine, outName: string, native: NativeBridge | null, o: ConvertOptions, password?: string,
): Promise<NamedBytes[]> {
  switch (engine) {
    case 'tableur':
      if (o.allSheets && (target === 'csv' || target === 'tsv')) return sheetsToCsv(file, target, outName, password);
      return [{ name: outName, bytes: await viaSuite(engine, file, target, password) }];
    case 'texte':
    case 'presentation':
      return [{ name: outName, bytes: await viaSuite(engine, file, target, password) }];
    case 'diaporama-pdf': {
      // « Office fidele » (LibreOffice) reste prioritaire quand il est demande et disponible.
      if (o.highFidelity && native) return convertFile(file, target, 'native', outName, native, o, password);
      return [{ name: outName, bytes: await viaDiaporamaPdf(file, password) }];
    }
    case 'extraire':
      return [{ name: outName, bytes: await viaExtraction(file, target, password) }];
    case 'donnees':
      return [{ name: outName, bytes: await viaDonnees(file, target, password) }];
    case 'canvas':
      return [{ name: outName, bytes: await viaCanvas(file, target, o) }];
    case 'images-pdf':
      return [{ name: outName, bytes: await imagesToOnePdf([file], o) }];
    case 'pdf-images':
      return pdfPages(file, target === 'jpg' ? 'jpg' : 'png', o);
    case 'pdf-texte':
      return [{ name: outName, bytes: await pdfText(file) }];
    case 'native': {
      if (!native) throw new Error(S.needDesktop);
      const options = {
        qualite: o.quality, largeur: o.width, hauteur: o.height, rotation: o.rotation || null, haute_fidelite: o.highFidelity,
      };
      const op = { op: 'convertir', entree: input(0), vers: target, options, sortie: outputTarget(outName) };
      return (await runBytes(native, op, [file])).files;
    }
  }
}
