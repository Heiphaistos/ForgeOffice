// Analyseur et serialiseur XML minimal pour OOXML. Garde les prefixes tels quels (« w:p »),
// conserve les espaces du texte, refuse les DOCTYPE (pas d'entites externes, pas de bombe d'entites).

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export type XmlNode = XmlElement | string;

export class XmlError extends Error {}

/** `target.push(...items)` sans limite d'arguments (un spread de ~100 000 elements depasse la pile : RangeError). */
export function pushAll<T>(target: T[], items: readonly T[]): void {
  for (const item of items) target.push(item);
}

const ENTITIES: Readonly<Record<string, string>> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeEntities(raw: string): string {
  if (!raw.includes('&')) return raw;
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, ref: string) => {
    if (ref.startsWith('#x')) return safeCodePoint(Number.parseInt(ref.slice(2), 16), whole);
    if (ref.startsWith('#')) return safeCodePoint(Number.parseInt(ref.slice(1), 10), whole);
    return ENTITIES[ref] ?? whole;
  });
}

function safeCodePoint(code: number, fallback: string): string {
  return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
}

// Expressions collantes (y) : String.match respecte lastIndex et le met a jour.
const NAME_RE = /[^\s/>=]+/y;
const ATTR_RE = /\s*([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/y;

/** Profondeur maximale d'imbrication (libxml2 : 256) : au-dela, les lecteurs recursifs depasseraient la pile. */
export const MAX_XML_DEPTH = 256;

/** Analyse un document XML et renvoie l'element racine. */
export function parseXml(source: string): XmlElement {
  let pos = 0;
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;

  const append = (node: XmlNode): void => {
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
  };

  while (pos < text.length) {
    const lt = text.indexOf('<', pos);
    if (lt < 0) {
      if (stack.length && pos < text.length) append(decodeEntities(text.slice(pos)));
      break;
    }
    if (lt > pos && stack.length) append(decodeEntities(text.slice(pos, lt)));

    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      if (end < 0) throw new XmlError('Commentaire non termine');
      pos = end + 3;
    } else if (text.startsWith('<![CDATA[', lt)) {
      const end = text.indexOf(']]>', lt + 9);
      if (end < 0) throw new XmlError('CDATA non termine');
      append(text.slice(lt + 9, end));
      pos = end + 3;
    } else if (text.startsWith('<?', lt)) {
      const end = text.indexOf('?>', lt + 2);
      if (end < 0) throw new XmlError('Instruction non terminee');
      pos = end + 2;
    } else if (text.startsWith('<!', lt)) {
      throw new XmlError('DOCTYPE refuse');
    } else if (text.startsWith('</', lt)) {
      const end = text.indexOf('>', lt + 2);
      if (end < 0) throw new XmlError('Balise fermante non terminee');
      const name = text.slice(lt + 2, end).trim();
      const open = stack.pop();
      if (!open || open.name !== name) throw new XmlError(`Balise fermante inattendue : ${name}`);
      if (stack.length === 0) root = open;
      pos = end + 1;
    } else {
      NAME_RE.lastIndex = lt + 1;
      const nameMatch = text.match(NAME_RE);
      if (!nameMatch) throw new XmlError(`Nom de balise invalide a ${lt}`);
      const element: XmlElement = { name: nameMatch[0], attrs: {}, children: [] };
      let cursor = NAME_RE.lastIndex;
      for (;;) {
        ATTR_RE.lastIndex = cursor;
        const found = text.match(ATTR_RE);
        if (!found) break;
        element.attrs[found[1] ?? ''] = decodeEntities(found[3] ?? found[4] ?? '');
        cursor = ATTR_RE.lastIndex;
      }
      while (cursor < text.length && /\s/.test(text.charAt(cursor))) cursor++;
      const selfClosing = text.startsWith('/>', cursor);
      if (!selfClosing && text.charAt(cursor) !== '>') throw new XmlError(`Balise mal formee : ${element.name}`);
      append(element);
      if (selfClosing) {
        if (stack.length === 0) root = element;
        pos = cursor + 2;
      } else {
        if (stack.length >= MAX_XML_DEPTH) throw new XmlError('Document XML trop profondément imbriqué');
        stack.push(element);
        pos = cursor + 1;
      }
    }
    if (root && stack.length === 0) break;
  }
  if (!root) throw new XmlError('Document XML vide ou non termine');
  return root;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;').replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}

// Caracteres interdits en XML 1.0 (controle sauf tab, LF, CR) : retires a l'ecriture.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function serializeNode(node: XmlNode, out: string[]): void {
  if (typeof node === 'string') {
    out.push(escapeText(node.replace(INVALID_XML_CHARS, '')));
    return;
  }
  out.push('<', node.name);
  for (const [key, value] of Object.entries(node.attrs)) {
    out.push(' ', key, '="', escapeAttr(value.replace(INVALID_XML_CHARS, '')), '"');
  }
  if (node.children.length === 0) {
    out.push('/>');
    return;
  }
  out.push('>');
  for (const item of node.children) serializeNode(item, out);
  out.push('</', node.name, '>');
}

/** Serialise avec l'en-tete standard OOXML. */
export function serializeXml(root: XmlElement): string {
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'];
  serializeNode(root, out);
  return out.join('');
}

// ---- Aides de lecture / construction ----

/** Construit un element. Les attributs `undefined` sont omis. */
export function el(name: string, attrs: Record<string, string | number | boolean | undefined> = {}, kids: XmlNode[] = []): XmlElement {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) clean[key] = String(value);
  }
  return { name, attrs: clean, children: kids };
}

export function isElement(node: XmlNode | undefined): node is XmlElement {
  return typeof node === 'object' && node !== null;
}

/** Premier enfant direct portant ce nom. */
export function child(parent: XmlElement | undefined, name: string): XmlElement | undefined {
  if (!parent) return undefined;
  for (const node of parent.children) {
    if (isElement(node) && node.name === name) return node;
  }
  return undefined;
}

/** Enfants directs portant ce nom (tous les elements si `name` est omis). */
export function children(parent: XmlElement | undefined, name?: string): XmlElement[] {
  if (!parent) return [];
  return parent.children.filter((n): n is XmlElement => isElement(n) && (name === undefined || n.name === name));
}

/** Chemin d'enfants : path(root, 'w:body', 'w:sectPr'). */
export function path(parent: XmlElement | undefined, ...names: string[]): XmlElement | undefined {
  let current = parent;
  for (const name of names) current = child(current, name);
  return current;
}

export function attr(element: XmlElement | undefined, name: string): string | undefined {
  return element?.attrs[name];
}

export function numAttr(element: XmlElement | undefined, name: string): number | undefined {
  const raw = element?.attrs[name];
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Valeur booleenne OOXML (« 1 », « true », « on » ; element present sans valeur = vrai). */
export function boolAttr(element: XmlElement | undefined, name = 'w:val'): boolean | undefined {
  if (!element) return undefined;
  const raw = element.attrs[name];
  if (raw === undefined) return true;
  return raw === '1' || raw === 'true' || raw === 'on';
}

/** Texte concatene de tous les descendants. */
export function textOf(node: XmlNode | undefined): string {
  if (node === undefined) return '';
  if (typeof node === 'string') return node;
  return node.children.map(textOf).join('');
}

/** Parcourt tous les descendants (profondeur d'abord). */
export function* descendants(root: XmlElement, name?: string): Generator<XmlElement> {
  for (const node of root.children) {
    if (!isElement(node)) continue;
    if (name === undefined || node.name === name) yield node;
    yield* descendants(node, name);
  }
}
