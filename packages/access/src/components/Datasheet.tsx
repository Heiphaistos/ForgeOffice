// Feuille de donnees : pagination, tri, filtres (selection, valeurs), recherche, totaux, edition, ajout en derniere ligne.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import { Dialog, Icon, Menu, TextField, useContextMenu, type Anchor, type MenuItem } from '@forgeoffice/ui';
import { api, type Db } from '../db.ts';
import { ROW_MAX, ROW_MIN, fitWidth, freezeColumns, hideColumn, resetWidth, setRowHeight, setWidth, showAll, showColumn, toTsv } from '../logic/columns-layout.ts';
import { customFilterOptions, familyOf, type CustomFilterOption, type FilterFamily } from '../logic/custom-filter.ts';
import { toDefinitions } from '../logic/field-types.ts';
import { allRange, columnRange, inBox, rangeBox, rangeText, rowRange, type GridRange } from '../logic/selection.ts';
import { applyOptions, computeTotal, distinctValues } from '../logic/table-ops.ts';
import { displayValue, editText, isEditableType, isNumericType, parseInput, uniqueName, type FieldRule } from '../logic/values.ts';
import { S } from '../strings.ts';
import { G } from '../strings-grid.ts';
import { F } from '../strings-filter.ts';
import type { Filtre, FonctionTotal, Json, OptionsLecture, ResultatSql, Row, SchemaTable, Tri, TypeChamp } from '../types.ts';
import type { AppCtx, FilterMode, ViewApi } from './view-types.ts';
import { CustomFilterDialog } from './CustomFilterDialog.tsx';
import { useColumnLayout } from './useColumnLayout.ts';

export type DsSource = { kind: 'table'; name: string } | { kind: 'query'; name: string } | { kind: 'result'; title: string; result: ResultatSql };

const PAGE = 100;
const TOTAL_FNS: readonly FonctionTotal[] = ['somme', 'moyenne', 'compte', 'max', 'min', 'ecart_type', 'variance'];

interface Col {
  nom: string;
  label: string;
  type: TypeChamp | null;
  rule: FieldRule;
}

interface Data {
  cols: Col[];
  rows: Json[][];
  keys: Row[] | null;
  total: number;
  nbPages: number;
  editable: boolean;
}

interface Props {
  db: Db;
  ctx: AppCtx;
  source: DsSource;
  register: (api: ViewApi) => void;
}

const EMPTY: Data = { cols: [], rows: [], keys: null, total: 0, nbPages: 1, editable: false };

