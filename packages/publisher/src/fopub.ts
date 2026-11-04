// Format natif .fopub : paquet OPC d'une presentation (writePptx / readPptx) + partie « publication.json » (reglages
// de la publication). Renomme en .pptx, le fichier s'ouvre tel quel dans PowerPoint.
import JSZip from 'jszip';
import { OpcPackage } from '@forgeoffice/opc';
import { readPptx, writePptx, type Deck } from '@forgeoffice/pptx';
import { defaultSettings, parseSettings, serializeSettings, type PubSettings } from './model.ts';

export const SETTINGS_PART = 'publication.json';
const SETTINGS_TYPE = 'application/vnd.forgeoffice.publication+json';
const MAX_SETTINGS = 16 * 1024 * 1024;

export interface PubDocument {
  deck: Deck;
  pub: PubSettings;
}

export async function writeFopub(doc: PubDocument): Promise<Uint8Array> {
  const pptx = await writePptx({ ...doc.deck, format: 'pptx' }, { format: 'pptx' });
  const zip = await JSZip.loadAsync(pptx);
  const types = zip.file('[Content_Types].xml');
  if (types) {
    const xml = await types.async('string');
    if (!/Extension="json"/i.test(xml)) zip.file('[Content_Types].xml', xml.replace('<Default ', `<Default Extension="json" ContentType="${SETTINGS_TYPE}"/><Default `));
  }
  zip.file(SETTINGS_PART, serializeSettings(doc.pub));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/** Ouvre un .fopub ; un .pptx ordinaire (sans publication.json) donne les reglages par defaut. */
export async function readFopub(bytes: Uint8Array): Promise<PubDocument> {
  const pkg = await OpcPackage.open(bytes);
  let pub = defaultSettings();
  if (pkg.has(SETTINGS_PART)) {
    const raw = await pkg.readBytes(SETTINGS_PART);
    if (raw.length <= MAX_SETTINGS) pub = parseSettings(new TextDecoder().decode(raw));
  }
  const deck = await readPptx(bytes);
  return { deck, pub: dropDanglingRefs(deck, pub) };
}

/** Retire des reglages les references a des pages ou formes absentes (fichier modifie ailleurs). */
export function dropDanglingRefs(deck: Deck, pub: PubSettings): PubSettings {
  const exists = new Set<string>();
  for (const slide of deck.slides) for (const s of slide.shapes) exists.add(`${slide.id}:${s.id}`);
  const keep = <T>(rec: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(rec).filter(([k]) => exists.has(k)));
  const chains = pub.chains
    .map((c) => {
      const idx = c.boxes.map((b, i) => (exists.has(`${b.page}:${b.shape}`) ? i : -1)).filter((i) => i >= 0);
      return { ...c, boxes: idx.map((i) => c.boxes[i]!), joins: idx.slice(0, -1).map((i) => c.joins[i] === true), empty: idx.map((i) => c.empty[i] === true) };
    })
    .filter((c) => c.boxes.length >= 2);
  return { ...pub, wraps: keep(pub.wraps), dropCaps: keep(pub.dropCaps), chains };
}
