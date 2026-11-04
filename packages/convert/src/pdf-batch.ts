// Outils PDF par lots du Convertisseur (repris de la fenetre « Lots » de ForgePDF) : TypeScript quand c'est
// possible (fusion, rotation, filigrane, numerotation), moteur natif sinon (compression, mot de passe, PDF/A, OCR).
import type { NativeBridge } from '@forgeoffice/core';
import { input, outputTarget, runBytes, type NamedBytes } from './native.ts';
import { merge, rotate, stampPages, watermark } from './pdf-ops.ts';
import { S } from './strings.ts';

export type PdfTool = 'merge' | 'rotate' | 'watermark' | 'numbering' | 'compress' | 'protect' | 'pdfa' | 'ocr';

export type CompressLevel = 'sans_perte' | 'ecran' | 'ebook' | 'impression';
export type OcrLang = 'fra' | 'eng' | 'fra+eng';

export interface ToolParams {
  text: string;
  prefix: string;
  start: number;
  digits: number;
  password: string;
  owner: string;
  level: CompressLevel;
  lang: OcrLang;
  force: boolean;
}

export const DEFAULT_PARAMS: ToolParams = {
  text: S.dialogs.watermarkDefault, prefix: '', start: 1, digits: 0, password: '', owner: '', level: 'ebook', lang: 'fra', force: false,
};

/** Operation forge-convert requise (pour griser l'outil d'apres `capacites`) ; null = TypeScript. */
export const NATIVE_OPERATION: Readonly<Record<PdfTool, string | null>> = {
  merge: null, rotate: null, watermark: null, numbering: null, compress: 'compresser', protect: 'chiffrer', pdfa: 'pdf_a', ocr: 'ocr',
};

export const TOOL_LABELS: Readonly<Record<PdfTool, string>> = {
  merge: S.merge, rotate: S.rotate, watermark: S.watermark, numbering: S.numbering, compress: S.compress, protect: S.protect, pdfa: S.pdfa, ocr: S.ocr,
};

const suffix = (name: string, tag: string): string => `${name.replace(/\.pdf$/i, '')}-${tag}.pdf`;

async function single(native: NativeBridge | null, file: NamedBytes, op: Record<string, unknown>, outName: string): Promise<NamedBytes> {
  if (!native) throw new Error(S.needDesktop);
  const res = await runBytes(native, { op: 'pdf', entree: input(0), sortie: outputTarget(outName), ...op }, [file]);
  const out = res.files[0];
  if (!out) throw new Error(S.errors.frame);
  return out;
}

async function nativeFile(native: NativeBridge | null, file: NamedBytes, op: Record<string, unknown> & { op: string }, outName: string): Promise<NamedBytes> {
  if (!native) throw new Error(S.needDesktop);
  const out = (await runBytes(native, { ...op, entree: input(0), sortie: outputTarget(outName) }, [file])).files[0];
  if (!out) throw new Error(S.errors.frame);
  return out;
}

/** Applique un outil a une liste de PDF ; renvoie les fichiers produits (un seul pour la fusion). */
export async function runPdfTool(tool: PdfTool, files: readonly NamedBytes[], p: ToolParams, native: NativeBridge | null): Promise<NamedBytes[]> {
  if (tool === 'merge') return [{ name: S.mergeName, bytes: await merge(files.map((f) => f.bytes)) }];
  const out: NamedBytes[] = [];
  for (const f of files) {
    switch (tool) {
      case 'rotate':
        out.push({ name: suffix(f.name, 'pivote'), bytes: await rotate(f.bytes, 90) });
        break;
      case 'watermark':
        out.push({ name: suffix(f.name, 'filigrane'), bytes: await watermark(f.bytes, { text: p.text, size: 60, opacity: 0.25, angle: 45, color: { r: 0.5, g: 0.5, b: 0.5 } }) });
        break;
      case 'numbering':
        out.push({
          name: suffix(f.name, 'numerote'),
          bytes: await stampPages(f.bytes, { template: `${p.prefix}{page}`, position: 'bas_droite', size: 10, start: p.start, digits: p.digits, margin: 24, color: { r: 0, g: 0, b: 0 } }),
        });
        break;
      case 'compress':
        out.push(await single(native, f, { actions: [{ action: 'compresser', niveau: p.level }] }, suffix(f.name, 'compresse')));
        break;
      case 'protect':
        out.push(await single(native, f, { actions: [{ action: 'chiffrer', utilisateur: p.password, proprietaire: p.owner }] }, suffix(f.name, 'protege')));
        break;
      case 'pdfa':
        out.push(await nativeFile(native, f, { op: 'pdf_a' }, suffix(f.name, 'pdfa')));
        break;
      case 'ocr':
        out.push(await nativeFile(native, f, { op: 'ocr', langue: p.lang, forcer: p.force }, suffix(f.name, 'ocr')));
        break;
    }
  }
  return out;
}
