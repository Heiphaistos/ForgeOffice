// Paquets OPC (zip des formats Office) : lecture bornee et ecriture.
import JSZip from 'jszip';
import { attr, children, el, parseXml, serializeXml, type XmlElement } from './xml.ts';

export interface PackageLimits {
  /** Nombre maximal d'entrees du zip. */
  maxEntries: number;
  /** Taille decompressee maximale d'une entree, en octets. */
  maxEntryBytes: number;
  /** Taille decompressee totale maximale, en octets. */
  maxTotalBytes: number;
}

export const DEFAULT_LIMITS: PackageLimits = {
  maxEntries: 20_000,
  maxEntryBytes: 512 * 1024 * 1024,
  maxTotalBytes: 2 * 1024 * 1024 * 1024,
};

export class PackageError extends Error {}

export interface Relationship {
  id: string;
  type: string;
  /** Chemin de partie resolu (sans « / » initial) ou URL si `external`. */
  target: string;
  external: boolean;
}

/** Normalise un chemin de partie : sans « / » initial, sans « . » ni « .. ». Refuse toute sortie du paquet. */
export function normalizePartPath(raw: string): string {
  const pathOnly = raw.replace(/\\/g, '/').split('#')[0] ?? '';
  const parts: string[] = [];
  for (const segment of pathOnly.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) throw new PackageError(`Chemin hors du paquet : ${raw}`);
      parts.pop();
    } else {
      parts.push(decodeURIComponent(segment));
    }
  }
  return parts.join('/');
}

/** Resout la cible d'une relation par rapport a la partie source. */
export function resolveTarget(sourcePart: string, target: string): string {
  if (target.startsWith('/')) return normalizePartPath(target);
  const slash = sourcePart.lastIndexOf('/');
  const base = slash >= 0 ? sourcePart.slice(0, slash + 1) : '';
  return normalizePartPath(base + target);
}

/** Chemin du fichier de relations d'une partie (« word/document.xml » -> « word/_rels/document.xml.rels »). */
export function relsPathFor(partPath: string): string {
  const slash = partPath.lastIndexOf('/');
  return slash >= 0 ? `${partPath.slice(0, slash)}/_rels/${partPath.slice(slash + 1)}.rels` : `_rels/${partPath}.rels`;
}

// API publique de JSZip (lecture en flux, navigateur et Node) absente de ses declarations de types.
interface StreamHelper {
  on(event: 'data', listener: (chunk: Uint8Array) => void): StreamHelper;
  on(event: 'error', listener: (error: Error) => void): StreamHelper;
  on(event: 'end', listener: () => void): StreamHelper;
  pause(): StreamHelper;
  resume(): StreamHelper;
}

interface StreamableEntry {
  internalStream(type: 'uint8array'): StreamHelper;
}

function readEntry(entry: JSZip.JSZipObject, budget: { left: number }, limits: PackageLimits): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    const stream = (entry as unknown as StreamableEntry).internalStream('uint8array');
    stream.on('data', (chunk: Uint8Array) => {
      size += chunk.length;
      budget.left -= chunk.length;
      if (size > limits.maxEntryBytes || budget.left < 0) {
        stream.pause();
        reject(new PackageError(`Fichier trop volumineux une fois decompresse : ${entry.name}`));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', (error: Error) => reject(new PackageError(`Entree illisible ${entry.name} : ${error.message}`)));
    stream.on('end', () => {
      const out = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(out);
    });
    stream.resume();
  });
}

export class OpcPackage {
  private readonly cache = new Map<string, Uint8Array>();
  private readonly decoder = new TextDecoder('utf-8');
  private readonly budget: { left: number };
  private readonly entries: Map<string, JSZip.JSZipObject>;
  private readonly limits: PackageLimits;
  private overrides = new Map<string, string>();
  private defaults = new Map<string, string>();

  private constructor(entries: Map<string, JSZip.JSZipObject>, limits: PackageLimits) {
    this.entries = entries;
    this.limits = limits;
    this.budget = { left: limits.maxTotalBytes };
  }

