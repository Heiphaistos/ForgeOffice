// Format Presentation : modele, lecture/ecriture .pptx/.pptm/.potx/.ppsx, lecture .odp et .ppt.
import type { Deck } from './model.ts';
import { readPptx, PresentationError } from './pptx-read.ts';
import { readOdp } from './odp.ts';
import { readPpt } from './ppt.ts';
import { STRINGS } from './strings.ts';

export * from './model.ts';
export * from './chart.ts';
export * from './units.ts';
export * from './color.ts';
export * from './theme.ts';
export * from './blank.ts';
export * from './edit.ts';
export * from './inherit.ts';
export * from './strings.ts';
export { readPptx, PresentationError } from './pptx-read.ts';
export { writePptx, type WriteOptions } from './pptx-write.ts';
export { readOdp } from './odp.ts';
export { readPpt } from './ppt.ts';
export { readChart } from './chart-read.ts';
export { writeChart, buildChartWorkbook } from './chart-write.ts';
export { readAnimations, writeTiming, readTransition, writeTransition } from './anim.ts';

/** Extensions ouvertes par le module Presentation (la premiere est le format natif). */
export const PRESENTATION_EXTENSIONS = ['pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm', 'odp', 'ppt', 'pps', 'pot'] as const;

/** Extensions d'enregistrement OOXML. */
export const SAVE_EXTENSIONS = ['pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm'] as const;

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean => signature.every((b, i) => bytes[i] === b);

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const CFB = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** Indique si un zip est un document OpenDocument (fichier « mimetype » en tete). */
function isOdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(30, 120));
  return head.startsWith('mimetype') && head.includes('application/vnd.oasis.opendocument');
}

/** Ouvre une presentation d'apres son contenu (signature), quel que soit son nom. */
export async function openPresentation(bytes: Uint8Array): Promise<Deck> {
  if (startsWith(bytes, ZIP)) return isOdf(bytes) ? readOdp(bytes) : readPptx(bytes);
  if (startsWith(bytes, CFB)) return readPpt(bytes);
  throw new PresentationError(STRINGS.errors.notPresentation);
}
