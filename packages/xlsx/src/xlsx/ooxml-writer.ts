// Construction du paquet OOXML du classeur : meme contrat que PackageWriter (@forgeoffice/opc) mais
// compression native via buildZip (4 a 10 fois plus rapide que JSZip sur les grosses feuilles).
import { el, normalizePartPath, relsPathFor, serializeXml, type XmlElement } from '@forgeoffice/opc';
import { buildZip, type ZipEntry } from '../zip.ts';

interface PendingRel {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

/** Cible relative ecrite dans un .rels : relative au dossier de la source. */
function relativeTarget(sourcePart: string, targetPart: string): string {
  if (sourcePart === '') return targetPart;
  const from = sourcePart.split('/').slice(0, -1);
  const to = targetPart.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  return [...from.slice(common).map(() => '..'), ...to.slice(common)].join('/');
}

export class OoxmlWriter {
  private readonly parts = new Map<string, Uint8Array>();
  private readonly overrides = new Map<string, string>();
  private readonly defaults = new Map<string, string>([
    ['rels', 'application/vnd.openxmlformats-package.relationships+xml'],
    ['xml', 'application/xml'],
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
    ['jpg', 'image/jpeg'],
    ['gif', 'image/gif'],
    ['bmp', 'image/bmp'],
    ['svg', 'image/svg+xml'],
    ['emf', 'image/x-emf'],
    ['wmf', 'image/x-wmf'],
    ['tiff', 'image/tiff'],
  ]);
  private readonly rels = new Map<string, PendingRel[]>();
  private readonly encoder = new TextEncoder();

  addXml(partPath: string, root: XmlElement, contentType?: string): void {
    this.addBytes(partPath, this.encoder.encode(serializeXml(root)), contentType);
  }

  addText(partPath: string, text: string, contentType?: string): void {
    this.addBytes(partPath, this.encoder.encode(text), contentType);
  }

  addBytes(partPath: string, bytes: Uint8Array, contentType?: string): void {
    const key = normalizePartPath(partPath);
    this.parts.set(key, bytes);
    if (contentType) this.overrides.set(key, contentType);
  }

  setDefault(extension: string, contentType: string): void {
    this.defaults.set(extension.toLowerCase(), contentType);
  }

  /** Ajoute une relation depuis `sourcePart` (« » = paquet) et renvoie son identifiant (rId1, rId2...). */
  addRelationship(sourcePart: string, type: string, target: string, external = false): string {
    const list = this.rels.get(sourcePart) ?? [];
    const id = `rId${list.length + 1}`;
    list.push({ id, type, target, external });
    this.rels.set(sourcePart, list);
    return id;
  }

  async build(): Promise<Uint8Array> {
    const entries: ZipEntry[] = [];
    const types = el('Types', { xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types' });
    for (const [extension, type] of this.defaults) types.children.push(el('Default', { Extension: extension, ContentType: type }));
    for (const [part, type] of this.overrides) types.children.push(el('Override', { PartName: `/${part}`, ContentType: type }));
    entries.push({ path: '[Content_Types].xml', data: this.encoder.encode(serializeXml(types)) });
    for (const [source, list] of this.rels) {
      const root = el('Relationships', { xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships' });
      for (const rel of list) {
        root.children.push(el('Relationship', {
          Id: rel.id,
          Type: rel.type,
          Target: rel.external ? rel.target : relativeTarget(source, rel.target),
          TargetMode: rel.external ? 'External' : undefined,
        }));
      }
      entries.push({ path: source === '' ? '_rels/.rels' : relsPathFor(source), data: this.encoder.encode(serializeXml(root)) });
    }
    for (const [part, bytes] of this.parts) entries.push({ path: part, data: bytes });
    return buildZip(entries);
  }
}
