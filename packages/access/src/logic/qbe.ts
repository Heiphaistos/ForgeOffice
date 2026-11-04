// Grille QBE du createur de requetes <-> DefinitionRequete du moteur (sans DOM, teste).
import { S } from '../strings.ts';
import type { ColonneRequete, DefinitionRequete, GenreRequete, Jointure, Operation, RoleAnalyse, SensTri } from '../types.ts';

export interface QbeColumn {
  field: string;
  table: string;
  /** '' = pas d'operation (ligne Operation masquee ou vide). */
  total: Operation | '';
  sort: SensTri | '';
  show: boolean;
  /** [Criteres, Ou, Ou...]. */
  criteria: string[];
  update: string;
  appendTo: string;
  crosstab: RoleAnalyse | '';
}

export interface QbeTable {
  name: string;
  x: number;
  y: number;
}

export interface QbeState {
  genre: GenreRequete;
  tables: QbeTable[];
  joins: Jointure[];
  columns: QbeColumn[];
  totals: boolean;
  distinct: boolean;
  top: number | null;
  target: string;
}

/** Nombre de lignes « Ou » affichees sous « Criteres ». */
export const OR_ROWS = 3;

export function emptyColumn(): QbeColumn {
  return { field: '', table: '', total: '', sort: '', show: true, criteria: [], update: '', appendTo: '', crosstab: '' };
}

export function emptyQuery(): QbeState {
  return { genre: 'selection', tables: [], joins: [], columns: [], totals: false, distinct: false, top: null, target: '' };
}

/** Grille affichee : colonnes remplies + colonnes vides jusqu'a `min`. */
export function gridColumns(q: QbeState, min = 8): QbeColumn[] {
  const filled = q.columns;
  return filled.length >= min ? [...filled, emptyColumn()] : [...filled, ...Array.from({ length: min - filled.length }, emptyColumn)];
}

/** Ajoute une table (position en cascade) ; une table deja presente recoit un alias implicite non gere : on l'ignore. */
export function addTable(q: QbeState, name: string): QbeState {
  if (q.tables.some((t) => t.name.toLowerCase() === name.toLowerCase())) return q;
  const i = q.tables.length;
  return { ...q, tables: [...q.tables, { name, x: 16 + i * 200, y: 12 + (i % 2) * 16 }] };
}

export function removeTable(q: QbeState, name: string): QbeState {
  const lower = name.toLowerCase();
  return {
    ...q,
    tables: q.tables.filter((t) => t.name.toLowerCase() !== lower),
    joins: q.joins.filter((j) => j.gauche.toLowerCase() !== lower && j.droite.toLowerCase() !== lower),
    columns: q.columns.filter((c) => c.table.toLowerCase() !== lower),
  };
}

/** Double-clic sur un champ : il prend la premiere colonne libre. */
export function addField(q: QbeState, table: string, field: string): QbeState {
  return { ...q, columns: [...q.columns, { ...emptyColumn(), table, field, total: q.totals ? 'regroupement' : '' }] };
}

export function setColumn(q: QbeState, index: number, patch: Partial<QbeColumn>): QbeState {
  const cols = gridColumns(q, index + 1).slice(0, Math.max(q.columns.length, index + 1));
  const merged = cols.map((c, i) => (i === index ? { ...c, ...patch } : c));
  return { ...q, columns: trimColumns(merged) };
}

/** Retire les colonnes vides en fin de grille. */
function trimColumns(cols: QbeColumn[]): QbeColumn[] {
  let end = cols.length;
  while (end > 0 && isEmptyColumn(cols[end - 1])) end--;
  return cols.slice(0, end);
}

function isEmptyColumn(c: QbeColumn | undefined): boolean {
  return !c || (c.field.trim() === '' && c.criteria.every((x) => x.trim() === ''));
}

export function addJoin(q: QbeState, join: Jointure): QbeState {
  const same = (j: Jointure): boolean =>
    (j.gauche === join.gauche && j.champ_gauche === join.champ_gauche && j.droite === join.droite && j.champ_droite === join.champ_droite) ||
    (j.gauche === join.droite && j.champ_gauche === join.champ_droite && j.droite === join.gauche && j.champ_droite === join.champ_gauche);
  if (join.gauche === join.droite) return q;
  return { ...q, joins: [...q.joins.filter((j) => !same(j)), join] };
}

/** Bascule la ligne Operation : les colonnes recoivent « Regroupement ». */
export function setTotals(q: QbeState, on: boolean): QbeState {
  return { ...q, totals: on, columns: q.columns.map((c) => ({ ...c, total: on ? (c.total || 'regroupement') : '' })) };
}

