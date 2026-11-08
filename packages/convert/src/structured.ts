// Donnees structurees sans dependance : lecture JSON / YAML / TOML (sous-ensemble courant) et ecriture YAML, TOML, XML.
// Sans DOM, teste. Limites assumees : pas d'ancres ni d'etiquettes YAML, pas de dates TOML natives (gardees en texte).

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

// ------------------------------------------------------------------ YAML : ecriture

const YAML_PLAIN = /^[A-Za-zÀ-ÿ_][\w À-ÿ./-]*$/;

function yamlScalar(v: Json): string {
  if (v === null) return 'null';
  if (typeof v === 'string') {
    const risky = v === '' || !YAML_PLAIN.test(v) || /^(null|true|false|yes|no|on|off|~)$/i.test(v) || /\s$/.test(v);
    return risky ? JSON.stringify(v) : v;
  }
  return String(v);
}

const yamlKey = (k: string): string => (YAML_PLAIN.test(k) && !/^(null|true|false|yes|no|on|off)$/i.test(k) ? k : JSON.stringify(k));

function yamlLines(v: Json, indent: string): string[] {
  if (Array.isArray(v)) {
    if (v.length === 0) return [`${indent}[]`];
    return v.flatMap((item) => {
      if (Array.isArray(item) ? item.length > 0 : isObj(item) && Object.keys(item).length > 0) {
        const inner = yamlLines(item, `${indent}  `);
        return [`${indent}- ${(inner[0] ?? '').trimStart()}`, ...inner.slice(1)];
      }
      return [`${indent}- ${Array.isArray(item) ? '[]' : isObj(item) ? '{}' : yamlScalar(item)}`];
    });
  }
  if (isObj(v)) {
    const keys = Object.keys(v);
    if (keys.length === 0) return [`${indent}{}`];
    return keys.flatMap((k) => {
      const val = v[k] ?? null;
      if (Array.isArray(val) ? val.length > 0 : isObj(val) && Object.keys(val).length > 0) return [`${indent}${yamlKey(k)}:`, ...yamlLines(val, `${indent}  `)];
      return [`${indent}${yamlKey(k)}: ${Array.isArray(val) ? '[]' : isObj(val) ? '{}' : yamlScalar(val)}`];
    });
  }
  return [`${indent}${yamlScalar(v)}`];
}

export const toYaml = (v: Json): string => `${yamlLines(v, '').join('\n')}\n`;

// ------------------------------------------------------------------ YAML : lecture

function stripComment(line: string): string {
  let q = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '\\' && q === '"') i++;
      else if (c === q) q = '';
    } else if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1] ?? ''))) return line.slice(0, i);
  }
  return line;
}

function yamlValue(raw: string): Json {
  const t = raw.trim();
  if (t === '' || t === '~' || /^null$/i.test(t)) return null;
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return Number(t);
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return JSON.parse(t) as string;
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1).replace(/''/g, "'");
  if (t === '[]') return [];
  if (t === '{}') return {};
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      return JSON.parse(t) as Json;
    } catch {
      return flowToJson(t);
    }
  }
  return t;
}

