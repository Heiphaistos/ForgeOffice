// Createur de requetes : tables glissees, jointures dessinees, grille QBE (totaux, requetes action), mode SQL, resultat.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dialog, Icon, useContextMenu } from '@forgeoffice/ui';
import { api } from '../db.ts';
import {
  OR_ROWS, addField, addJoin, addTable, definitionWithLayout, emptyQuery, fromDefinition, gridColumns, removeTable, setColumn, setTotals,
  toDefinition, validateQbe, type QbeColumn, type QbeState,
} from '../logic/qbe.ts';
import { S } from '../strings.ts';
import type { GenreJointure, Json, Operation, ResultatSql } from '../types.ts';
import { Datasheet } from './Datasheet.tsx';
import { Lines, TableBox, hasFieldDrag, readFieldDrag, type Link } from './Diagram.tsx';
import type { ViewProps } from './view-types.ts';

const OPS: readonly Operation[] = ['regroupement', 'somme', 'moyenne', 'min', 'max', 'compte', 'ecart_type', 'var', 'premier', 'dernier', 'expression', 'ou'];
const ACTION = new Set(['creation_table', 'ajout', 'mise_a_jour', 'suppression']);

interface TableInfo {
  fields: string[];
  keys: string[];
}

export function QueryDesign({ db, tab, ctx, register }: ViewProps) {
  const [q, setQ] = useState<QbeState>(emptyQuery);
  const [sql, setSql] = useState('');
  const [sqlEdited, setSqlEdited] = useState(false);
  const [result, setResult] = useState<{ serial: number; r: ResultatSql } | null>(null);
  const [info, setInfo] = useState<Record<string, TableInfo>>({});
  const [adding, setAdding] = useState(Boolean(tab.isNew));
  const [addTabKind, setAddTabKind] = useState<'table' | 'requete'>('table');
  const [pick, setPick] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [joinEdit, setJoinEdit] = useState<number | null>(null);
  const [dirty, setDirty] = useState(Boolean(tab.isNew));
  const boxMenu = useContextMenu();
  const lastView = useRef(tab.view);

  const change = useCallback((next: QbeState | ((p: QbeState) => QbeState)) => {
    setQ(next);
    setDirty(true);
    setSqlEdited(false);
  }, []);

  useEffect(() => {
    if (tab.isNew) return;
    api.query(db, tab.name).then((r) => {
      setSql(r.sql);
      if (r.definition) setQ(fromDefinition(r.definition));
      else {
        setSqlEdited(true);
        if (tab.view === 'design') ctx.patchTab(tab.id, { view: 'sql' });
      }
    }, ctx.fail);
    // Chargement unique a l'ouverture de l'onglet.
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (dirty !== Boolean(tab.dirty)) ctx.patchTab(tab.id, { dirty });
  }, [dirty, tab.dirty, tab.id, ctx]);

  // Champs des tables posees (schema du moteur ; une requete non publiee en vue reste sans champs).
  useEffect(() => {
    for (const t of q.tables) {
      if (info[t.name]) continue;
      api.schema(db, t.name).then(
        (s) => setInfo((m) => ({ ...m, [t.name]: { fields: s.champs.map((c) => c.nom), keys: s.cle_primaire } })),
        () => setInfo((m) => ({ ...m, [t.name]: { fields: [], keys: [] } })),
      );
    }
  }, [q.tables, info, db]);

  const generateSql = useCallback(async () => {
    if (sqlEdited || q.tables.length === 0) return;
    if (db.demo) {
      setSql(S.q.demoSql);
      return;
    }
    try {
      const g = await db.call<{ sql: string }>('generer_sql', { definition: toDefinition(q) });
      setSql(g.sql);
    } catch (err) {
      ctx.fail(err);
    }
  }, [sqlEdited, q, db, ctx]);

  const run = useCallback(async () => {
    try {
      const useSql = sqlEdited || (q.tables.length === 0 && sql.trim() !== '');
      const isAction = useSql ? !/^\s*(select|with)\b/i.test(sql) : ACTION.has(q.genre);
      if (!useSql) {
        const err = validateQbe(q);
        if (err) {
          ctx.notify(err, 'warning');
          return;
        }
      }
      let params: Json[] = [];
      if (!useSql && !db.demo) {
        const g = await db.call<{ parametres: string[] }>('generer_sql', { definition: toDefinition(q) });
        for (const p of g.parametres) {
          const v = await ctx.prompt(S.q.params, S.q.paramPrompt(p), '');
          if (v === null) return;
          params.push(v);
        }
      }
      if (isAction && !(await ctx.confirm(S.q.actionConfirm(tab.name)))) return;
      const r = useSql ? await api.runSql(db, sql, params) : await api.runDefinition(db, toDefinition(q), params);
      params = [];
      if (isAction || r.colonnes.length === 0) {
        ctx.notify(S.ds.actionDone(r.lignes_modifiees), 'success');
        if (tab.view === 'datasheet') ctx.patchTab(tab.id, { view: 'design' });
        await ctx.refreshObjects();
        return;
      }
      setResult((old) => ({ serial: (old?.serial ?? 0) + 1, r }));
      if (r.tronque) ctx.notify(S.ds.truncated, 'warning');
      if (tab.view !== 'datasheet') ctx.patchTab(tab.id, { view: 'datasheet' });
    } catch (err) {
      ctx.fail(err);
      if (tab.view === 'datasheet') ctx.patchTab(tab.id, { view: lastView.current === 'datasheet' ? 'design' : lastView.current });
    }
  }, [sqlEdited, q, sql, db, ctx, tab]);

  // Changement de mode depuis le ruban ou la barre d'etat.
  useEffect(() => {
    if (tab.view === 'datasheet' && lastView.current !== 'datasheet') void run();
    if (tab.view === 'sql') void generateSql();
    lastView.current = tab.view;
    // Reaction au seul changement de mode.
    // eslint-disable-next-line
  }, [tab.view]);

  const save = useCallback(async () => {
    try {
      let nom = tab.name;
      if (tab.isNew) {
        const v = await ctx.prompt(S.dlg.saveAs, S.dlg.saveAsLabel(S.kinds.requete ?? ''), tab.name);
        if (!v) return;
        nom = v;
      }
      const genre = sqlEdited ? (/^\s*(select|with)\b/i.test(sql) ? 'selection' : 'sql_direct') : q.genre;
      await db.call('enregistrer_requete', { requete: { nom, genre, sql: sqlEdited ? sql : '', definition: sqlEdited ? null : definitionWithLayout(q) } });
      ctx.patchTab(tab.id, { name: nom, isNew: false });
      setDirty(false);
      ctx.notify(S.q.saved(nom), 'success');
      await ctx.refreshObjects();
    } catch (err) {
      ctx.fail(err);
    }
  }, [tab, ctx, sqlEdited, sql, q, db]);

  useEffect(() => {
    if (tab.view === 'datasheet') return;
    register({
      save: db.readOnly ? undefined : () => void save(),
      run: () => (ACTION.has(q.genre) && !sqlEdited ? void run() : ctx.patchTab(tab.id, { view: 'datasheet' })),
      queryType: q.genre,
      setQueryType: (t) => change((p) => ({ ...p, genre: t, totals: t === 'analyse_croisee' ? true : p.totals })),
      showTables: () => setAdding(true),
      totalsRow: q.totals,
      toggleTotalsRow: () => change((p) => setTotals(p, !p.totals)),
      top: q.top,
      setTop: (n) => change((p) => ({ ...p, top: n })),
      print: () => ctx.services.print(),
    });
  });

  const sources = useMemo(
    () => ctx.objects.filter((o) => (addTabKind === 'table' ? o.genre === 'table' : o.genre === 'requete' || o.genre === 'vue')).map((o) => o.nom).sort((a, b) => a.localeCompare(b, 'fr')),
    [ctx.objects, addTabKind],
  );

  const fieldsOf = (name: string): string[] => ['*', ...(info[name]?.fields ?? [])];
  const links: Link[] = q.joins.map((j, i) => ({
    id: String(i),
    from: { table: j.gauche, field: j.champ_gauche },
    to: { table: j.droite, field: j.champ_droite },
    arrow: j.genre !== 'interne',
    labels: undefined,
  }));
  const cols = gridColumns(q);
  const fieldOptions = q.tables.flatMap((t) => fieldsOf(t.name).map((f) => `${t.name}.${f}`));
  const editing = joinEdit !== null ? q.joins[joinEdit] : undefined;

  const setCol = (i: number, patch: Partial<QbeColumn>): void => change((p) => setColumn(p, i, patch));
  const fieldText = (c: QbeColumn): string => c.field;

  if (tab.view === 'datasheet') {
    return result ? <Datasheet key={result.serial} db={db} ctx={ctx} register={register} source={{ kind: 'result', title: tab.name, result: result.r }} /> : <div className="acc-empty">{S.ds.loading}</div>;
  }

  if (tab.view === 'sql') {
    return (
      <div className="acc-sql">
        <textarea
          spellCheck={false}
          value={sql}
          placeholder={S.q.sqlPlaceholder}
          readOnly={db.demo}
          aria-label={S.views.sql}
          onChange={(e) => {
            setSql(e.currentTarget.value);
            setSqlEdited(true);
            setDirty(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="acc-qd">
      <div className="acc-qd__top">
        <div
          className="acc-qd__canvas fo-scroll"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLink(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Delete' && link !== null) {
              change((p) => ({ ...p, joins: p.joins.filter((_, i) => String(i) !== link) }));
              setLink(null);
            }
          }}
          tabIndex={0}
        >
          <Lines boxes={q.tables} fieldsOf={fieldsOf} links={links} selected={link} onSelect={setLink} onOpen={(id) => setJoinEdit(Number(id))} />
          {q.tables.map((t) => (
            <TableBox
              key={t.name}
              box={t}
              fields={fieldsOf(t.name)}
              keys={info[t.name]?.keys ?? []}
              onMove={(x, y) => setQ((p) => ({ ...p, tables: p.tables.map((b) => (b.name === t.name ? { ...b, x, y } : b)) }))}
              onFieldDoubleClick={(f) => change((p) => addField(p, t.name, f))}
              onFieldDrop={(from, to) => change((p) => addJoin(p, { gauche: from.table, champ_gauche: from.field, droite: t.name, champ_droite: to, genre: 'interne' }))}
              onHeaderDoubleClick={() => change((p) => addField(p, t.name, '*'))}
              onContextMenu={(e) => boxMenu.open(e, [{ id: 'rm', label: S.q.removeTable, icon: 'delete', onClick: () => change((p) => removeTable(p, t.name)) }])}
            />
          ))}
        </div>
        {adding && (
          <aside className="acc-addpane" aria-label={S.q.addTables}>
            <div className="acc-addpane__head">
              <span>{S.q.addTables}</span>
              <button type="button" className="acc-icon-btn" aria-label={S.dlg.cancel} onClick={() => setAdding(false)}><Icon name="dismiss" size={16} /></button>
            </div>
            <div className="acc-addpane__tabs" role="tablist">
              <button type="button" role="tab" aria-selected={addTabKind === 'table'} className={addTabKind === 'table' ? 'is-on' : undefined} onClick={() => setAddTabKind('table')}>{S.q.tablesTab}</button>
              <button type="button" role="tab" aria-selected={addTabKind === 'requete'} className={addTabKind === 'requete' ? 'is-on' : undefined} onClick={() => setAddTabKind('requete')}>{S.q.queriesTab}</button>
            </div>
            <ul className="acc-addpane__list fo-scroll">
              {sources.map((n) => (
                <li key={n}>
                  <button type="button" className={pick === n ? 'is-selected' : undefined} onClick={() => setPick(n)} onDoubleClick={() => change((p) => addTable(p, n))}>
                    <Icon name={addTabKind === 'table' ? 'table' : 'database_search'} size={16} /> {n}
                  </button>
                </li>
              ))}
            </ul>
            <div className="acc-addpane__foot">
              <Button appearance="primary" disabled={!pick} onClick={() => pick && change((p) => addTable(p, pick))}>{S.q.add}</Button>
            </div>
          </aside>
        )}
      </div>
      <div className="acc-qbe fo-scroll">
        <table>
          <tbody>
            <tr className="acc-qbe__colsel">
              <th />
              {cols.map((c, i) => (
                <td key={i} onContextMenu={(e) => i < q.columns.length && boxMenu.open(e, [{ id: 'd', label: S.cmd.deleteRows, icon: 'delete', onClick: () => change((p) => ({ ...p, columns: p.columns.filter((_, k) => k !== i) })) }])} />
              ))}
            </tr>
            <tr>
              <th>{S.q.field}</th>
              {cols.map((c, i) => (
                <td
                  key={i}
                  onDragOver={(e) => hasFieldDrag(e) && e.preventDefault()}
                  onDrop={(e) => {
                    const f = readFieldDrag(e);
                    if (f) {
                      e.preventDefault();
                      setCol(i, { table: f.table, field: f.field, total: q.totals ? 'regroupement' : '' });
                    }
                  }}
                >
                  <input
                    list="acc-qbe-fields"
                    value={fieldText(c)}
                    aria-label={`${S.q.field} ${i + 1}`}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      const dot = q.tables.find((t) => v.startsWith(`${t.name}.`));
                      setCol(i, dot ? { table: dot.name, field: v.slice(dot.name.length + 1) } : { field: v, table: c.table || (q.tables.length === 1 ? (q.tables[0]?.name ?? '') : '') });
                    }}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <th>{S.q.table}</th>
              {cols.map((c, i) => (
                <td key={i}>
                  <select value={c.table} aria-label={`${S.q.table} ${i + 1}`} onChange={(e) => setCol(i, { table: e.currentTarget.value })}>
                    <option value="" />
                    {q.tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </td>
              ))}
            </tr>
            {q.totals && (
              <tr>
                <th>{S.q.total}</th>
                {cols.map((c, i) => (
                  <td key={i}>
                    <select value={c.total} aria-label={`${S.q.total} ${i + 1}`} onChange={(e) => setCol(i, { total: e.currentTarget.value as Operation })}>
                      {OPS.map((o) => <option key={o} value={o}>{S.q.ops[o]}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            )}
            {q.genre === 'analyse_croisee' && (
              <tr>
                <th>{S.q.crosstab}</th>
                {cols.map((c, i) => (
                  <td key={i}>
                    <select value={c.crosstab} aria-label={`${S.q.crosstab} ${i + 1}`} onChange={(e) => setCol(i, { crosstab: e.currentTarget.value as QbeColumn['crosstab'] })}>
                      <option value="" />
                      <option value="en_tete_ligne">{S.q.rowHeading}</option>
                      <option value="en_tete_colonne">{S.q.colHeading}</option>
                      <option value="valeur">{S.q.value}</option>
                    </select>
                  </td>
                ))}
              </tr>
            )}
            {q.genre === 'ajout' && (
              <tr>
                <th>{S.q.appendTo}</th>
                {cols.map((c, i) => <td key={i}><input value={c.appendTo} aria-label={`${S.q.appendTo} ${i + 1}`} onChange={(e) => setCol(i, { appendTo: e.currentTarget.value })} /></td>)}
              </tr>
            )}
            {q.genre === 'mise_a_jour' && (
              <tr>
                <th>{S.q.update}</th>
                {cols.map((c, i) => <td key={i}><input value={c.update} aria-label={`${S.q.update} ${i + 1}`} onChange={(e) => setCol(i, { update: e.currentTarget.value })} /></td>)}
              </tr>
            )}
            {q.genre !== 'mise_a_jour' && q.genre !== 'suppression' && (
              <tr>
                <th>{S.q.sort}</th>
                {cols.map((c, i) => (
                  <td key={i}>
                    <select value={c.sort} aria-label={`${S.q.sort} ${i + 1}`} onChange={(e) => setCol(i, { sort: e.currentTarget.value as QbeColumn['sort'] })}>
                      <option value="">{S.q.notSorted}</option>
                      <option value="croissant">{S.q.asc}</option>
                      <option value="decroissant">{S.q.desc}</option>
                    </select>
                  </td>
                ))}
              </tr>
            )}
            {(q.genre === 'selection' || q.genre === 'creation_table') && (
              <tr>
                <th>{S.q.show}</th>
                {cols.map((c, i) => (
                  <td key={i} className="is-center">
                    <input type="checkbox" checked={c.show} disabled={c.field === ''} aria-label={`${S.q.show} ${i + 1}`} onChange={(e) => setCol(i, { show: e.currentTarget.checked })} />
                  </td>
                ))}
              </tr>
            )}
            {Array.from({ length: OR_ROWS + 1 }, (_, r) => (
              <tr key={`c${r}`}>
                <th>{r === 0 ? S.q.criteria : r === 1 ? S.q.or : ''}</th>
                {cols.map((c, i) => (
                  <td key={i}>
                    <input
                      value={c.criteria[r] ?? ''}
                      aria-label={`${r === 0 ? S.q.criteria : S.q.or} ${i + 1}`}
                      onChange={(e) => {
                        const crit = [...c.criteria];
                        while (crit.length <= r) crit.push('');
                        crit[r] = e.currentTarget.value;
                        setCol(i, { criteria: crit });
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="acc-qbe-fields">{fieldOptions.map((f) => <option key={f} value={f} />)}</datalist>
        {(q.genre === 'ajout' || q.genre === 'creation_table') && (
          <label className="acc-qbe__target">
            {S.q.target}
            <input value={q.target} list="acc-qbe-targets" onChange={(e) => { const v = e.currentTarget.value; change((p) => ({ ...p, target: v })); }} />
            <datalist id="acc-qbe-targets">{ctx.objects.filter((o) => o.genre === 'table').map((o) => <option key={o.nom} value={o.nom} />)}</datalist>
          </label>
        )}
      </div>
      <Dialog
        open={editing !== undefined}
        title={S.q.joinProps}
        onClose={() => setJoinEdit(null)}
        actions={[
          { label: S.dlg.ok, primary: true, onClick: () => setJoinEdit(null) },
          { label: S.q.deleteJoin, onClick: () => { change((p) => ({ ...p, joins: p.joins.filter((_, i) => i !== joinEdit) })); setJoinEdit(null); } },
        ]}
      >
        {editing && (
          <div className="acc-radios">
            {(['interne', 'gauche', 'droite'] as GenreJointure[]).map((g) => (
              <label key={g}>
                <input
                  type="radio"
                  name="acc-join"
                  checked={editing.genre === g}
                  onChange={() => change((p) => ({ ...p, joins: p.joins.map((j, i) => (i === joinEdit ? { ...j, genre: g } : j)) }))}
                />
                {g === 'interne' ? S.q.joinInner : g === 'gauche' ? S.q.joinLeft(editing.gauche, editing.droite) : S.q.joinRight(editing.gauche, editing.droite)}
              </label>
            ))}
          </div>
        )}
      </Dialog>
      {boxMenu.menu}
    </div>
  );
}
