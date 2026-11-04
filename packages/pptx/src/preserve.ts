// Conservation des parties non modelisees (SmartArt, OLE, encre, classeurs de graphiques) : lecture et reecriture.
import { isElement, type OpcPackage, type PackageWriter, type Relationship, type XmlElement } from '@forgeoffice/opc';
import type { PreservedPart, PreservedRel, RawXml } from './model.ts';
import { cloneXml, extensionOf, MEDIA_TYPES, NS, usedPrefixes } from './xmlns.ts';

/** Profondeur maximale de relations suivies (evite les boucles et les paquets piegés). */
const MAX_DEPTH = 6;
const STRUCTURAL = /\/(slide|slideLayout|slideMaster|notesSlide|notesMaster|handoutMaster|officeDocument)$/;

/** Identifiants de relation references par un fragment (attributs r:*). */
export function referencedRelIds(node: XmlElement, out = new Set<string>()): Set<string> {
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key.startsWith('r:') && value) out.add(value);
  }
  for (const kid of node.children) if (isElement(kid)) referencedRelIds(kid, out);
  return out;
}

export class PartPreserver {
  private readonly pkg: OpcPackage;
  private readonly cache = new Map<string, PreservedPart>();

  constructor(pkg: OpcPackage) {
    this.pkg = pkg;
  }

  /** Partie conservee (avec ses relations, recursivement). Undefined si absente. */
  async part(path: string, depth = 0): Promise<PreservedPart | undefined> {
    const key = path.toLowerCase();
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (!this.pkg.has(path)) return undefined;
    const part: PreservedPart = {
      path,
      contentType: this.pkg.contentType(path) ?? MEDIA_TYPES[extensionOf(path)] ?? 'application/octet-stream',
      bytes: await this.pkg.readBytes(path),
      rels: [],
    };
    this.cache.set(key, part);
    if (depth < MAX_DEPTH) {
      for (const rel of await this.pkg.relationships(path)) {
        const preserved = await this.rel(rel, depth + 1);
        if (preserved) part.rels.push(preserved);
      }
    }
    return part;
  }

  async rel(rel: Relationship, depth = 0): Promise<PreservedRel | undefined> {
    if (rel.external) return { id: rel.id, type: rel.type, external: rel.target };
    // Les parties structurelles (diapositives, masques...) ne sont jamais dupliquees par un fragment conserve.
    if (STRUCTURAL.test(rel.type)) return undefined;
    const part = await this.part(rel.target, depth);
    return part ? { id: rel.id, type: rel.type, part } : undefined;
  }

  /** Fragment XML + relations qu'il reference ; `scope` = declarations d'espaces de noms de la racine d'origine. */
  async raw(xml: XmlElement, rels: readonly Relationship[], scope: Readonly<Record<string, string>> = {}): Promise<RawXml> {
    const ids = referencedRelIds(xml);
    const preserved: PreservedRel[] = [];
    for (const rel of rels) {
      if (!ids.has(rel.id)) continue;
      const kept = await this.rel(rel);
      if (kept) preserved.push(kept);
    }
    const copy = cloneXml(xml);
    // Les prefixes inconnus declares sur la racine d'origine sont reposes sur le fragment.
    for (const prefix of usedPrefixes(copy)) {
      const decl = `xmlns:${prefix}`;
      const uri = scope[decl];
      if (!NS[prefix] && uri !== undefined && copy.attrs[decl] === undefined) copy.attrs[decl] = uri;
    }
    return { xml: copy, rels: preserved };
  }
}

/** Attribution de chemins uniques dans le paquet ecrit. */
export class PathAllocator {
  private readonly used = new Set<string>();

  /** Reserve un chemin precis (parties generees). */
  reserve(path: string): string {
    this.used.add(path.toLowerCase());
    return path;
  }

  /** Chemin libre proche de `wanted` (dossier/nomN.ext). */
  allocate(wanted: string): string {
    if (!this.used.has(wanted.toLowerCase())) return this.reserve(wanted);
    const slash = wanted.lastIndexOf('/');
    const dir = wanted.slice(0, slash + 1);
    const file = wanted.slice(slash + 1);
    const dot = file.lastIndexOf('.');
    const stem = (dot >= 0 ? file.slice(0, dot) : file).replace(/\d+$/, '');
    const ext = dot >= 0 ? file.slice(dot) : '';
    for (let n = 1; ; n++) {
      const candidate = `${dir}${stem}${n}${ext}`;
      if (!this.used.has(candidate.toLowerCase())) return this.reserve(candidate);
    }
  }
}

/** Reecrit les parties conservees dans un paquet en construction. */
export class PartEmitter {
  private readonly writer: PackageWriter;
  private readonly paths: PathAllocator;
  private readonly written = new Map<PreservedPart, string>();

  constructor(writer: PackageWriter, paths: PathAllocator) {
    this.writer = writer;
    this.paths = paths;
  }

  /** Ecrit la partie (une seule fois) et renvoie son chemin. */
  emit(part: PreservedPart): string {
    const done = this.written.get(part);
    if (done) return done;
    const path = this.paths.allocate(part.path);
    this.written.set(part, path);
    this.writer.addBytes(path, part.bytes, part.contentType);
    for (const rel of part.rels) {
      if (rel.external !== undefined) this.writer.addRelationship(path, rel.type, rel.external, true, rel.id);
      else if (rel.part) this.writer.addRelationship(path, rel.type, this.emit(rel.part), false, rel.id);
    }
    return path;
  }

  /** Chemin ecrit d'une partie conservee (si deja ecrite). */
  pathOf(part: PreservedPart): string | undefined {
    return this.written.get(part);
  }

  /** Copie un fragment conserve : ses relations sont recreees dans la partie courante et ses r:* renumerotes. */
  emitRaw(raw: RawXml, addRel: (type: string, target: string, external: boolean) => string): { xml: XmlElement; mapping: Map<string, string> } {
    const mapping = new Map<string, string>();
    for (const rel of raw.rels) {
      if (rel.external !== undefined) mapping.set(rel.id, addRel(rel.type, rel.external, true));
      else if (rel.part) mapping.set(rel.id, addRel(rel.type, this.emit(rel.part), false));
    }
    const xml = cloneXml(raw.xml);
    const rewrite = (node: XmlElement): void => {
      for (const [key, value] of Object.entries(node.attrs)) {
        if (key.startsWith('r:')) {
          const mapped = mapping.get(value);
          if (mapped) node.attrs[key] = mapped;
        }
      }
      for (const kid of node.children) if (isElement(kid)) rewrite(kid);
    };
    rewrite(xml);
    return { xml, mapping };
  }
}
