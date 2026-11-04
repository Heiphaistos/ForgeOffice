// Generateur de macros : liste d'actions avec arguments et condition, catalogue d'actions, execution.
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@forgeoffice/ui';
import { S } from '../strings.ts';
import type { EtapeMacro, Macro } from '../types.ts';
import type { ViewProps } from './view-types.ts';

/** Arguments attendus par action (cles des arguments du moteur). */
const ARGS: Record<string, string[]> = {
  ouvrir_table: ['nom'], ouvrir_requete: ['nom'], ouvrir_formulaire: ['nom'], ouvrir_etat: ['nom'], executer_requete: ['nom'],
  executer_sql: ['sql'], zone_message: ['message'], appliquer_filtre: ['filtre'], atteindre_enregistrement: ['valeur'],
  exporter: ['nom'], definir_variable: ['nom', 'valeur'], fermer_fenetre: [], imprimer: [], actualiser: [], arreter_macro: [],
};
const ACTIONS = Object.keys(ARGS);
const OBJECT_KIND: Record<string, string> = { ouvrir_table: 'table', ouvrir_requete: 'requete', executer_requete: 'requete', ouvrir_formulaire: 'formulaire', ouvrir_etat: 'etat', exporter: 'table' };

function isMacro(v: unknown): v is Macro {
  return typeof v === 'object' && v !== null && Array.isArray((v as { actions?: unknown }).actions);
}

