// Fenetre Relations : diagramme interactif, creation par glisser-deposer, integrite referentielle, cascades.
import { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, Dialog, Icon } from '@forgeoffice/ui';
import { api } from '../db.ts';
import { S } from '../strings.ts';
import type { Relation, TypeJointure } from '../types.ts';
import { Lines, TableBox, type BoxPos, type FieldRef, type Link } from './Diagram.tsx';
import type { ViewProps } from './view-types.ts';

const POS_SETTING = 'access.relations.positions';

interface Info {
  fields: string[];
  keys: string[];
}

function gridPos(i: number): { x: number; y: number } {
  return { x: 24 + (i % 4) * 240, y: 24 + Math.floor(i / 4) * 230 };
}

/** Disposition par defaut : la table la plus reliee au centre de la premiere ligne, pour eviter les traits croises. */
function hubLayout(names: string[], rels: readonly Relation[]): string[] {
  const degree = (n: string): number => rels.filter((r) => r.table_parent === n || r.table_enfant === n).length;
  const [hub, ...rest] = [...names].sort((a, b) => degree(b) - degree(a));
  return hub === undefined || rest.length === 0 ? names : [rest[0] ?? hub, hub, ...rest.slice(1)];
}

export function Relations({ db, ctx, register }: ViewProps) {
  const [rels, setRels] = useState<Relation[]>([]);
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [boxes, setBoxes] = useState<BoxPos[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ original: string | null; rel: Relation } | null>(null);
  const [adding, setAdding] = useState(false);
  const tables = ctx.objects.filter((o) => o.genre === 'table').map((o) => o.nom);
  const tablesKey = tables.join('|');

  const load = useCallback(async () => {
    try {
      const list = await api.relations(db);
      setRels(list);
      const saved = ctx.services.settings.get<Record<string, { x: number; y: number }>>(POS_SETTING, {});
      setBoxes((old) => (old.length > 0 ? old : hubLayout(tablesKey.split('|').filter(Boolean), list).map((name, i) => ({ name, ...(saved[name] ?? gridPos(i)) }))));
    } catch (err) {
      ctx.fail(err);
    }
  }, [db, ctx, tablesKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    for (const b of boxes) {
      if (info[b.name]) continue;
      api.schema(db, b.name).then((s) => setInfo((m) => ({ ...m, [b.name]: { fields: s.champs.map((c) => c.nom), keys: s.cle_primaire } })), () => undefined);
    }
  }, [boxes, info, db]);

  // Positions retenues (enregistrees apres un court delai pour ne pas ecrire a chaque pixel).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const saved = ctx.services.settings.get<Record<string, { x: number; y: number }>>(POS_SETTING, {});
      ctx.services.settings.set(POS_SETTING, { ...saved, ...Object.fromEntries(boxes.map((b) => [b.name, { x: b.x, y: b.y }])) });
    }, 400);
    return () => window.clearTimeout(t);
  }, [boxes, ctx]);
  const persist = setBoxes;

  const startCreate = (from: FieldRef, toTable: string, toField: string): void => {
    const fromIsKey = info[from.table]?.keys.includes(from.field) ?? false;
    const toIsKey = info[toTable]?.keys.includes(toField) ?? false;
    const [parent, pf, child, cf] = !fromIsKey && toIsKey ? [toTable, toField, from.table, from.field] : [from.table, from.field, toTable, toField];
    setEdit({ original: null, rel: { nom: '', table_parent: parent, champs_parent: [pf], table_enfant: child, champs_enfant: [cf], integrite: true, cascade_maj: false, suppression: 'restreindre', jointure: 'interne' } });
  };

  const submit = async (): Promise<void> => {
    if (!edit) return;
    try {
      if (edit.original) await db.call('modifier_relation', { nom: edit.original, relation: edit.rel });
      else await db.call('creer_relation', { relation: edit.rel });
      ctx.notify(S.rel.created, 'success');
      setEdit(null);
      await load();
    } catch (err) {
      ctx.fail(err);
    }
  };

  const remove = useCallback(async (nom: string) => {
    if (!(await ctx.confirm(S.rel.deleteConfirm))) return;
    try {
      await db.call('supprimer_relation', { nom });
      ctx.notify(S.rel.deleted, 'success');
      setSel(null);
      await load();
    } catch (err) {
      ctx.fail(err);
    }
  }, [ctx, db, load]);

  useEffect(() => {
    register({
      clearLayout: () => persist([]),
      allRelations: () => {
        const names = [...new Set(rels.flatMap((r) => [r.table_parent, r.table_enfant]))];
        persist(names.map((name, i) => boxes.find((b) => b.name === name) ?? { name, ...gridPos(i) }));
      },
      showTables: () => setAdding(true),
      editRelation: () => {
        const r = rels.find((x) => x.nom === sel);
        if (r) setEdit({ original: r.nom, rel: r });
      },
      deleteRecord: sel && !db.readOnly ? () => void remove(sel) : undefined,
      refresh: () => void load(),
      print: () => ctx.services.print(),
    });
  });

  const links: Link[] = rels.map((r) => ({
    id: r.nom,
    from: { table: r.table_parent, field: r.champs_parent[0] ?? '' },
    to: { table: r.table_enfant, field: r.champs_enfant[0] ?? '' },
    labels: r.integrite ? [S.rel.one, info[r.table_enfant]?.keys.join() === r.champs_enfant.join() ? S.rel.one : S.rel.many] : undefined,
  }));
  const r = edit?.rel;
  const set = (patch: Partial<Relation>): void => setEdit((e) => (e ? { ...e, rel: { ...e.rel, ...patch } } : e));
  const isOneToOne = r ? info[r.table_enfant]?.keys.join() === r.champs_enfant.join() : false;
  const parentKeyed = r ? r.champs_parent.every((f) => info[r.table_parent]?.keys.includes(f)) : false;

  return (
    <div className="acc-rel">
      <div
        className="acc-qd__canvas acc-rel__canvas fo-scroll"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Delete' && sel && !db.readOnly) void remove(sel);
        }}
      >
        <Lines boxes={boxes} fieldsOf={(n) => info[n]?.fields ?? []} links={links} selected={sel} onSelect={setSel} onOpen={(id) => {
          const x = rels.find((y) => y.nom === id);
          if (x) setEdit({ original: x.nom, rel: x });
        }} />
        {boxes.map((b) => (
          <TableBox
            key={b.name}
            box={b}
            fields={info[b.name]?.fields ?? []}
            keys={info[b.name]?.keys ?? []}
            onMove={(x, y) => setBoxes((bs) => bs.map((o) => (o.name === b.name ? { ...o, x, y } : o)))}
            onFieldDrop={db.readOnly ? undefined : (from, to) => startCreate(from, b.name, to)}
          />
        ))}
        {boxes.length === 0 && <p className="acc-muted acc-rel__hint">{S.rel.hint}</p>}
      </div>
      {adding && (
        <aside className="acc-addpane">
          <div className="acc-addpane__head">
            <span>{S.q.addTables}</span>
            <button type="button" className="acc-icon-btn" aria-label={S.dlg.cancel} onClick={() => setAdding(false)}><Icon name="dismiss" size={16} /></button>
          </div>
          <ul className="acc-addpane__list fo-scroll">
            {tables.map((n) => (
              <li key={n}>
                <button type="button" disabled={boxes.some((b) => b.name === n)} onDoubleClick={() => persist([...boxes, { name: n, ...gridPos(boxes.length) }])}>
                  <Icon name="table" size={16} /> {n}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
      <p className="acc-rel__status">{S.rel.hint}</p>
      <Dialog
        open={r !== undefined}
        title={S.rel.title}
        width={560}
        onClose={() => setEdit(null)}
        actions={[
          { label: edit?.original ? S.dlg.ok : S.rel.create, primary: true, disabled: db.readOnly, onClick: () => void submit() },
          { label: S.dlg.cancel, onClick: () => setEdit(null) },
        ]}
      >
        {r && (
          <div className="acc-reldlg">
            <table>
              <thead><tr><th>{S.rel.table}</th><th>{S.rel.related}</th></tr></thead>
              <tbody>
                <tr><td><strong>{r.table_parent}</strong></td><td><strong>{r.table_enfant}</strong></td></tr>
                <tr>
                  <td>
                    <select value={r.champs_parent[0] ?? ''} onChange={(e) => set({ champs_parent: [e.currentTarget.value] })}>
                      {(info[r.table_parent]?.fields ?? []).map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={r.champs_enfant[0] ?? ''} onChange={(e) => set({ champs_enfant: [e.currentTarget.value] })}>
                      {(info[r.table_enfant]?.fields ?? []).map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
            <Checkbox checked={r.integrite} label={S.rel.integrity} onChange={(v) => set({ integrite: v })} />
            <Checkbox checked={r.cascade_maj} disabled={!r.integrite} label={S.rel.cascadeUpdate} onChange={(v) => set({ cascade_maj: v })} />
            <Checkbox checked={r.suppression === 'cascade'} disabled={!r.integrite} label={S.rel.cascadeDelete} onChange={(v) => set({ suppression: v ? 'cascade' : 'restreindre' })} />
            <Checkbox checked={r.suppression === 'mettre_null'} disabled={!r.integrite} label={S.rel.setNull} onChange={(v) => set({ suppression: v ? 'mettre_null' : 'restreindre' })} />
            <p>{S.rel.relType} <strong>{!parentKeyed ? S.rel.indeterminate : isOneToOne ? S.rel.oneToOne : S.rel.oneToMany}</strong></p>
            <fieldset className="acc-radios">
              <legend>{S.rel.joinType}</legend>
              {(['interne', 'tous_parent', 'tous_enfant'] as TypeJointure[]).map((j) => (
                <label key={j}>
                  <input type="radio" name="acc-reljoin" checked={r.jointure === j} onChange={() => set({ jointure: j })} />
                  {j === 'interne' ? S.q.joinInner : j === 'tous_parent' ? S.q.joinLeft(r.table_parent, r.table_enfant) : S.q.joinRight(r.table_parent, r.table_enfant)}
                </label>
              ))}
            </fieldset>
            {edit?.original && !db.readOnly && <Button icon="delete" onClick={() => { const n = edit.original; setEdit(null); if (n) void remove(n); }}>{S.nav.delete}</Button>}
          </div>
        )}
      </Dialog>
    </div>
  );
}
