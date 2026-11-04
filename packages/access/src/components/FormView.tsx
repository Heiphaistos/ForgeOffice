// Formulaires : mode Formulaire (navigation, saisie, ajout) et mode Page/Creation (controles deplacables).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@forgeoffice/ui';
import { api, readAll } from '../db.ts';
import { displayValue, editText, isNumericType, parseInput, type FieldRule } from '../logic/values.ts';
import { S } from '../strings.ts';
import type { Controle, Json, Maquette, Row, SchemaTable } from '../types.ts';
import { Datasheet } from './Datasheet.tsx';
import { DesignCanvas, sectionHeight, updateControl, type CanvasSel } from './DesignCanvas.tsx';
import type { ViewProps } from './view-types.ts';

const SECTIONS = ['entete', 'detail', 'pied'] as const;
const LABEL_W = 144;

interface Records {
  columns: string[];
  rows: Json[][];
  keys: Row[] | null;
  rules: Map<string, FieldRule>;
  editable: boolean;
}

export function isMaquette(v: unknown): v is Maquette {
  return typeof v === 'object' && v !== null && 'sections' in v && typeof (v as { sections: unknown }).sections === 'object';
}

/** Charge un formulaire ou un etat (graine d'un objet neuf ou objet enregistre). */
export function useMaquette({ db, tab, ctx }: Pick<ViewProps, 'db' | 'tab' | 'ctx'>, genre: 'formulaire' | 'etat'): [Maquette | null, (m: Maquette) => void] {
  const [m, setM] = useState<Maquette | null>(isMaquette(tab.seed) ? tab.seed : null);
  useEffect(() => {
    if (isMaquette(tab.seed) || tab.isNew) return;
    db.call<{ contenu: unknown }>('lire_objet', { genre, nom: tab.name }).then((o) => (isMaquette(o.contenu) ? setM(o.contenu) : ctx.notify(S.err.generic(tab.name), 'error')), ctx.fail);
  }, [db, tab.name, tab.seed, tab.isNew, genre, ctx]);
  return [m, setM];
}

