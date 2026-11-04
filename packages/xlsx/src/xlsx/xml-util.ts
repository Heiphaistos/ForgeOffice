// Aides XML insensibles au prefixe (« x:c » et « c » sont equivalents) pour les parties SpreadsheetML.
import { el, isElement, textOf, type XmlElement, type XmlNode } from '@forgeoffice/opc';

export function localName(name: string): string {
  const colon = name.indexOf(':');
  return colon < 0 ? name : name.slice(colon + 1);
}

/** Premier enfant direct de nom local `name`. */
export function kid(parent: XmlElement | undefined, name: string): XmlElement | undefined {
  if (!parent) return undefined;
  for (const node of parent.children) {
    if (isElement(node) && (node.name === name || localName(node.name) === name)) return node;
  }
  return undefined;
}

/** Enfants directs de nom local `name` (tous les elements si omis). */
export function kids(parent: XmlElement | undefined, name?: string): XmlElement[] {
  if (!parent) return [];
  const out: XmlElement[] = [];
  for (const node of parent.children) {
    if (isElement(node) && (name === undefined || node.name === name || localName(node.name) === name)) out.push(node);
  }
  return out;
}

/** Chemin d'enfants par noms locaux. */
export function walk(parent: XmlElement | undefined, ...names: string[]): XmlElement | undefined {
  let current = parent;
  for (const name of names) current = kid(current, name);
  return current;
}

/** Tous les descendants de nom local `name`. */
export function* deep(root: XmlElement, name: string): Generator<XmlElement> {
  for (const node of root.children) {
    if (!isElement(node)) continue;
    if (localName(node.name) === name) yield node;
    yield* deep(node, name);
  }
}

export function str(element: XmlElement | undefined, name: string): string | undefined {
  return element?.attrs[name];
}

export function num(element: XmlElement | undefined, name: string): number | undefined {
  const raw = element?.attrs[name];
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function int(element: XmlElement | undefined, name: string): number | undefined {
  const value = num(element, name);
  return value === undefined ? undefined : Math.trunc(value);
}

/** Attribut booleen OOXML ; `fallback` si absent. */
export function bool(element: XmlElement | undefined, name: string, fallback: boolean): boolean {
  const raw = element?.attrs[name];
  if (raw === undefined) return fallback;
  return raw === '1' || raw === 'true' || raw === 'on';
}

/** Booleen facultatif : undefined si absent. */
export function optBool(element: XmlElement | undefined, name: string): boolean | undefined {
  const raw = element?.attrs[name];
  if (raw === undefined) return undefined;
  return raw === '1' || raw === 'true' || raw === 'on';
}

/** Element booleen « <b/> » ou « <b val="0"/> ». */
export function flag(parent: XmlElement | undefined, name: string): boolean | undefined {
  const node = kid(parent, name);
  if (!node) return undefined;
  return bool(node, 'val', true);
}

/** Valeur « val » d'un enfant. */
export function val(parent: XmlElement | undefined, name: string): string | undefined {
  return kid(parent, name)?.attrs['val'];
}

export function numVal(parent: XmlElement | undefined, name: string): number | undefined {
  return num(kid(parent, name), 'val');
}

/** Identifiant de relation (« r:id », « r:embed »... quel que soit le prefixe). */
export function relAttr(element: XmlElement | undefined, local = 'id'): string | undefined {
  if (!element) return undefined;
  for (const [key, value] of Object.entries(element.attrs)) {
    if (key !== `xml:${local}` && key.includes(':') && localName(key) === local) return value;
  }
  return undefined;
}

export function text(node: XmlNode | undefined): string {
  return textOf(node);
}

/** Booleen ecrit « 1 » si vrai, omis sinon. */
export function b1(value: boolean | undefined): string | undefined {
  return value ? '1' : undefined;
}

/** Booleen ecrit « 0 » si faux explicite, omis sinon (attributs a defaut vrai). */
export function b0(value: boolean | undefined): string | undefined {
  return value === false ? '0' : undefined;
}

/** Element « <name val="v"/> » ou rien si `value` est undefined. */
export function valEl(name: string, value: string | number | boolean | undefined): XmlElement[] {
  if (value === undefined) return [];
  return [el(name, { val: typeof value === 'boolean' ? (value ? '1' : '0') : value })];
}

/** Texte avec espaces preserves si necessaire. */
export function textEl(name: string, value: string): XmlElement {
  const preserve = /^\s|\s$|\n|\t| {2}/.test(value);
  return el(name, { 'xml:space': preserve ? 'preserve' : undefined }, [value]);
}

/** Echappe une valeur pour l'ecriture XML rapide par chaines. */
export function escXml(value: string): string {
  let out = value;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/.test(out)) {
    out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  }
  if (!/[&<>"]/.test(out)) return out;
  return out.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escAttr(value: string): string {
  return escXml(value).replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}

/** Retire « = » initial d'une formule. */
export function stripEq(formula: string): string {
  return formula.startsWith('=') ? formula.slice(1) : formula;
}
