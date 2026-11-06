// Format Presentation : modele, lecture/ecriture .pptx/.pptm/.potx/.ppsx, lecture .odp et .ppt.
import { decryptOoxml, EncryptedOoxmlError, isEncryptedOoxml } from '@forgeoffice/opc';
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
export { withMetafilePreview, displayMedia } from './metafile-preview.ts';
export * from './table-styles.ts';
export { readSmartArtNodes, setSmartArtNodeText } from './smartart.ts';
export * from './inherit.ts';
export * from './strings.ts';
export { readPptx, PresentationError } from './pptx-read.ts';
export { writePptx, type WriteOptions } from './pptx-write.ts';
export { readOdp } from './odp.ts';
export { writeOdp } from './odp-write.ts';
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

/** Presentation chiffree : `reason` vaut « required » (mot de passe a demander) ou « wrong » (mot de passe refuse). */
export class PresentationPasswordError extends PresentationError {
  readonly reason: 'required' | 'wrong';
  constructor(reason: 'required' | 'wrong') {
    super(reason === 'required' ? STRINGS.errors.passwordRequired : STRINGS.errors.wrongPassword);
    this.reason = reason;
  }
}

/**
 * Ouvre une presentation d'apres son contenu (signature), quel que soit son nom.
 * Un .pptx chiffre (conteneur « EncryptedPackage ») demande `options.password`.
 */
export async function openPresentation(bytes: Uint8Array, options: { password?: string } = {}): Promise<Deck> {
  if (isEncryptedOoxml(bytes)) {
    if (options.password === undefined) throw new PresentationPasswordError('required');
    try {
      return readPptx(await decryptOoxml(bytes, options.password));
    } catch (error) {
      if (error instanceof EncryptedOoxmlError) throw error.kind === 'password' ? new PresentationPasswordError('wrong') : new PresentationError(error.message);
      throw error;
    }
  }
  if (startsWith(bytes, ZIP)) return isOdf(bytes) ? readOdp(bytes) : readPptx(bytes);
  if (startsWith(bytes, CFB)) return readPpt(bytes);
  throw new PresentationError(STRINGS.errors.notPresentation);
}