export function Datasheet({ db, ctx, source, register }: Props) {
  const [data, setData] = useState<Data>(EMPTY);
  const [schema, setSchema] = useState<SchemaTable | null>(null);
  const [result, setResult] = useState<ResultatSql | null>(source.kind === 'result' ? source.result : null);
  const [page, setPage] = useState(0);
  const [reloads, setReloads] = useState(0);
  const [finds, setFinds] = useState(0);
  const [tri, setTri] = useState<Tri[]>([]);
  const [filtres, setFiltres] = useState<Filtre[]>([]);
  const [filterOn, setFilterOn] = useState(true);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState({ row: 0, col: 0 });
  // Plage de cellules (Maj+clic, Maj+fleches, selecteur de ligne, intitule de colonne, Ctrl+A) ; null = la cellule courante seule.
  const [extent, setExtent] = useState<GridRange | null>(null);
  const [editing, setEditing] = useState<{ row: number; col: number; text: string } | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [totalsOn, setTotalsOn] = useState(false);
  const [totalFns, setTotalFns] = useState<Record<string, FonctionTotal | ''>>({});
  const [totals, setTotals] = useState<Record<string, Json>>({});
  const [colMenu, setColMenu] = useState<{ col: number; anchor: Anchor; items: MenuItem[] } | null>(null);
  const [customFilter, setCustomFilter] = useState<{ champ: string; label: string; family: FilterFamily; option: CustomFilterOption } | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replace, setReplace] = useState({ find: '', by: '' });
  const [spell, setSpell] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const context = useContextMenu();
  const tableName = source.kind === 'table' ? source.name : null;
  const title = source.kind === 'result' ? source.title : source.name;
  const queryName = source.kind === 'query' ? source.name : null;
  const colNames = useMemo(() => data.cols.map((c) => c.nom), [data.cols]);
  const cl = useColumnLayout(ctx.services.settings, `access.cols.${source.kind}.${title}`, colNames);
  const { shown, layout } = cl;
  const box = useMemo(() => (extent ? rangeBox(extent, shown) : null), [extent, shown]);
  useEffect(() => setExtent(null), [page, tri, filtres, filterOn, search, reloads]);

  const options = useCallback((p: number): OptionsLecture => ({ page: p, taille_page: PAGE, tri, filtres: filterOn ? filtres : [], recherche: search.trim() || null }), [tri, filtres, filterOn, search]);

  // Chargement : table -> moteur (pagine) ; requete/resultat -> en memoire.
  const load = useCallback(async () => {
    try {
      if (tableName) {
        if (!schema) return;
        const p = await api.read(db, tableName, options(page));
        const byName = new Map(schema.champs.map((c) => [c.nom, c]));
        const cols = p.colonnes.map((c): Col => {
          const ch = byName.get(c.nom);
          const pr = ch?.proprietes;
          return {
            nom: c.nom, label: pr?.legende || c.nom, type: c.type,
            rule: { nom: c.nom, type: c.type, requis: pr?.requis, taille: pr?.taille, liste_valeurs: pr?.liste_valeurs, limiter_a_liste: pr?.limiter_a_liste },
          };
        });
        setData({ cols, rows: p.lignes, keys: p.cles, total: p.total, nbPages: p.nb_pages, editable: p.modifiable && !db.readOnly });
      } else {
        let r = result;
        if (!r && queryName !== null) {
          r = await api.runQuery(db, queryName);
          setResult(r);
        }
        if (!r) return;
        const cols = r.colonnes.map((c): Col => ({ nom: c.nom, label: c.legende || c.nom, type: c.type, rule: { nom: c.nom, type: c.type } }));
        const local = applyOptions(cols.map((c) => c.nom), r.lignes, options(page));
        setData({ cols, rows: local.indexes.map((i) => r.lignes[i] ?? []), keys: null, total: local.total, nbPages: local.nbPages, editable: false });
      }
    } catch (err) {
      ctx.fail(err);
    }
  }, [db, tableName, schema, result, source.kind, queryName, options, page, ctx]);

  useEffect(() => {
    if (tableName && !schema) api.schema(db, tableName).then(setSchema, ctx.fail);
  }, [tableName, schema, db, ctx]);

  useEffect(() => {
    void load();
  }, [load]);

  // Totaux (ligne Total).
  useEffect(() => {
    if (!totalsOn) return;
    let alive = true;
    void (async () => {
      const out: Record<string, Json> = {};
      for (const c of data.cols) {
        const fn = totalFns[c.nom];
        if (!fn) continue;
        if (tableName) out[c.nom] = await db.call<Json>('total', { table: tableName, champ: c.nom, fonction: fn, options: options(0) }).catch(() => null);
        else if (result) {
          const i = result.colonnes.findIndex((x) => x.nom === c.nom);
          const all = applyOptions(result.colonnes.map((x) => x.nom), result.lignes, { ...options(0), taille_page: 1e9 });
          out[c.nom] = computeTotal(all.indexes.map((r) => result.lignes[r]?.[i] ?? null), fn);
        }
      }
      if (alive) setTotals(out);
    })();
    return () => {
      alive = false;
    };
  }, [totalsOn, totalFns, data, tableName, result, db, options]);

  const rowCount = data.rows.length + (data.editable ? 1 : 0);
  const cur = data.cols[sel.col];
  const cellValue = (row: number, col: number): Json => data.rows[row]?.[col] ?? null;
  const selectionText = cur && sel.row < data.rows.length ? displayValue(cellValue(sel.row, sel.col), cur.type) : null;
  const absIndex = page * PAGE + sel.row;

  const refreshAll = useCallback(() => {
    setReloads((n) => n + 1);
    if (source.kind === 'query') setResult(null);
    setSchema(null);
  }, [source.kind]);

  const writeCell = useCallback(async (row: number, col: number, text: string): Promise<boolean> => {
    const c = data.cols[col];
    if (!c || !tableName) return false;
    const parsed = parseInput(text, c.rule);
    if (!parsed.ok) {
      ctx.notify(parsed.error, 'error');
      return false;
    }
    if (row >= data.rows.length) {
      setDraft((d) => ({ ...d, [c.nom]: text }));
      return true;
    }
    const cle = data.keys?.[row];
    if (!cle) return false;
    try {
      await db.call('modifier', { table: tableName, cle, valeurs: { [c.nom]: parsed.value } });
      await load();
      return true;
    } catch (err) {
      ctx.fail(err);
      return false;
    }
  }, [data, tableName, db, ctx, load]);

  const saveNewRow = useCallback(async (): Promise<boolean> => {
    if (!tableName || Object.keys(draft).length === 0) return true;
    const valeurs: Record<string, Json> = {};
    for (const c of data.cols) {
      if (!(c.nom in draft)) continue;
      const parsed = parseInput(draft[c.nom] ?? '', c.rule);
      if (!parsed.ok) {
        ctx.notify(parsed.error, 'error');
        return false;
      }
      valeurs[c.nom] = parsed.value;
    }
    try {
      await db.call('inserer', { table: tableName, valeurs });
      setDraft({});
      ctx.notify(S.ds.added, 'success');
      setSchema(null);
      const last = Math.max(0, Math.ceil((data.total + 1) / PAGE) - 1);
      setPage(last);
      await load();
      return true;
    } catch (err) {
      ctx.fail(err);
      return false;
    }
  }, [tableName, draft, data, db, ctx, load]);

  const startEdit = (row: number, col: number, initial?: string): void => {
    const c = data.cols[col];
    if (!data.editable || !c || !isEditableType(c.type)) return;
    const text = initial ?? (row >= data.rows.length ? (draft[c.nom] ?? '') : editText(cellValue(row, col), c.type));
    setEditing({ row, col, text });
  };

  const finishEdit = async (move: 'down' | 'right' | 'none'): Promise<void> => {
    if (!editing) return;
    const ok = await writeCell(editing.row, editing.col, editing.text);
    if (!ok) return;
    setEditing(null);
    if (move === 'down') {
      if (editing.row >= data.rows.length) await saveNewRow();
      else setSel({ row: Math.min(rowCount - 1, editing.row + 1), col: editing.col });
    } else if (move === 'right') setSel({ row: editing.row, col: Math.min(data.cols.length - 1, editing.col + 1) });
    gridRef.current?.focus();
  };

  const toggleBool = async (row: number, col: number): Promise<void> => {
    if (!data.editable) return;
    const v = cellValue(row, col);
    await writeCell(row, col, v === true ? 'non' : 'oui');
  };

  const deleteRecord = useCallback(async () => {
    if (!tableName || !data.keys || sel.row >= data.rows.length) return;
    const cle = data.keys[sel.row];
    if (!cle) return;
    const ok = await ctx.confirm(`${S.ds.deleteConfirm(1)}\n\n${S.ds.deleteWarn}`);
    if (!ok) return;
    try {
      const n = await db.call<number>('supprimer', { table: tableName, cles: [cle] });
      ctx.notify(S.ds.deleted(n), 'success');
      setSchema(null);
      await load();
    } catch (err) {
      ctx.fail(err);
    }
  }, [tableName, data, sel.row, ctx, db, load]);

  const filterBy = useCallback((mode: FilterMode, at = sel) => {
    const c = data.cols[at.col];
    if (!c || at.row >= data.rows.length) {
      ctx.notify(S.ds.noSelection, 'warning');
      return;
    }
    const v = data.rows[at.row]?.[at.col] ?? null;
    const f: Filtre = mode === 'egal' && v === null ? { champ: c.nom, operateur: 'est_vide' } : { champ: c.nom, operateur: mode, valeur: mode.includes('contient') ? displayValue(v, c.type) : v };
    setFiltres((fs) => [...fs, f]);
    setFilterOn(true);
    setPage(0);
  }, [sel, data, ctx]);

  const sortBy = useCallback((col: number, descending: boolean) => {
    const c = data.cols[col];
    if (c) {
      setTri([{ champ: c.nom, descendant: descending }]);
      setPage(0);
    }
  }, [data.cols]);

  /** Sous-menu « Filtres de texte / numeriques / de dates » : chaque option ouvre la boite de saisie (ou filtre tout de suite sans valeur). */
  const customFilterMenu = useCallback((c: Col): MenuItem => {
    const family = familyOf(c.type);
    return {
      id: 'custom', label: F.menu[family], icon: 'filter',
      items: customFilterOptions(family).map((option): MenuItem => ({
        id: option.id, label: F.options[option.id] ?? option.id,
        onClick: () => {
          if (option.values === 0) {
            setFiltres((fs) => [...fs, { champ: c.nom, operateur: option.operateur }]);
            setFilterOn(true);
            setPage(0);
          } else setCustomFilter({ champ: c.nom, label: c.label, family, option });
        },
      })),
    };
  }, []);

  const openColumnMenu = useCallback(async (col: number, anchor: Anchor) => {
    const c = data.cols[col];
    if (!c) return;
    let values: Json[] = [];
    try {
      if (tableName) values = await db.call<Json[]>('distinctes', { table: tableName, champ: c.nom, limite: 50 });
      else if (result) {
        const i = result.colonnes.findIndex((x) => x.nom === c.nom);
        values = distinctValues(result.lignes.map((r) => r[i] ?? null), 50);
      }
    } catch (err) {
      ctx.fail(err);
    }
    const current = filtres.find((f) => f.champ === c.nom && f.operateur === 'dans')?.valeurs;
    const isOn = (v: Json): boolean => !current || current.some((x) => JSON.stringify(x) === JSON.stringify(v));
    const toggle = (v: Json): void => {
      const base = current ?? values;
      const next = isOn(v) ? base.filter((x) => JSON.stringify(x) !== JSON.stringify(v)) : [...base, v];
      setFiltres((fs) => [...fs.filter((f) => !(f.champ === c.nom && f.operateur === 'dans')), ...(next.length === values.length ? [] : [{ champ: c.nom, operateur: 'dans' as const, valeurs: next }])]);
      setFilterOn(true);
      setPage(0);
    };
    const items: MenuItem[] = [
      { id: 'az', label: S.ds.sortAZ, icon: 'text_sort_ascending', onClick: () => sortBy(col, false) },
      { id: 'za', label: S.ds.sortZA, icon: 'text_sort_descending', onClick: () => sortBy(col, true) },
      { id: 'clr', label: S.ds.clearFilterOn(c.label), icon: 'filter', disabled: !filtres.some((f) => f.champ === c.nom), onClick: () => setFiltres((fs) => fs.filter((f) => f.champ !== c.nom)) },
      customFilterMenu(c),
      { id: 's', kind: 'separator' },
      ...values.map((v, i): MenuItem => ({ id: `v${i}`, label: v === null || v === '' ? S.ds.blanks : displayValue(v, c.type), checked: isOn(v), onClick: () => toggle(v) })),
    ];
    setColMenu({ col, anchor, items });
  }, [data.cols, tableName, result, db, ctx, filtres, sortBy, customFilterMenu]);

  const addField = useCallback(async (type: TypeChamp) => {
    if (!tableName || !schema) return;
    const nom = await ctx.prompt(S.cmd.addField, S.td.fieldName, uniqueName('Champ1', schema.champs.map((c) => c.nom)));
    if (!nom) return;
    try {
      await db.call('modifier_table', { table: tableName, champs: [...toDefinitions(schema.champs), { nom, type, cle_primaire: false }] });
      setSchema(null);
    } catch (err) {
      ctx.fail(err);
    }
  }, [tableName, schema, ctx, db]);

  const patchField = useCallback(async (patch: (d: ReturnType<typeof toDefinitions>[number]) => void, remove = false) => {
    if (!tableName || !schema || !cur) return;
    const defs = toDefinitions(schema.champs);
    const target = defs.find((d) => d.nom === cur.nom);
    if (!target) return;
    if (remove) {
      if (!(await ctx.confirm(S.dlg.deleteConfirm(cur.nom)))) return;
    } else patch(target);
    try {
      await db.call('modifier_table', { table: tableName, champs: remove ? defs.filter((d) => d !== target) : defs });
      setSchema(null);
    } catch (err) {
      ctx.fail(err);
    }
  }, [tableName, schema, cur, ctx, db]);

  const field = schema?.champs.find((c) => c.nom === cur?.nom);
  const copyCell = (): void => {
    if (box) {
      const text = (r: number, c: number): string => displayValue(data.rows[r]?.[c] ?? null, data.cols[c]?.type ?? null);
      void navigator.clipboard.writeText(rangeText({ ...box, r2: Math.min(box.r2, data.rows.length - 1) }, text));
      ctx.notify(G.rangeCopied(Math.min(box.r2, data.rows.length - 1) - box.r1 + 1, box.cols.length), 'success');
    } else if (selectionText !== null) void navigator.clipboard.writeText(selectionText);
  };

  useEffect(() => {
    const editable = data.editable;
    register({
      view: { row: sel.row, col: sel.col, page, tri, search, filterOn, totalsOn, replaceOpen, spell, reloads, finds },
      sort: (d) => sortBy(sel.col, d),
      clearSort: () => setTri([]),
      selectionText,
      filterSelection: filterBy,
      filtered: filterOn && filtres.length > 0,
      toggleFilter: filtres.length > 0 ? () => setFilterOn((v) => !v) : undefined,
      clearFilters: () => {
        setFiltres([]);
        setSearch('');
      },
      columnFilterMenu: () => {
        const th = gridRef.current?.querySelectorAll('thead th')[shown.indexOf(sel.col) + 1] as HTMLElement | undefined;
        if (th) void openColumnMenu(sel.col, th);
      },
      refresh: refreshAll,
      newRecord: editable ? () => setSel({ row: data.rows.length, col: 0 }) : undefined,
      saveRecord: editable ? () => void (editing ? finishEdit('none') : saveNewRow()) : undefined,
      deleteRecord: editable ? () => void deleteRecord() : undefined,
      totalsOn,
      toggleTotals: () => setTotalsOn((v) => !v),
      find: () => { searchRef.current?.focus(); setFinds((n) => n + 1); },
      spelling: editable ? () => { setSpell(true); ctx.notify(S.ds.spellingOn); } : undefined,
      replace: editable ? () => setReplaceOpen(true) : undefined,
      goTo: (w) => {
        if (w === 'first') { setPage(0); setSel((s) => ({ ...s, row: 0 })); }
        else if (w === 'last') { setPage(data.nbPages - 1); setSel((s) => ({ ...s, row: Math.max(0, (data.total - 1) % PAGE) })); }
        else if (w === 'previous') { if (sel.row > 0 || page === 0) setSel((s) => ({ ...s, row: Math.max(0, s.row - 1) })); else { setPage(page - 1); setSel((s) => ({ ...s, row: PAGE - 1 })); } }
        else if (w === 'next') setSel((s) => ({ ...s, row: Math.min(rowCount - 1, s.row + 1) }));
        else if (editable) setSel({ row: data.rows.length, col: 0 });
      },
      copy: copyCell,
      cut: editable ? () => { copyCell(); void writeCell(sel.row, sel.col, ''); } : undefined,
      paste: editable ? () => void navigator.clipboard.readText().then((t) => writeCell(sel.row, sel.col, t)) : undefined,
      column: cur?.nom ?? null,
      addField: editable ? (t) => void addField(t) : undefined,
      deleteField: editable && cur ? () => void patchField(() => undefined, true) : undefined,
      required: field?.proprietes.requis ?? false,
      toggleRequired: editable && field ? () => void patchField((d) => { d.requis = !d.requis; }) : undefined,
      indexed: (field?.proprietes.indexe ?? 'non') !== 'non',
      toggleIndexed: editable && field ? () => void patchField((d) => { d.indexe = (d.indexe ?? 'non') === 'non' ? 'avec_doublons' : 'non'; }) : undefined,
      print: () => ctx.services.print(),
    });
  });

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (editing) return;
    const move = (dr: number, dc: number, extend = false): void => {
      e.preventDefault();
      const pos = Math.max(0, shown.indexOf(sel.col)) + dc;
      const next = { row: Math.max(0, Math.min(rowCount - 1, sel.row + dr)), col: shown[Math.max(0, Math.min(shown.length - 1, pos))] ?? sel.col };
      setExtent(extend ? { a: extent?.a ?? sel, b: next } : null);
      setSel(next);
    };
    if (e.key === 'ArrowDown') move(1, 0, e.shiftKey);
    else if (e.key === 'ArrowUp') move(-1, 0, e.shiftKey);
    else if (e.key === 'ArrowRight') move(0, 1, e.shiftKey);
    else if (e.key === 'ArrowLeft') move(0, -1, e.shiftKey);
    else if (e.key === 'Tab') move(0, e.shiftKey ? -1 : 1);
    else if (e.key.toLowerCase() === 'a' && e.ctrlKey) {
      e.preventDefault();
      setExtent(allRange(data.rows.length, shown));
    } else if (e.key === 'F2' || e.key === 'Enter') {
      e.preventDefault();
      startEdit(sel.row, sel.col);
    } else if (e.key === 'Delete' && e.ctrlKey) void deleteRecord();
    else if (e.key === 'c' && e.ctrlKey) copyCell();
    else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      startEdit(sel.row, sel.col, e.key);
    }
  };

  const headerMenu = (e: MouseEvent, col: number): void => {
    e.stopPropagation();
    void openColumnMenu(col, e.currentTarget as HTMLElement);
  };

  const columnValues = (col: number): string[] => {
    const c = data.cols[col];
    return c ? data.rows.map((r) => displayValue(r[col] ?? null, c.type)) : [];
  };

  const fitColumn = (col: number): void => {
    const c = data.cols[col];
    if (c) cl.setLayout(setWidth(layout, c.nom, fitWidth(c.label, columnValues(col))));
  };

  const headerContextMenu = (e: MouseEvent, col: number): void => {
    const c = data.cols[col];
    if (!c) return;
    setSel((s) => ({ ...s, col }));
    const hidden = layout.hidden.filter((n) => colNames.includes(n));
    const only = shown.length <= 1;
    const copyColumn = (): void => {
      const values = columnValues(col);
      void navigator.clipboard.writeText(toTsv(values.map((v) => [v])));
      ctx.notify(G.copied(values.length), 'success');
    };
    context.open(e, [
      { id: 'az', label: S.ds.sortAZ, icon: 'text_sort_ascending', onClick: () => sortBy(col, false) },
      { id: 'za', label: S.ds.sortZA, icon: 'text_sort_descending', onClick: () => sortBy(col, true) },
      { id: 's1', kind: 'separator' },
      customFilterMenu(c),
      { id: 's1b', kind: 'separator' },
      { id: 'copy', label: G.copyColumn, icon: 'copy', onClick: copyColumn },
      { id: 's2', kind: 'separator' },
      { id: 'width', label: G.fieldWidth, onClick: () => void ctx.prompt(G.fieldWidth, G.fieldWidthPrompt, String(Math.round(layout.widths[c.nom] ?? 130))).then((v) => {
        if (v === null) return;
        const n = Number(v.trim().replace(',', '.'));
        if (Number.isFinite(n) && n >= 40 && n <= 800) cl.setLayout(setWidth(layout, c.nom, n));
        else ctx.notify(G.badWidth, 'error');
      }) },
      { id: 'fit', label: G.fitWidth, onClick: () => fitColumn(col) },
      { id: 'std', label: G.defaultWidth, disabled: layout.widths[c.nom] === undefined, onClick: () => cl.setLayout(resetWidth(layout, c.nom)) },
      { id: 's3', kind: 'separator' },
      { id: 'hide', label: G.hideField, icon: 'eye_off', disabled: only, onClick: () => cl.setLayout(hideColumn(layout, colNames, c.nom)) },
      { id: 'show', label: G.showFields, disabled: hidden.length === 0, items: [
        { id: 'all', label: G.showAllFields, onClick: () => cl.setLayout(showAll(layout)) },
        { id: 's', kind: 'separator' },
        ...hidden.map((n): MenuItem => ({ id: `h-${n}`, label: G.showField(n), onClick: () => cl.setLayout(showColumn(layout, n)) })),
      ] },
      { id: 'freeze', label: G.freeze, onClick: () => cl.setLayout(freezeColumns(layout, colNames, shown.indexOf(col) + 1)) },
      { id: 'unfreeze', label: G.unfreeze, disabled: layout.frozen === 0, onClick: () => cl.setLayout(freezeColumns(layout, colNames, 0)) },
      { id: 's4', kind: 'separator' },
      { id: 'del', label: G.deleteField, icon: 'delete', disabled: !data.editable, onClick: () => void patchField(() => undefined, true) },
    ]);
  };

  const rowMenu = (e: MouseEvent, row: number): void => {
    e.preventDefault();
    const real = row < data.rows.length;
    setSel((s) => ({ ...s, row }));
    setExtent(real ? rowRange(row, shown) : null);
    context.open(e, [
      { id: 'new', label: G.newRecord, icon: 'add', disabled: !data.editable, onClick: () => setSel({ row: data.rows.length, col: shown[0] ?? 0 }) },
      { id: 'copy', label: G.rowCopy, icon: 'copy', disabled: !real, onClick: () => {
        const text = shown.map((c) => displayValue(data.rows[row]?.[c] ?? null, data.cols[c]?.type ?? null));
        void navigator.clipboard.writeText(toTsv([text]));
        ctx.notify(G.rowCopied, 'success');
      } },
      { id: 'del', label: G.deleteRecord, icon: 'delete', disabled: !data.editable || !real, onClick: () => void deleteRecord() },
      { id: 's', kind: 'separator' },
      { id: 'height', label: G.rowHeight, onClick: () => void ctx.prompt(G.rowHeight, G.rowHeightPrompt, String(layout.rowHeight ?? 22)).then((v) => {
        if (v === null) return;
        const n = Number(v.trim().replace(',', '.'));
        if (Number.isFinite(n) && n >= ROW_MIN && n <= ROW_MAX) cl.setLayout(setRowHeight(layout, n));
        else ctx.notify(G.badRowHeight, 'error');
      }) },
      { id: 'stdheight', label: G.rowHeightDefault, disabled: layout.rowHeight === undefined, onClick: () => cl.setLayout(setRowHeight(layout, null)) },
    ]);
  };

  const cellMenu = (e: MouseEvent, row: number, col: number): void => {
    setSel({ row, col });
    const c = data.cols[col];
    if (!c) return;
    const v = displayValue(cellValue(row, col), c.type);
    context.open(e, [
      { id: 'cut', label: S.cmd.cut, icon: 'cut', disabled: !data.editable, onClick: () => { void navigator.clipboard.writeText(v); void writeCell(row, col, ''); } },
      { id: 'copy', label: S.cmd.copy, icon: 'copy', onClick: () => void navigator.clipboard.writeText(v) },
      { id: 'paste', label: S.cmd.paste, icon: 'clipboard_paste', disabled: !data.editable, onClick: () => void navigator.clipboard.readText().then((t) => writeCell(row, col, t)) },
      { id: 's1', kind: 'separator' },
      { id: 'az', label: S.ds.sortAZ, icon: 'text_sort_ascending', onClick: () => sortBy(col, false) },
      { id: 'za', label: S.ds.sortZA, icon: 'text_sort_descending', onClick: () => sortBy(col, true) },
      { id: 's2', kind: 'separator' },
      { id: 'eq', label: S.cmd.equals(v), onClick: () => filterBy('egal', { row, col }) },
      { id: 'ne', label: S.cmd.notEquals(v), onClick: () => filterBy('different', { row, col }) },
      { id: 'ct', label: S.cmd.contains(v), onClick: () => filterBy('contient', { row, col }) },
      { id: 's3', kind: 'separator' },
      { id: 'del', label: S.cmd.deleteRecord, icon: 'delete', disabled: !data.editable || row >= data.rows.length, onClick: () => void deleteRecord() },
    ]);
  };

  const renderCell = (row: number, col: number, c: Col) => {
    const isNew = row >= data.rows.length;
    if (editing && editing.row === row && editing.col === col) {
      const list = c.rule.liste_valeurs ?? [];
      return (
        <>
          <input
            autoFocus
            className="acc-ds__input"
            spellCheck={spell}
            value={editing.text}
            list={list.length > 0 ? `acc-list-${col}` : undefined}
            onChange={(e) => setEditing({ ...editing, text: e.currentTarget.value })}
            onBlur={() => void finishEdit('none')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void finishEdit('down');
              } else if (e.key === 'Tab') {
                e.preventDefault();
                void finishEdit('right');
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditing(null);
                gridRef.current?.focus();
              }
            }}
          />
          {list.length > 0 && <datalist id={`acc-list-${col}`}>{list.map((v) => <option key={v} value={v} />)}</datalist>}
        </>
      );
    }
    if (isNew) {
      if (c.type === 'numero_auto') return <span className="acc-ds__new">{S.ds.empty}</span>;
      return draft[c.nom] ?? '';
    }
    const v = cellValue(row, col);
    if (c.type === 'oui_non' || typeof v === 'boolean') {
      return <input type="checkbox" className="acc-ds__check" checked={v === true} readOnly={!data.editable} onChange={() => void toggleBool(row, col)} aria-label={c.label} />;
    }
    const text = displayValue(v, c.type);
    return c.type === 'lien_hypertexte' ? <span className="acc-ds__link">{text.replace(/^mailto:/, '')}</span> : text;
  };

  const marker = (row: number): string => {
    if (row >= data.rows.length) return Object.keys(draft).length > 0 ? '✎' : '*';
    if (editing?.row === row) return '✎';
    return row === sel.row ? '▶' : '';
  };

  const pageInfo = data.total === 0 ? 0 : Math.min(data.total, absIndex + 1);
  const filteredNow = filterOn && (filtres.length > 0 || search.trim() !== '');

  return (
    <div className="acc-ds">
      <div className="acc-ds__grid fo-scroll" ref={gridRef} style={layout.rowHeight ? ({ '--acc-row-h': `${layout.rowHeight}px` } as CSSProperties) : undefined} tabIndex={0} onKeyDown={onKey} aria-label={title} role="grid">
        <table>
          <thead>
            <tr>
              <th className="acc-ds__sel" />
              {shown.map((i, pos) => {
                const c = data.cols[i];
                if (!c) return null;
                const sorted = tri.find((t) => t.champ === c.nom);
                const hasFilter = filtres.some((f) => f.champ === c.nom);
                return (
                  <th key={c.nom} className={`${i === sel.col ? 'is-active' : ''}${cl.dropAt === pos ? ' is-drop-before' : ''}${cl.dropAt === shown.length && pos === shown.length - 1 ? ' is-drop-after' : ''}` || undefined} style={cl.cellStyle(c.nom, pos, true)} onClick={() => { setSel((s) => ({ ...s, col: i })); setExtent(columnRange(i, data.rows.length)); }} onContextMenu={(e) => headerContextMenu(e, i)} title={c.nom}>
                    <span className="acc-ds__hlabel" onPointerDown={(e) => cl.startMove(pos, e)}>{c.label}</span>
                    {sorted && <Icon name={sorted.descendant ? 'arrow_sort_down' : 'arrow_sort_up'} size={16} />}
                    <button type="button" className={`acc-ds__harrow${hasFilter ? ' is-on' : ''}`} aria-label={`${S.cmd.filter} ${c.label}`} onClick={(e) => headerMenu(e, i)}>
                      <Icon name={hasFilter ? 'filter' : 'chevron_down'} size={16} />
                    </button>
                    <span className="acc-ds__resize" title={G.resizeTip} onPointerDown={(e) => cl.startResize(c.nom, e)} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); fitColumn(i); }} />
                  </th>
                );
              })}
              {tableName && data.editable && (
                <th className="acc-ds__addcol">
                  <button type="button" onClick={(e) => setColMenu({ col: -1, anchor: e.currentTarget, items: ([
                    ['texte_court', S.cmd.newShortText], ['reel_double', S.cmd.newNumber], ['monetaire', S.cmd.newCurrency], ['date_heure', S.cmd.newDate], ['oui_non', S.cmd.newYesNo],
                  ] as const).map(([t, l]) => ({ id: t, label: l, onClick: () => void addField(t) })) })}>
                    {S.cmd.addField} <Icon name="chevron_down" size={16} />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, row) => (
              <tr key={row} className={`${row === sel.row ? 'is-current' : ''}${row >= data.rows.length ? ' is-new' : ''}`}>
                <td className="acc-ds__sel" onClick={() => { setSel((s) => ({ ...s, row })); setExtent(row < data.rows.length ? rowRange(row, shown) : null); }} onContextMenu={(e) => rowMenu(e, row)}>{marker(row)}</td>
                {shown.map((col, pos) => { const c = data.cols[col]; return c && (
                  <td
                    key={c.nom}
                    style={cl.cellStyle(c.nom, pos)}
                    className={`${row === sel.row && col === sel.col ? 'is-sel' : ''}${inBox(box, row, col) ? ' is-range' : ''}${isNumericType(c.type) || c.type === 'numero_auto' || (c.type === null && typeof cellValue(row, col) === 'number') ? ' is-num' : ''}`}
                    onClick={(e) => {
                      if (editing && (editing.row !== row || editing.col !== col)) void finishEdit('none');
                      if (sel.row !== row && sel.row >= data.rows.length && Object.keys(draft).length > 0) void saveNewRow();
                      setExtent(e.shiftKey && row < data.rows.length ? { a: extent?.a ?? sel, b: { row, col } } : null);
                      setSel({ row, col });
                    }}
                    onDoubleClick={() => startEdit(row, col)}
                    onContextMenu={(e) => cellMenu(e, row, col)}
                  >
                    {renderCell(row, col, c)}
                  </td>
                ); })}
                {tableName && data.editable && <td className="acc-ds__addcol" />}
              </tr>
            ))}
            {totalsOn && (
              <tr className="acc-ds__totals">
                <td className="acc-ds__sel">{S.ds.total}</td>
                {shown.map((i, pos) => data.cols[i] && ({ c: data.cols[i] as Col, pos })).filter((x): x is { c: Col; pos: number } => x !== undefined).map(({ c, pos }) => (
                  <td key={c.nom} style={cl.cellStyle(c.nom, pos)} className={isNumericType(c.type) ? 'is-num' : undefined}>
                    <select
                      value={totalFns[c.nom] ?? ''}
                      aria-label={`${S.ds.total} ${c.label}`}
                      onChange={(e) => { const v = e.currentTarget.value as FonctionTotal | ''; setTotalFns((t) => ({ ...t, [c.nom]: v })); }}
                    >
                      <option value="">{S.ds.none}</option>
                      {TOTAL_FNS.filter((fn) => isNumericType(c.type) || fn === 'compte' || ((fn === 'min' || fn === 'max') && c.type === 'date_heure')).map((fn) => (
                        <option key={fn} value={fn}>{S.totalsFn[fn]}</option>
                      ))}
                    </select>
                    {totalFns[c.nom] ? <span className="acc-ds__tval">{displayValue(totals[c.nom] ?? null, totalFns[c.nom] === 'compte' ? null : c.type)}</span> : null}
                  </td>
                ))}
                {tableName && data.editable && <td className="acc-ds__addcol" />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="acc-recnav" aria-label={S.ds.record}>
        <span>{S.ds.record} :</span>
        <button type="button" title={S.cmd.first} aria-label={S.cmd.first} disabled={page === 0 && sel.row === 0} onClick={() => { setPage(0); setSel((s) => ({ ...s, row: 0 })); }}>|◀</button>
        <button type="button" title={S.cmd.previous} aria-label={S.cmd.previous} onClick={() => (sel.row > 0 ? setSel((s) => ({ ...s, row: s.row - 1 })) : page > 0 && (setPage(page - 1), setSel((s) => ({ ...s, row: PAGE - 1 }))))}>◀</button>
        <span className="acc-recnav__pos">{pageInfo} {S.ds.of} {data.total}</span>
        <button type="button" title={S.cmd.next} aria-label={S.cmd.next} onClick={() => (sel.row < data.rows.length - 1 ? setSel((s) => ({ ...s, row: s.row + 1 })) : page < data.nbPages - 1 && (setPage(page + 1), setSel((s) => ({ ...s, row: 0 }))))}>▶</button>
        <button type="button" title={S.cmd.last} aria-label={S.cmd.last} onClick={() => { setPage(data.nbPages - 1); setSel((s) => ({ ...s, row: Math.max(0, (data.total - 1) % PAGE) })); }}>▶|</button>
        {data.editable && <button type="button" title={S.ds.newRow} aria-label={S.ds.newRow} onClick={() => { setPage(data.nbPages - 1); setSel({ row: data.rows.length, col: 0 }); }}>▶*</button>}
        <button type="button" className={`acc-recnav__filter${filteredNow ? ' is-on' : ''}`} onClick={() => filtres.length > 0 && setFilterOn((v) => !v)}>
          <Icon name="filter" size={16} /> {filteredNow ? S.ds.filtered : S.ds.unfiltered}
        </button>
        <input ref={searchRef} type="search" className="acc-recnav__search" placeholder={S.ds.search} aria-label={S.ds.search} value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(0); }} />
        {data.nbPages > 1 && <span className="acc-recnav__page">{S.ds.page} {page + 1}/{data.nbPages}</span>}
      </div>
      <CustomFilterDialog
        request={customFilter}
        onCancel={() => setCustomFilter(null)}
        onApply={(filter) => {
          setFiltres((fs) => [...fs, filter]);
          setFilterOn(true);
          setPage(0);
          setCustomFilter(null);
        }}
      />
      {colMenu && <Menu items={colMenu.items} anchor={colMenu.anchor} onClose={() => setColMenu(null)} />}
      {context.menu}
      <Dialog
        open={replaceOpen}
        title={S.cmd.replace}
        onClose={() => setReplaceOpen(false)}
        onConfirm={() => {
          setReplaceOpen(false);
          if (!tableName || !cur) return;
          db.call<number>('remplacer_tout', { table: tableName, champ: cur.nom, chercher: replace.find, remplacer: replace.by, respecter_casse: false })
            .then((n) => { ctx.notify(S.ds.replaceDone(n), 'success'); setSchema(null); }, ctx.fail);
        }}
      >
        <TextField label={S.cmd.find} value={replace.find} onChange={(e) => setReplace({ ...replace, find: e.currentTarget.value })} data-autofocus />
        <TextField label={S.cmd.replace} value={replace.by} onChange={(e) => setReplace({ ...replace, by: e.currentTarget.value })} />
        <p className="acc-muted">{cur?.label ?? ''}</p>
      </Dialog>
    </div>
  );
}