/** Collection de flux YAML non JSON : [a, b] ou {k: v} avec valeurs simples. */
function flowToJson(t: string): Json {
  const inner = t.slice(1, -1);
  const parts: string[] = [];
  let depth = 0;
  let q = '';
  let cur = '';
  for (const c of inner) {
    if (q) { if (c === q) q = ''; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0 && !q) { parts.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim() !== '') parts.push(cur);
  if (t.startsWith('[')) return parts.map(yamlValue);
  const out: Obj = {};
  for (const p of parts) {
    const i = p.indexOf(':');
    if (i > 0) out[String(yamlValue(p.slice(0, i)))] = yamlValue(p.slice(i + 1));
  }
  return out;
}

interface YLine { indent: number; text: string }

export function parseYaml(source: string): Json {
  const lines: YLine[] = [];
  const raw = source.replace(/^﻿/, '').split(/\r?\n/);
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i] ?? '';
    if (/^(---|\.\.\.)\s*$/.test(line)) continue;
    const text = stripComment(line).trimEnd();
    if (text.trim() === '') continue;
    const indent = text.length - text.trimStart().length;
    const t = text.trim();
    // Scalaire bloc « | » ou « > » : on regroupe les lignes plus indentees.
    const block = t.match(/^(.*?)(\||>)[-+]?$/);
    if (block && (block[1] === '' || /(:|-)\s*$/.test(block[1] ?? ''))) {
      const body: string[] = [];
      while (i + 1 < raw.length && ((raw[i + 1] ?? '').trim() === '' || ((raw[i + 1] ?? '').length - (raw[i + 1] ?? '').trimStart().length) > indent)) body.push(raw[++i] ?? '');
      const min = Math.min(...body.filter((b) => b.trim() !== '').map((b) => b.length - b.trimStart().length), 1e9);
      const content = body.map((b) => b.slice(Math.min(min, b.length))).join(block[2] === '|' ? '\n' : ' ').trimEnd();
      lines.push({ indent, text: `${block[1] ?? ''}${JSON.stringify(content + (block[2] === '|' ? '\n' : ''))}` });
    } else lines.push({ indent, text: t });
  }
  let pos = 0;

  const parseBlock = (indent: number): Json => {
    const first = lines[pos];
    if (!first) return null;
    if (first.text.startsWith('- ') || first.text === '-') return parseList(first.indent);
    return parseMap(first.indent);
  };

  const splitKey = (text: string): [string, string] | null => {
    let q = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === q) q = ''; }
      else if (c === '"' || c === "'") q = c;
      else if (c === ':' && (i === text.length - 1 || text[i + 1] === ' ')) return [String(yamlValue(text.slice(0, i))), text.slice(i + 1).trim()];
    }
    return null;
  };

  const valueAfter = (rest: string, indent: number): Json => {
    if (rest !== '') return yamlValue(rest);
    const next = lines[pos];
    if (next && (next.indent > indent || (next.indent === indent && next.text.startsWith('- ')))) return parseBlock(next.indent);
    return null;
  };

  function parseMap(indent: number): Obj {
    const out: Obj = {};
    for (let l = lines[pos]; l && l.indent === indent && !l.text.startsWith('- '); l = lines[pos]) {
      const kv = splitKey(l.text);
      if (!kv) throw new Error(`YAML illisible : « ${l.text} »`);
      pos++;
      out[kv[0]] = valueAfter(kv[1], indent);
    }
    return out;
  }

  function parseList(indent: number): Json[] {
    const out: Json[] = [];
    for (let l = lines[pos]; l && l.indent === indent && (l.text.startsWith('- ') || l.text === '-'); l = lines[pos]) {
      const rest = l.text === '-' ? '' : l.text.slice(2).trim();
      const kv = rest !== '' && !rest.startsWith('"') && !rest.startsWith("'") && !rest.startsWith('[') && !rest.startsWith('{') ? splitKey(rest) : null;
      if (kv) {
        // « - cle: valeur » ouvre un objet dont les autres cles sont alignees apres « - ».
        lines[pos] = { indent: indent + 2, text: rest };
        out.push(parseMap(indent + 2));
      } else {
        pos++;
        out.push(valueAfter(rest, indent));
      }
    }
    return out;
  }

  if (lines.length === 0) return null;
  const first = lines[0];
  if (lines.length === 1 && first && !first.text.startsWith('- ') && !splitKey(first.text)) return yamlValue(first.text);
  return parseBlock(0);
}

// ------------------------------------------------------------------ TOML

const BARE = /^[A-Za-z0-9_-]+$/;
const tomlKey = (k: string): string => (BARE.test(k) ? k : JSON.stringify(k));