/** Message d'erreur si la requete ne peut pas etre generee, sinon null. */
export function validateQbe(q: QbeState): string | null {
  if (q.tables.length === 0) return S.q.noTable;
  if ((q.genre === 'ajout' || q.genre === 'creation_table') && q.target.trim() === '') return S.q.noTarget;
  if (q.columns.every((c) => c.field.trim() === '') && q.genre !== 'suppression') return S.q.noColumn;
  return null;
}

const SIMPLE_NAME = /^[\p{L}\p{N}_ ]+$/u;
const NOT_EXPRESSION = /^[^[\]:()"'+*/&<>=]+$/;
const QUALIFIED = /^\[([^\]]+)\]\.\[([^\]]+)\]$/;

/** Un nom de champ avec des caracteres speciaux (« N° », « Prix-HT ») est qualifie : [Table].[Champ]. */
export function fieldRef(field: string, table: string): string {
  const f = field.trim();
  if (f === '*' || !table.trim() || SIMPLE_NAME.test(f) || !NOT_EXPRESSION.test(f)) return f;
  return `[${table.trim()}].[${f}]`;
}

/** Grille -> definition envoyee au moteur (generer_sql, executer_definition, enregistrer_requete). */
export function toDefinition(q: QbeState): DefinitionRequete {
  const colonnes: ColonneRequete[] = q.columns
    .filter((c) => c.field.trim() !== '')
    .map((c) => {
      const criteres = [...c.criteria];
      while (criteres.length > 0 && (criteres[criteres.length - 1] ?? '').trim() === '') criteres.pop();
      const col: ColonneRequete = {
        champ: fieldRef(c.field, c.table),
        table: c.table.trim() || null,
        afficher: c.show,
        tri: c.sort || null,
        criteres: criteres.map((x) => x.trim()),
      };
      if (q.totals && c.total) col.operation = c.total;
      if (q.genre === 'mise_a_jour' && c.update.trim()) col.mise_a_jour = c.update.trim();
      if (q.genre === 'ajout' && c.appendTo.trim()) col.ajouter_a = c.appendTo.trim();
      if (q.genre === 'analyse_croisee' && c.crosstab) col.analyse = c.crosstab;
      return col;
    });
  const def: DefinitionRequete = {
    genre: q.genre,
    tables: q.tables.map((t) => ({ nom: t.name })),
    jointures: q.joins,
    colonnes,
    distinct: q.distinct,
    haut: q.top,
  };
  if (q.genre === 'ajout' || q.genre === 'creation_table') def.table_cible = q.target.trim();
  return def;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Definition enregistree -> grille. Les positions des tables sont gardees si la definition les porte (`_positions`). */
export function fromDefinition(raw: unknown): QbeState {
  if (!isRecord(raw)) return emptyQuery();
  const def = raw as Partial<DefinitionRequete> & { _positions?: Record<string, { x: number; y: number }> };
  const positions = isRecord(def._positions) ? def._positions : {};
  let q: QbeState = { ...emptyQuery(), genre: def.genre ?? 'selection', distinct: def.distinct ?? false, top: def.haut ?? null, target: def.table_cible ?? '' };
  for (const t of def.tables ?? []) q = addTable(q, t.nom);
  q.tables = q.tables.map((t) => ({ ...t, ...(positions[t.name] ?? {}) }));
  q.joins = (def.jointures ?? []).map((j) => ({ ...j, genre: j.genre ?? 'interne' }));
  const cols = def.colonnes ?? [];
  q.totals = cols.some((c) => c.operation);
  q.columns = cols.map((c) => ({
    field: c.champ.match(QUALIFIED)?.[1] === c.table ? (c.champ.match(QUALIFIED)?.[2] ?? c.champ) : c.champ,
    table: c.table ?? '',
    total: c.operation ?? (q.totals ? 'regroupement' : ''),
    sort: c.tri ?? '',
    show: c.afficher ?? true,
    criteria: [...(c.criteres ?? [])],
    update: c.mise_a_jour ?? '',
    appendTo: c.ajouter_a ?? '',
    crosstab: c.analyse ?? '',
  }));
  return q;
}

/** Definition enregistree avec les positions des tables (le moteur ignore les champs inconnus). */
export function definitionWithLayout(q: QbeState): DefinitionRequete & { _positions: Record<string, { x: number; y: number }> } {
  return { ...toDefinition(q), _positions: Object.fromEntries(q.tables.map((t) => [t.name, { x: t.x, y: t.y }])) };
}