/** Lignes de la source d'un formulaire ou d'un etat : table (modifiable) ou requete (lecture seule). */
export function useRecords({ db, ctx }: Pick<ViewProps, 'db' | 'ctx'>, source: string | undefined, serial: number): Records | null {
  const [rec, setRec] = useState<Records | null>(null);
  const isTable = ctx.objects.some((o) => o.genre === 'table' && o.nom === source);
  useEffect(() => {
    if (!source) return;
    let alive = true;
    void (async () => {
      try {
        if (isTable) {
          const [sc, all] = await Promise.all([api.schema(db, source), readAll(db, source)]);
          const rules = new Map(sc.champs.map((c) => [c.nom, { nom: c.nom, type: c.type, requis: c.proprietes.requis, taille: c.proprietes.taille, liste_valeurs: c.proprietes.liste_valeurs, limiter_a_liste: c.proprietes.limiter_a_liste } as FieldRule]));
          if (alive) setRec({ columns: all.colonnes.map((c) => c.nom), rows: all.lignes, keys: all.cles, rules, editable: all.modifiable && !db.readOnly });
        } else {
          const r = await api.runQuery(db, source);
          if (alive) setRec({ columns: r.colonnes.map((c) => c.nom), rows: r.lignes, keys: null, rules: new Map(r.colonnes.map((c) => [c.nom, { nom: c.nom, type: c.type }])), editable: false });
        }
      } catch (err) {
        ctx.fail(err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [db, source, isTable, serial, ctx]);
  return rec;
}

export function FormView({ db, tab, ctx, register }: ViewProps) {
  const [m, setM] = useMaquette({ db, tab, ctx }, 'formulaire');
  const [serial, setSerial] = useState(0);
  const rec = useRecords({ db, ctx }, m?.source, serial);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<CanvasSel | null>(null);
  const [fieldList, setFieldList] = useState(false);
  const [dirty, setDirty] = useState(Boolean(tab.isNew));
  const [schema, setSchema] = useState<SchemaTable | null>(null);
  const design = tab.view === 'layout' || tab.view === 'design';
  const count = rec?.rows.length ?? 0;
  const isNewRow = index >= count;

  useEffect(() => {
    if (m?.source) api.schema(db, m.source).then(setSchema, () => setSchema(null));
  }, [db, m?.source]);

  useEffect(() => {
    if (dirty !== Boolean(tab.dirty)) ctx.patchTab(tab.id, { dirty });
  }, [dirty, tab.dirty, tab.id, ctx]);

  const valueOf = useCallback((champ: string): Json => {
    const i = rec?.columns.indexOf(champ) ?? -1;
    return i < 0 ? null : (rec?.rows[index]?.[i] ?? null);
  }, [rec, index]);

  const commit = useCallback(async (): Promise<boolean> => {
    if (!rec || !m || Object.keys(draft).length === 0) return true;
    const valeurs: Record<string, Json> = {};
    for (const [k, text] of Object.entries(draft)) {
      const parsed = parseInput(text, rec.rules.get(k) ?? { nom: k, type: null });
      if (!parsed.ok) {
        ctx.notify(parsed.error, 'error');
        return false;
      }
      valeurs[k] = parsed.value;
    }
    try {
      if (isNewRow) await db.call('inserer', { table: m.source, valeurs });
      else await db.call('modifier', { table: m.source, cle: rec.keys?.[index], valeurs });
      ctx.notify(isNewRow ? S.ds.added : S.ds.saved, 'success');
      setDraft({});
      setSerial((s) => s + 1);
      return true;
    } catch (err) {
      ctx.fail(err);
      return false;
    }
  }, [rec, m, draft, isNewRow, db, index, ctx]);

  const go = useCallback(async (i: number) => {
    if (!(await commit())) return;
    setIndex(Math.max(0, Math.min(count + (rec?.editable ? 0 : -1), i)));
  }, [commit, count, rec]);

  const save = useCallback(async () => {
    if (!m) return;
    try {
      let nom = tab.name;
      if (tab.isNew) {
        const v = await ctx.prompt(S.dlg.saveAs, S.dlg.saveAsLabel(S.kinds.formulaire ?? ''), tab.name);
        if (!v) return;
        nom = v;
      }
      await db.call('enregistrer_objet', { genre: 'formulaire', nom, contenu: m, description: null });
      ctx.patchTab(tab.id, { name: nom, isNew: false, seed: undefined });
      setDirty(false);
      ctx.notify(S.forms.saved(nom), 'success');
      await ctx.refreshObjects();
    } catch (err) {
      ctx.fail(err);
    }
  }, [m, tab, ctx, db]);

  const change = (next: Maquette): void => {
    setM(next);
    setDirty(true);
  };

  const addControl = (c: Controle): void => {
    if (!m) return;
    const detail = m.sections.detail ?? { controles: [] };
    const y = sectionHeight(m, 'detail');
    change({ ...m, sections: { ...m.sections, detail: { ...detail, controles: [...detail.controles, { ...c, y }] } } });
  };

  useEffect(() => {
    register(design
      ? {
          save: db.readOnly ? undefined : () => void save(),
          addControl: (type) => addControl(type === 'etiquette'
            ? { type, texte: S.cmd.label, x: 16, y: 0, largeur: 160, hauteur: 24 }
            : { type, source: '', etiquette: S.cmd.textbox, x: 160, y: 0, largeur: 240, hauteur: 24 }),
          toggleFieldList: () => setFieldList((v) => !v),
          print: () => ctx.services.print(),
        }
      : {
          save: db.readOnly ? undefined : () => void save(),
          saveRecord: rec?.editable ? () => void commit() : undefined,
          newRecord: rec?.editable ? () => void go(count) : undefined,
          deleteRecord: rec?.editable && !isNewRow ? () => void (async () => {
            if (!(await ctx.confirm(`${S.ds.deleteConfirm(1)}\n\n${S.ds.deleteWarn}`))) return;
            await db.call('supprimer', { table: m?.source, cles: [rec.keys?.[index]] }).catch(ctx.fail);
            setSerial((s) => s + 1);
          })() : undefined,
          goTo: (w) => void go(w === 'first' ? 0 : w === 'last' ? count - 1 : w === 'previous' ? index - 1 : w === 'next' ? index + 1 : count),
          refresh: () => setSerial((s) => s + 1),
          print: () => ctx.services.print(),
        });
  });

  const onKeyDesign = (e: React.KeyboardEvent): void => {
    if (e.key === 'Delete' && sel && m && (e.target as HTMLElement).tagName !== 'INPUT') change(updateControl(m, sel, null));
  };

  const usedFields = useMemo(() => new Set(Object.values(m?.sections ?? {}).flatMap((s) => s.controles.map((c) => c.champ ?? ''))), [m]);

  if (!m) return <div className="acc-empty">{S.ds.loading}</div>;

  if (design) {
    return (
      <div className="acc-formdesign" tabIndex={0} onKeyDown={onKeyDesign}>
        <div className="acc-formdesign__scroll fo-scroll">
          <DesignCanvas maquette={m} sections={SECTIONS.filter((k) => m.sections[k])} selected={sel} onSelect={setSel} onChange={change} labels width={760} />
          <p className="acc-muted">{S.forms.dragHint}</p>
        </div>
        {fieldList && (
          <aside className="acc-addpane">
            <div className="acc-addpane__head"><span>{S.forms.fieldList}</span></div>
            <ul className="acc-addpane__list fo-scroll">
              {(schema?.champs ?? []).map((c) => (
                <li key={c.nom}>
                  <button type="button" disabled={usedFields.has(c.nom)} onDoubleClick={() => addControl({ type: c.type === 'oui_non' ? 'case_a_cocher' : 'zone_texte', nom: c.nom, champ: c.nom, etiquette: c.nom, x: 160, y: 0, largeur: 240, hauteur: 24 })}>
                    <Icon name="text_field" size={16} /> {c.nom}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    );
  }

  const disposition = m.disposition ?? 'simple';
  const input = (c: Controle) => {
    const champ = c.champ ?? '';
    const rule = rec?.rules.get(champ);
    const v = isNewRow ? null : valueOf(champ);
    const text = draft[champ] ?? (isNewRow ? '' : editText(v, rule?.type ?? null));
    const ro = !rec?.editable || c.lecture_seule === true || !champ;
    const set = (t: string): void => setDraft((d) => ({ ...d, [champ]: t }));
    const style = { left: c.x, top: c.y, width: c.largeur, height: c.hauteur };
    if (!champ) return <div className="acc-fctl is-calc" style={style}>{c.source ?? ''}</div>;
    if (c.type === 'case_a_cocher') {
      const on = draft[champ] !== undefined ? draft[champ] === 'oui' : v === true;
      return <input type="checkbox" className="acc-fctl is-check" style={{ left: c.x, top: c.y + 4 }} checked={on} disabled={ro} aria-label={c.etiquette ?? champ} onChange={(e) => set(e.currentTarget.checked ? 'oui' : 'non')} />;
    }
    if (c.type === 'zone_liste_deroulante') {
      return (
        <select className="acc-fctl" style={style} value={text} disabled={ro} aria-label={c.etiquette ?? champ} onChange={(e) => set(e.currentTarget.value)}>
          <option value="" />
          {(c.valeurs ?? rule?.liste_valeurs ?? []).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      );
    }
    if (c.type === 'zone_texte_multiligne') return <textarea className="acc-fctl" style={style} value={text} readOnly={ro} aria-label={c.etiquette ?? champ} onChange={(e) => set(e.currentTarget.value)} />;
    const isAuto = rule?.type === 'numero_auto' && isNewRow;
    return (
      <input
        className={`acc-fctl${c.aligne_droite || isNumericType(rule?.type ?? null) ? ' is-num' : ''}`}
        style={style}
        value={isAuto ? S.ds.empty : text}
        readOnly={ro}
        aria-label={c.etiquette ?? champ}
        onChange={(e) => set(e.currentTarget.value)}
      />
    );
  };

  const section = (key: (typeof SECTIONS)[number]) => {
    const s = m.sections[key];
    if (!s || s.controles.length === 0) return null;
    return (
      <div className={`acc-fsec is-${key}`} style={{ height: sectionHeight(m, key) }}>
        {s.controles.map((c, i) => (
          <div key={i}>
            {c.type === 'etiquette' ? (
              <div className={`acc-flabel${c.style === 'titre' ? ' is-title' : ''}`} style={{ left: c.x, top: c.y, width: c.largeur, height: c.hauteur }}>{c.texte}</div>
            ) : (
              <>
                {c.etiquette && <label className="acc-flabel" style={{ left: c.x - LABEL_W - 8, top: c.y, width: LABEL_W, height: 24 }}>{c.etiquette}</label>}
                {input(c)}
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  const tabular = disposition === 'tabulaire' && rec && (
    <div className="acc-ftab fo-scroll">
      <table>
        <thead><tr>{(m.sections.detail?.controles ?? []).map((c, i) => <th key={i} style={{ width: c.largeur }}>{c.etiquette ?? c.champ}</th>)}</tr></thead>
        <tbody>
          {rec.rows.map((r, ri) => (
            <tr key={ri} className={ri === index ? 'is-current' : undefined} onClick={() => setIndex(ri)}>
              {(m.sections.detail?.controles ?? []).map((c, i) => <td key={i}>{displayValue(r[rec.columns.indexOf(c.champ ?? '')] ?? null, rec.rules.get(c.champ ?? '')?.type ?? null)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const sheet = (disposition === 'feuille_donnees' || disposition === 'double_affichage') && rec && (
    <Datasheet db={db} ctx={ctx} register={disposition === 'feuille_donnees' ? register : () => undefined} source={rec.keys ? { kind: 'table', name: m.source } : { kind: 'query', name: m.source }} />
  );

  return (
    <div className="acc-form">
      {disposition === 'feuille_donnees' ? sheet : (
        <>
          <div className="acc-form__page fo-scroll">
            {section('entete')}
            {disposition === 'tabulaire' ? tabular : section('detail')}
            {section('pied')}
          </div>
          {disposition === 'double_affichage' && <div className="acc-form__split">{sheet}</div>}
          <div className="acc-recnav">
            <span>{S.ds.record} :</span>
            <button type="button" aria-label={S.cmd.first} title={S.cmd.first} onClick={() => void go(0)}>|◀</button>
            <button type="button" aria-label={S.cmd.previous} title={S.cmd.previous} onClick={() => void go(index - 1)}>◀</button>
            <span className="acc-recnav__pos">{count === 0 && !isNewRow ? S.forms.noRecord : isNewRow ? S.ds.empty : S.forms.recordOf(index + 1, count)}</span>
            <button type="button" aria-label={S.cmd.next} title={S.cmd.next} onClick={() => void go(index + 1)}>▶</button>
            <button type="button" aria-label={S.cmd.last} title={S.cmd.last} onClick={() => void go(count - 1)}>▶|</button>
            {rec?.editable && <button type="button" aria-label={S.ds.newRow} title={S.ds.newRow} onClick={() => void go(count)}>▶*</button>}
            <span className="acc-recnav__filter"><Icon name="filter" size={16} /> {S.ds.unfiltered}</span>
          </div>
        </>
      )}
    </div>
  );
}
