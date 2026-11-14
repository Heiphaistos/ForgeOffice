// Champ image du publipostage : une image de la page est liee a un champ de la source ; a la fusion, elle est remplacee par l'image
// dont le nom (avec ou sans extension) est la valeur du champ. Les images viennent d'un ZIP choisi par l'utilisateur (session en cours).
import JSZip from 'jszip';
import { PackageError, readEntry, type PackageLimits } from '@forgeoffice/opc';
import type { Deck, MediaItem, Slide } from '@forgeoffice/pptx';
import { shapeKey } from './model.ts';

export interface MergeImage {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
}

export type ImageBank = Map<string, MergeImage>;

const TYPES: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
export const MAX_IMAGES = 500;
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
/** Taille decompressee totale lue dans le ZIP d'images (anti bombe de decompression). */
export const MAX_ZIP_BYTES = 512 * 1024 * 1024;
const ZIP_LIMITS: PackageLimits = { maxEntries: 20_000, maxEntryBytes: MAX_IMAGE_BYTES, maxTotalBytes: MAX_ZIP_BYTES };

const baseOf = (name: string): string => (name.split(/[\\/]/).pop() ?? name).toLowerCase();
const stemOf = (name: string): string => baseOf(name).replace(/\.[a-z0-9]+$/, '');

/** Images d'un ZIP (sous-dossiers acceptes) indexees par nom de fichier ; les autres formats sont ignores. */
export async function readImageZip(bytes: Uint8Array): Promise<ImageBank> {
  const zip = await JSZip.loadAsync(bytes);
  const bank: ImageBank = new Map();
  const budget = { left: MAX_ZIP_BYTES };
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || bank.size >= MAX_IMAGES) continue;
    const extension = baseOf(entry.name).match(/\.([a-z0-9]+)$/)?.[1] ?? '';
    const contentType = TYPES[extension];
    if (!contentType) continue;
    // Lecture par flux plafonnee : une entree qui depasse MAX_IMAGE_BYTES est ignoree sans etre decompressee en entier.
    let data: Uint8Array;
    try {
      data = await readEntry(entry, budget, ZIP_LIMITS);
    } catch (error) {
      if (!(error instanceof PackageError)) throw error;
      if (budget.left < 0) throw new PackageError("Le ZIP d'images est trop volumineux une fois décompressé.");
      continue;
    }
    bank.set(baseOf(entry.name), { bytes: data, contentType, extension });
  }
  return bank;
}

/** Image dont le nom est la valeur du champ (avec ou sans extension, casse ignoree). */
export function imageFor(bank: ImageBank, value: string): MergeImage | undefined {
  const wanted = baseOf(value.trim());
  if (!wanted) return undefined;
  const direct = bank.get(wanted);
  if (direct) return direct;
  for (const [name, image] of bank) if (stemOf(name) === stemOf(wanted)) return image;
  return undefined;
}

export interface ImageFieldResult {
  /** Valeurs sans image dans le ZIP (pour le message d'erreur). */
  missing: string[];
}

/**
 * Remplace, dans la page fusionnee `copy` (copie de la page `originalId`), les images liees a un champ par l'image de l'enregistrement.
 * Les nouvelles images sont ajoutees a `media` (identifiants uniques) ; une image introuvable garde l'image d'origine.
 */
export function applyImageFields(
  copy: Slide, originalId: number, imageFields: Readonly<Record<string, string>>, fields: readonly string[], record: readonly string[],
  bank: ImageBank, media: Record<string, MediaItem>,
): ImageFieldResult {
  const missing: string[] = [];
  for (const shape of copy.shapes) {
    if (shape.kind !== 'picture') continue;
    const field = imageFields[shapeKey(originalId, shape.id)];
    const i = field === undefined ? -1 : fields.indexOf(field);
    if (i < 0) continue;
    const value = (record[i] ?? '').trim();
    const image = imageFor(bank, value);
    if (!image) {
      if (value) missing.push(value);
      continue;
    }
    let n = Object.keys(media).length + 1;
    while (`mergeimg${n}` in media) n++;
    const id = `mergeimg${n}`;
    media[id] = { id, contentType: image.contentType, extension: image.extension, bytes: image.bytes };
    shape.mediaId = id;
  }
  return { missing };
}

/** Champs de la source sans image associee : pour avertir avant la fusion. */
export function unmatchedImages(deck: Deck, imageFields: Readonly<Record<string, string>>, fields: readonly string[], records: readonly (readonly string[])[], bank: ImageBank): string[] {
  const out = new Set<string>();
  for (const slide of deck.slides) {
    for (const shape of slide.shapes) {
      const field = shape.kind === 'picture' ? imageFields[shapeKey(slide.id, shape.id)] : undefined;
      const i = field === undefined ? -1 : fields.indexOf(field);
      if (i < 0) continue;
      for (const r of records) {
        const v = (r[i] ?? '').trim();
        if (v && !imageFor(bank, v)) out.add(v);
      }
    }
  }
  return [...out];
}