function tomlInline(v: Json): string {
  if (v === null) return '""';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(tomlInline).join(', ')}]`;
  if (isObj(v)) return `{ ${Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => `${tomlKey(k)} = ${tomlInline(x)}`).join(', ')} }`;
  return String(v);
}

const isTable = (v: Json): v is Obj => isObj(v);
const isTableArray = (v: Json): v is Obj[] => Array.isArray(v) && v.length > 0 && v.every(isObj);

function tomlTable(o: Obj, path: string[], out: string[], header = true): void {
  const scalars = Object.entries(o).filter(([, v]) => v !== null && !isTable(v) && !isTableArray(v));
  if (header && path.length > 0 && (scalars.length > 0 || Object.keys(o).length === 0)) out.push(`${out.length ? '\n' : ''}[${path.map(tomlKey).join('.')}]`);
  for (const [k, v] of scalars) out.push(`${tomlKey(k)} = ${tomlInline(v)}`);
  for (const [k, v] of Object.entries(o)) {
    if (isTable(v)) tomlTable(v, [...path, k], out);
    else if (isTableArray(v)) {
      for (const item of v) {
        out.push(`${out.length ? '\n' : ''}[[${[...path, k].map(tomlKey).join('.')}]]`);
        tomlTable(item, [...path, k], out, false);
      }
    }
  }
}

/** TOML exige une table a la racine : un tableau ou une valeur est range sous la cle « items » / « valeur ». */
export function toToml(v: Json): string {
  const root: Obj = isObj(v) ? v : Array.isArray(v) ? { items: v } : { valeur: v };
  const out: string[] = [];
  tomlTable(root, [], out);
  return `${out.join('\n')}\n`;
}

function tomlValue(raw: string): Json {
  const t = raw.trim();
  if (t.startsWith('"""') && t.endsWith('"""') && t.length >= 6) return t.slice(3, -3).replace(/^\n/, '');
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return JSON.parse(t) as string;
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1);
  if (t === 'true' || t === 'false') return t === 'true';
  if (/^[-+]?(\d[\d_]*\.?[\d_]*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return Number(t.replace(/_/g, ''));
  if (/^[-+]?(inf|nan)$/.test(t)) return t;
  if (t.startsWith('[')) return splitTop(t.slice(1, -1)).map(tomlValue);
  if (t.startsWith('{')) {
    const o: Obj = {};
    for (const p of splitTop(t.slice(1, -1))) {
      const i = p.indexOf('=');
      if (i > 0) o[keyName(p.slice(0, i))] = tomlValue(p.slice(i + 1));
    }
    return o;
  }
  return t;
}

const keyName = (k: string): string => {
  const t = k.trim();
  return t.startsWith('"') ? (JSON.parse(t) as string) : t.startsWith("'") ? t.slice(1, -1) : t;
};

function splitTop(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let q = '';
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i] ?? '';
    if (q) { if (c === '\\' && q === '"') { cur += c + (s[++i] ?? ''); continue; } if (c === q) q = ''; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0 && !q) { parts.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts;
}

function splitPath(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = '';
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = ''; }
    else if (c === '"' || c === "'") { q = c; cur += c; }
    else if (c === '.') { out.push(keyName(cur)); cur = ''; }
    else cur += c;
  }
  out.push(keyName(cur));
  return out;
}

export function parseToml(source: string): Json {
  const root: Obj = {};
  let current: Obj = root;
  const lines = source.replace(/^﻿/, '').split(/\r?\n/);
  const descend = (path: string[], arrayLast: boolean): Obj => {
    let node: Obj = root;
    path.forEach((k, i) => {
      const last = i === path.length - 1;
      const existing = node[k];
      if (last && arrayLast) {
        const list = Array.isArray(existing) ? existing : [];
        const item: Obj = {};
        list.push(item);
        node[k] = list;
        node = item;
      } else if (Array.isArray(existing)) node = (existing[existing.length - 1] as Obj | undefined) ?? {};
      else if (isObj(existing ?? null)) node = existing as Obj;
      else {
        const created: Obj = {};
        node[k] = created;
        node = created;
      }
    });
    return node;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = stripComment(lines[i] ?? '').trim();
    if (line === '') continue;
    const header = line.match(/^(\[\[?)(.+?)(\]\]?)$/);
    if (header && !/^\[[^\]]*\]\s*=/.test(line)) {
      current = descend(splitPath((header[2] ?? '').trim()), header[1] === '[[');
      continue;
    }
    const eq = line.search(/=/);
    if (eq < 0) throw new Error(`TOML illisible : « ${line} »`);
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"""') && !(value.endsWith('"""') && value.length >= 6)) {
      while (i + 1 < lines.length && !value.endsWith('"""')) value += `\n${lines[++i] ?? ''}`;
    }
    // Tableaux sur plusieurs lignes : on lit jusqu'a l'equilibre des crochets.
    while (value.startsWith('[') && (value.match(/\[/g)?.length ?? 0) > (value.match(/\]/g)?.length ?? 0) && i + 1 < lines.length) value += ` ${stripComment(lines[++i] ?? '').trim()}`;
    const path = splitPath(line.slice(0, eq).trim());
    const target = path.slice(0, -1).reduce<Obj>((n, k) => (isObj(n[k] ?? null) ? (n[k] as Obj) : (n[k] = {})), current);
    target[path[path.length - 1] ?? ''] = tomlValue(value);
  }
  return root;
}

// ------------------------------------------------------------------ XML : ecriture

const xmlEscape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Nom d'element valide : lettres, chiffres, _ - . ; prefixe « _ » s'il commence autrement. */
export function xmlName(k: string): string {
  const n = k.trim().replace(/[^\p{L}\p{N}_.-]+/gu, '_').replace(/^_+$/, '');
  return n === '' ? '_' : /^[\p{L}_]/u.test(n) ? n : `_${n}`;
}

function xmlNode(name: string, v: Json, indent: string): string[] {
  if (Array.isArray(v)) return v.flatMap((item) => xmlNode(name, item, indent));
  if (isObj(v)) {
    const keys = Object.keys(v);
    if (keys.length === 0) return [`${indent}<${name}/>`];
    return [`${indent}<${name}>`, ...keys.flatMap((k) => xmlNode(xmlName(k), v[k] ?? null, `${indent}  `)), `${indent}</${name}>`];
  }
  return [v === null ? `${indent}<${name}/>` : `${indent}<${name}>${xmlEscape(String(v))}</${name}>`];
}

export function toXml(v: Json, root = 'racine'): string {
  const body = Array.isArray(v) ? xmlNode(root, { item: v }, '') : xmlNode(root, v, '');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body.join('\n')}\n`;
}