export function MacroView({ db, tab, ctx, register }: ViewProps) {
  const [steps, setSteps] = useState<EtapeMacro[]>(() => (isMacro(tab.seed) ? tab.seed.actions : []));
  const [sel, setSel] = useState(0);
  const [dirty, setDirty] = useState(Boolean(tab.isNew));
  const [adding, setAdding] = useState('');

  useEffect(() => {
    if (tab.isNew || isMacro(tab.seed)) return;
    db.call<{ contenu: unknown }>('lire_objet', { genre: 'macro', nom: tab.name }).then((o) => isMacro(o.contenu) && setSteps(o.contenu.actions), ctx.fail);
  }, [db, tab.name, tab.isNew, tab.seed, ctx]);

  useEffect(() => {
    if (dirty !== Boolean(tab.dirty)) ctx.patchTab(tab.id, { dirty });
  }, [dirty, tab.dirty, tab.id, ctx]);

  const edit = (next: EtapeMacro[]): void => {
    setSteps(next);
    setDirty(true);
  };
  const add = (action: string): void => {
    edit([...steps, { action, arguments: Object.fromEntries((ARGS[action] ?? []).map((a) => [a, ''])) }]);
    setSel(steps.length);
  };

  const save = useCallback(async (): Promise<string | null> => {
    try {
      let nom = tab.name;
      if (tab.isNew) {
        const v = await ctx.prompt(S.dlg.saveAs, S.dlg.saveAsLabel(S.kinds.macro ?? ''), tab.name);
        if (!v) return null;
        nom = v;
      }
      await db.call('enregistrer_objet', { genre: 'macro', nom, contenu: { actions: steps }, description: null });
      ctx.patchTab(tab.id, { name: nom, isNew: false, seed: undefined });
      setDirty(false);
      ctx.notify(S.macro.saved(nom), 'success');
      await ctx.refreshObjects();
      return nom;
    } catch (err) {
      ctx.fail(err);
      return null;
    }
  }, [tab, ctx, db, steps]);

  const run = useCallback(async () => {
    const nom = dirty && !db.readOnly ? await save() : tab.name;
    if (!nom) return;
    try {
      const ui = await db.call<EtapeMacro[]>('executer_macro', { nom });
      ctx.playMacro(ui);
      ctx.notify(S.macro.done(nom), 'success');
    } catch (err) {
      ctx.fail(err);
    }
  }, [dirty, db, save, tab.name, ctx]);

  useEffect(() => {
    register({
      save: db.readOnly ? undefined : () => void save(),
      run: () => void run(),
      addAction: () => add('zone_message'),
    });
  });

  const move = (i: number, d: number): void => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j] as EtapeMacro, next[i] as EtapeMacro];
    edit(next);
    setSel(j);
  };

  return (
    <div className="acc-macro">
      <div className="acc-macro__list fo-scroll">
        {steps.length === 0 && <p className="acc-muted">{S.macro.empty}</p>}
        {steps.map((s, i) => (
          <div key={i} className={`acc-macro__step${i === sel ? ' is-selected' : ''}`} onClick={() => setSel(i)}>
            <div className="acc-macro__head">
              <select value={s.action} aria-label={S.macro.action} disabled={db.readOnly} onChange={(e) => {
                const a = e.currentTarget.value;
                edit(steps.map((x, k) => (k === i ? { ...x, action: a, arguments: Object.fromEntries((ARGS[a] ?? []).map((n) => [n, x.arguments[n] ?? ''])) } : x)));
              }}>
                {ACTIONS.map((a) => <option key={a} value={a}>{S.macro.actions[a] ?? a}</option>)}
              </select>
              <span className="acc-macro__tools">
                <button type="button" className="acc-icon-btn" title={S.macro.up} aria-label={S.macro.up} onClick={() => move(i, -1)}><Icon name="arrow_up" size={16} /></button>
                <button type="button" className="acc-icon-btn" title={S.macro.down} aria-label={S.macro.down} onClick={() => move(i, 1)}><Icon name="arrow_down" size={16} /></button>
                <button type="button" className="acc-icon-btn" title={S.macro.remove} aria-label={S.macro.remove} disabled={db.readOnly} onClick={() => edit(steps.filter((_, k) => k !== i))}><Icon name="dismiss" size={16} /></button>
              </span>
            </div>
            {(ARGS[s.action] ?? []).map((a) => {
              const kind = a === 'nom' ? OBJECT_KIND[s.action] : undefined;
              return (
                <label key={a} className="acc-prop">
                  <span>{S.macro.argNames[a] ?? a}</span>
                  {kind ? (
                    <select value={s.arguments[a] ?? ''} disabled={db.readOnly} onChange={(e) => { const v = e.currentTarget.value; edit(steps.map((x, k) => (k === i ? { ...x, arguments: { ...x.arguments, [a]: v } } : x))); }}>
                      <option value="" />
                      {ctx.objects.filter((o) => o.genre === kind || (kind === 'requete' && o.genre === 'vue')).map((o) => <option key={o.nom} value={o.nom}>{o.nom}</option>)}
                    </select>
                  ) : (
                    <input value={s.arguments[a] ?? ''} readOnly={db.readOnly} onChange={(e) => { const v = e.currentTarget.value; edit(steps.map((x, k) => (k === i ? { ...x, arguments: { ...x.arguments, [a]: v } } : x))); }} />
                  )}
                </label>
              );
            })}
            <label className="acc-prop">
              <span>{S.macro.condition}</span>
              <input value={s.condition ?? ''} readOnly={db.readOnly} onChange={(e) => { const v = e.currentTarget.value; edit(steps.map((x, k) => (k === i ? { ...x, condition: v || undefined } : x))); }} />
            </label>
          </div>
        ))}
        {!db.readOnly && (
          <div className="acc-macro__add">
            <Icon name="add" size={16} />
            <select value={adding} aria-label={S.cmd.addAction} onChange={(e) => { const v = e.currentTarget.value; if (v) add(v); setAdding(''); }}>
              <option value="">{S.cmd.addAction}</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{S.macro.actions[a] ?? a}</option>)}
            </select>
          </div>
        )}
      </div>
      <aside className="acc-addpane">
        <div className="acc-addpane__head"><span>{S.macro.action}</span></div>
        <ul className="acc-addpane__list fo-scroll">
          {ACTIONS.map((a) => (
            <li key={a}>
              <button type="button" disabled={db.readOnly} onDoubleClick={() => add(a)}><Icon name="play" size={16} /> {S.macro.actions[a] ?? a}</button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
