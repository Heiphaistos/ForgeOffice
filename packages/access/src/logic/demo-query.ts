// Execution d'une definition de requete en memoire, pour la base de demonstration du navigateur
// (selection, jointures, criteres simples, tri, totaux). Le vrai moteur est forge-base (SQLite).
import type { DefinitionRequete, Json, Operation } from '../types.ts';
import { compareValues, fold } from './table-ops.ts';
import { parseDate, parseNumber } from './values.ts';

export interface MemTable {
  columns: string[];
  rows: Json[][];
}

type Record_ = Map<string, Json>;

function key(table: string, field: string): string {
  return `${table.toLowerCase()}.${field.toLowerCase()}`;
}

function literal(text: string): Json {
  const t = text.trim();
  if (/^".*"$/.test(t) || /^'.*'$/.test(t)) return t.slice(1, -1);
  if (/^#.*#$/.test(t)) return parseDate(t.slice(1, -1));
  if (/^(vrai|true|oui)$/i.test(t)) return true;
  if (/^(faux|false|non)$/i.test(t)) return false;
  const n = parseNumber(t);
  return n ?? parseDate(t) ?? t;
}

function likeMatch(value: Json, pattern: string): boolean {
  const re = fold(pattern).replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${re}$`).test(fold(value === null ? '' : String(value)));
}

/** Critere Access sur une valeur : `>10`, `"Paris"`, `Comme "A*"`, `Entre 1 Et 5`, `Est Null`. */
export function matchCriterion(value: Json, criterion: string): boolean {
  const c = criterion.trim();
  if (c === '') return true;
  if (/^est\s+(pas\s+)?null$/i.test(c) || /^is\s+(not\s+)?null$/i.test(c)) {
    const negated = /\s(pas|not)\s/i.test(c);
    return negated ? value !== null : value === null;
  }
  const like = c.match(/^(comme|like)\s+(.+)$/i);
  if (like) return likeMatch(value, String(literal(like[2] ?? '')));
  const between = c.match(/^(entre|between)\s+(.+?)\s+(et|and)\s+(.+)$/i);
  if (between) return value !== null && compareValues(value, literal(between[2] ?? '')) >= 0 && compareValues(value, literal(between[4] ?? '')) <= 0;
  const cmp = c.match(/^(<>|<=|>=|=|<|>)\s*(.+)$/);
  const op = cmp ? cmp[1] : '=';
  const target = literal(cmp ? (cmp[2] ?? '') : c);
  if (value === null) return op === '<>' && target !== null;
  const r = compareValues(value, target);
  switch (op) {
    case '<>': return r !== 0;
    case '<': return r < 0;
    case '<=': return r <= 0;
    case '>': return r > 0;
    case '>=': return r >= 0;
    default: return r === 0;
  }
}

function aggregate(values: Json[], op: Operation): Json {
  const nums = values.filter((v): v is number => typeof v === 'number');
  switch (op) {
    case 'compte': return values.filter((v) => v !== null).length;
    case 'somme': return nums.reduce((s, n) => s + n, 0);
    case 'moyenne': return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : null;
    case 'min': return [...values].filter((v) => v !== null).sort(compareValues)[0] ?? null;
    case 'max': return [...values].filter((v) => v !== null).sort(compareValues).pop() ?? null;
    case 'premier': return values[0] ?? null;
    case 'dernier': return values[values.length - 1] ?? null;
    default: return values[0] ?? null;
  }
}

/** Execute une requete Selection en memoire. Leve une erreur pour une table inconnue. */
export function runDefinition(def: DefinitionRequete, tables: Readonly<Record<string, MemTable>>): { colonnes: string[]; lignes: Json[][] } {
  const find = (name: string): [string, MemTable] => {
    const entry = Object.entries(tables).find(([n]) => n.toLowerCase() === name.toLowerCase());
    if (!entry) throw new Error(`« ${name} » est introuvable.`);
    return entry;
  };
  const toRecords = (name: string): Record_[] => {
    const [real, t] = find(name);
    return t.rows.map((r) => new Map(t.columns.map((c, i) => [key(real, c), r[i] ?? null])));
  };
  const first = def.tables[0];
  if (!first) return { colonnes: [], lignes: [] };
  let records = toRecords(first.nom);
  const joined = [first.nom.toLowerCase()];
  for (const src of def.tables.slice(1)) {
    const right = toRecords(src.nom);
    const name = src.nom.toLowerCase();
    const join = def.jointures.find((j) => (j.droite.toLowerCase() === name && joined.includes(j.gauche.toLowerCase())) || (j.gauche.toLowerCase() === name && joined.includes(j.droite.toLowerCase())));
    const next: Record_[] = [];
    for (const l of records) {
      const matches = right.filter((r) => {
        if (!join) return true;
        const leftIsNew = join.gauche.toLowerCase() === name;
        const a = leftIsNew ? r.get(key(join.gauche, join.champ_gauche)) : l.get(key(join.gauche, join.champ_gauche));
        const b = leftIsNew ? l.get(key(join.droite, join.champ_droite)) : r.get(key(join.droite, join.champ_droite));
        return a !== undefined && a !== null && compareValues(a, b ?? null) === 0;
      });
      for (const m of matches) next.push(new Map([...l, ...m]));
      if (matches.length === 0 && join && join.genre !== 'interne') next.push(new Map(l));
    }
    records = next;
    joined.push(name);
  }
  // Colonnes : « * » se deplie sur les champs de la table.
  const cols = def.colonnes.flatMap((c) => {
    if (c.champ === '*' || c.champ.endsWith('.*')) {
      const tableName = c.table ?? (c.champ.endsWith('.*') ? c.champ.slice(0, -2) : first.nom);
      const [real, t] = find(tableName);
      return t.columns.map((f) => ({ ...c, champ: f, table: real }));
    }
    return [c];
  });
  const valueOf = (r: Record_, c: (typeof cols)[number]): Json => {
    if (c.table) return r.get(key(c.table, c.champ)) ?? null;
    for (const [k, v] of r) if (k.endsWith(`.${c.champ.toLowerCase()}`)) return v;
    return null;
  };
  const orRows = Math.max(1, ...cols.map((c) => c.criteres.length));
  records = records.filter((r) =>
    Array.from({ length: orRows }, (_, i) => i).some((i) => cols.every((c) => matchCriterion(valueOf(r, c), c.criteres[i] ?? ''))),
  );
  let rows = records.map((r) => cols.map((c) => valueOf(r, c)));
  if (cols.some((c) => c.operation)) {
    const groupIdx = cols.map((c, i) => (c.operation === 'regroupement' ? i : -1)).filter((i) => i >= 0);
    const groups = new Map<string, Json[][]>();
    for (const row of rows) {
      const k = JSON.stringify(groupIdx.map((i) => row[i] ?? null));
      groups.set(k, [...(groups.get(k) ?? []), row]);
    }
    rows = [...groups.values()].map((g) => cols.map((c, i) => (c.operation && c.operation !== 'regroupement' ? aggregate(g.map((r) => r[i] ?? null), c.operation) : (g[0]?.[i] ?? null))));
  }
  const sorts = cols.map((c, i) => ({ i, tri: c.tri })).filter((s) => s.tri);
  if (sorts.length > 0) {
    rows.sort((a, b) => {
      for (const s of sorts) {
        const r = compareValues(a[s.i] ?? null, b[s.i] ?? null);
        if (r !== 0) return s.tri === 'decroissant' ? -r : r;
      }
      return 0;
    });
  }
  const shown = cols.map((c, i) => ({ c, i })).filter((x) => x.c.afficher && x.c.operation !== 'ou');
  let lignes = rows.map((r) => shown.map((x) => r[x.i] ?? null));
  if (def.distinct) {
    const seen = new Set<string>();
    lignes = lignes.filter((l) => !seen.has(JSON.stringify(l)) && Boolean(seen.add(JSON.stringify(l))));
  }
  if (def.haut) lignes = lignes.slice(0, def.haut);
  return { colonnes: shown.map((x) => x.c.alias ?? x.c.champ), lignes };
}