  static async open(bytes: Uint8Array, limits: PackageLimits = DEFAULT_LIMITS): Promise<OpcPackage> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch (error) {
      throw new PackageError(`Fichier non reconnu (zip invalide) : ${(error as Error).message}`);
    }
    const entries = new Map<string, JSZip.JSZipObject>();
    zip.forEach((relative, entry) => {
      if (!entry.dir) entries.set(normalizePartPath(relative).toLowerCase(), entry);
    });
    if (entries.size > limits.maxEntries) throw new PackageError('Trop de fichiers dans le paquet');
    const pkg = new OpcPackage(entries, limits);
    if (pkg.has('[Content_Types].xml')) {
      const types = await pkg.readXml('[Content_Types].xml');
      for (const node of children(types, 'Default')) {
        pkg.defaults.set((attr(node, 'Extension') ?? '').toLowerCase(), attr(node, 'ContentType') ?? '');
      }
      for (const node of children(types, 'Override')) {
        pkg.overrides.set(normalizePartPath(attr(node, 'PartName') ?? '').toLowerCase(), attr(node, 'ContentType') ?? '');
      }
    }
    return pkg;
  }

  /** Chemins des parties (casse d'origine perdue : comparaison insensible a la casse, comme Office). */
  paths(): string[] {
    return [...this.entries.keys()];
  }

  has(partPath: string): boolean {
    return this.entries.has(normalizePartPath(partPath).toLowerCase());
  }

  contentType(partPath: string): string | undefined {
    const key = normalizePartPath(partPath).toLowerCase();
    const override = this.overrides.get(key);
    if (override) return override;
    const dot = key.lastIndexOf('.');
    return dot >= 0 ? this.defaults.get(key.slice(dot + 1)) : undefined;
  }

  /** Premiere partie dont le type de contenu commence par `prefix`. */
  findByContentType(prefix: string): string | undefined {
    for (const [part, type] of this.overrides) if (type.startsWith(prefix)) return part;
    return undefined;
  }

  async readBytes(partPath: string): Promise<Uint8Array> {
    const key = normalizePartPath(partPath).toLowerCase();
    const cached = this.cache.get(key);
    if (cached) return cached;
    const entry = this.entries.get(key);
    if (!entry) throw new PackageError(`Partie absente : ${partPath}`);
    const bytes = await readEntry(entry, this.budget, this.limits);
    this.cache.set(key, bytes);
    return bytes;
  }

  async readText(partPath: string): Promise<string> {
    return this.decoder.decode(await this.readBytes(partPath));
  }

  async readXml(partPath: string): Promise<XmlElement> {
    return parseXml(await this.readText(partPath));
  }

  /** Relations de la partie (« » pour les relations du paquet). Liste vide si aucune. */
  async relationships(partPath: string): Promise<Relationship[]> {
    const relsPath = partPath === '' ? '_rels/.rels' : relsPathFor(normalizePartPath(partPath));
    if (!this.has(relsPath)) return [];
    const root = await this.readXml(relsPath);
    return children(root, 'Relationship').map((node) => {
      const external = attr(node, 'TargetMode') === 'External';
      const target = attr(node, 'Target') ?? '';
      return {
        id: attr(node, 'Id') ?? '',
        type: attr(node, 'Type') ?? '',
        target: external ? target : resolveTarget(partPath, target),
        external,
      };
    });
  }

  /** Cible de la premiere relation dont le type se termine par `typeSuffix` (ex. « /officeDocument »). */
  async relatedPart(partPath: string, typeSuffix: string): Promise<string | undefined> {
    const rels = await this.relationships(partPath);
    return rels.find((r) => !r.external && r.type.endsWith(typeSuffix))?.target;
  }
}

interface PendingRel {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

/** Construit un paquet OPC : parties, types de contenu, relations. */
export class PackageWriter {
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

  /** Ajoute une partie XML ; `contentType` devient un Override. */
  addXml(partPath: string, root: XmlElement, contentType?: string): void {
    this.addBytes(partPath, this.encoder.encode(serializeXml(root)), contentType);
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
  addRelationship(sourcePart: string, type: string, target: string, external = false, id?: string): string {
    const list = this.rels.get(sourcePart) ?? [];
    const relId = id ?? `rId${list.length + 1}`;
    list.push({ id: relId, type, target, external });
    this.rels.set(sourcePart, list);
    return relId;
  }

  async build(): Promise<Uint8Array> {
    const zip = new JSZip();
    const types = el('Types', { xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types' });
    for (const [extension, type] of this.defaults) types.children.push(el('Default', { Extension: extension, ContentType: type }));
    for (const [part, type] of this.overrides) types.children.push(el('Override', { PartName: `/${part}`, ContentType: type }));
    zip.file('[Content_Types].xml', serializeXml(types));
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
      zip.file(source === '' ? '_rels/.rels' : relsPathFor(source), serializeXml(root));
    }
    for (const [part, bytes] of this.parts) zip.file(part, bytes);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }
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
