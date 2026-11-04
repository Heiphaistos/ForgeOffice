// Mode Creation de table : grille des champs (nom, type, description), cle primaire, proprietes du champ, feuille de proprietes.
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@forgeoffice/ui';
import { api } from '../db.ts';
import { changeType, cleanFields, isNumberSize, newField, NUMBER_SIZES, toDefinitions, uiTypeOf, UI_TYPES, type NumberSize } from '../logic/field-types.ts';
import { validateName } from '../logic/values.ts';
import { S } from '../strings.ts';
import type { DefinitionChamp, Indexation, ProprietesTable, TypeChamp } from '../types.ts';
import type { ViewProps } from './view-types.ts';

const MIN_ROWS = 18;
type PropKey = 'taille' | 'size' | 'format' | 'decimales' | 'masque_saisie' | 'legende' | 'valeur_defaut' | 'valide_si' | 'message_validation' | 'requis' | 'chaine_vide_autorisee' | 'indexe' | 'alignement' | 'expression' | 'type_resultat';

const COMMON: PropKey[] = ['format', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'requis', 'indexe'];
const PROPS_BY_TYPE: Partial<Record<string, PropKey[]>> = {
  texte_court: ['taille', 'format', 'masque_saisie', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'requis', 'chaine_vide_autorisee', 'indexe', 'alignement'],
  liste_choix: ['taille', 'format', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'requis', 'indexe', 'alignement'],
  nombre: ['size', 'format', 'decimales', 'masque_saisie', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'requis', 'indexe', 'alignement'],
  grand_nombre: ['format', 'masque_saisie', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'requis', 'indexe', 'alignement'],
  monetaire: ['format', 'decimales', 'masque_saisie', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'requis', 'indexe', 'alignement'],
  date_heure: ['format', 'masque_saisie', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'requis', 'indexe', 'alignement'],
  numero_auto: ['format', 'legende', 'indexe', 'alignement'],
  oui_non: ['format', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'indexe'],
  texte_long: ['format', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'requis', 'chaine_vide_autorisee', 'alignement'],
  lien_hypertexte: ['format', 'legende', 'valeur_defaut', 'valide_si', 'message_validation', 'requis', 'chaine_vide_autorisee', 'alignement'],
  piece_jointe: ['legende', 'requis'],
  objet_ole: ['legende', 'requis'],
  calcule: ['expression', 'type_resultat', 'format', 'decimales', 'legende', 'alignement'],
};

const LABELS: Record<PropKey, string> = {
  taille: S.td.numberSize, size: S.td.numberSize, format: S.td.format, decimales: S.td.decimals, masque_saisie: S.td.mask, legende: S.td.caption,
  valeur_defaut: S.td.default, valide_si: S.td.validation, message_validation: S.td.validationText, requis: S.td.required,
  chaine_vide_autorisee: S.td.allowEmpty, indexe: S.td.indexed, alignement: S.td.align, expression: S.td.expression, type_resultat: S.td.resultType,
};

const RESULT_TYPES: readonly TypeChamp[] = ['texte_court', 'reel_double', 'entier_long', 'monetaire', 'date_heure', 'oui_non'];

export function TableDesign({ db, tab, ctx, register }: ViewProps) {
  const [fields, setFields] = useState<DefinitionChamp[]>(() => (tab.isNew ? [newField('N°', 'numero_auto')] : []));
  const [props, setProps] = useState<ProprietesTable>({});
  const [sel, setSel] = useState(0);
  const [pane, setPane] = useState<'general' | 'lookup'>('general');
  const [sheet, setSheet] = useState(false);
  const [dirty, setDirty] = useState(Boolean(tab.isNew));

  useEffect(() => {
    if (tab.isNew) return;
    api.schema(db, tab.name).then((s) => {
      setFields(toDefinitions(s.champs));
      setProps(s.proprietes);
    }, ctx.fail);
  }, [db, tab.name, tab.isNew, ctx]);

  useEffect(() => {
    if (dirty !== Boolean(tab.dirty)) ctx.patchTab(tab.id, { dirty });
  }, [dirty, tab.dirty, tab.id, ctx]);

  const edit = useCallback((i: number, patch: (f: DefinitionChamp) => DefinitionChamp) => {
    setFields((fs) => {
      const next = [...fs];
      while (next.length <= i) next.push(newField(''));
      next[i] = patch(next[i] ?? newField(''));
      return next;
    });
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    const champs = cleanFields(fields);
    if (champs.length === 0) {
      ctx.notify(S.td.noFields, 'warning');
      return;
    }
    for (const c of champs) {
      const bad = validateName(c.nom);
      if (bad) {
        ctx.notify(`${c.nom} : ${bad}`, 'error');
        return;
      }
    }
    try {
      if (tab.isNew) {
        const nom = await ctx.prompt(S.dlg.saveAs, S.dlg.saveAsLabel(S.kinds.table ?? ''), tab.name);
        if (!nom) return;
        await db.call('creer_table', { definition: { nom, champs: champs.map(({ ancien_nom: _, ...c }) => c), proprietes: props } });
        ctx.patchTab(tab.id, { name: nom, isNew: false, dirty: false });
        ctx.notify(S.td.saved(nom), 'success');
      } else {
        const rapport = await db.call<{ avertissements: string[] }>('modifier_table', { table: tab.name, champs, proprietes: props });
        const fresh = await api.schema(db, tab.name);
        setFields(toDefinitions(fresh.champs));
        ctx.notify(rapport.avertissements.length > 0 ? `${S.td.warnings} : ${rapport.avertissements.join(' ')}` : S.td.saved(tab.name), rapport.avertissements.length > 0 ? 'warning' : 'success');
      }
      setDirty(false);
      await ctx.refreshObjects();
    } catch (err) {
      ctx.fail(err);
    }
  }, [fields, props, tab, db, ctx]);

  const field = fields[sel];
  const ui = field ? uiTypeOf(field) : 'texte_court';
  const editable = !db.readOnly;

  useEffect(() => {
    register({
      save: editable ? () => void save() : undefined,
      primaryKey: editable && field ? () => edit(sel, (f) => ({ ...f, cle_primaire: !f.cle_primaire })) : undefined,
      insertRow: editable ? () => { setFields((fs) => [...fs.slice(0, sel), newField(''), ...fs.slice(sel)]); setDirty(true); } : undefined,
      deleteRow: editable && field ? () => { setFields((fs) => fs.filter((_, i) => i !== sel)); setDirty(true); } : undefined,
      togglePropertySheet: () => setSheet((v) => !v),
    });
  });

  const rows = Math.max(MIN_ROWS, fields.length + 2);
  const setProp = (key: PropKey, value: string): void => {
    edit(sel, (f) => {
      const next: DefinitionChamp = { ...f };
      const v = value.trim() === '' ? null : value;
      switch (key) {
        case 'size': return changeType({ ...next, type: value as NumberSize }, 'nombre');
        case 'taille': next.taille = v === null ? null : Math.max(1, Math.min(255, Number(v) || 255)); break;
        case 'decimales': next.decimales = v === null ? null : Math.max(0, Math.min(15, Number(v) || 0)); break;
        case 'requis': next.requis = value === 'oui'; break;
        case 'chaine_vide_autorisee': next.chaine_vide_autorisee = value === 'oui'; break;
        case 'indexe': next.indexe = value as Indexation; break;
        case 'type_resultat': next.type_resultat = value as TypeChamp; break;
        default: next[key] = v;
      }
      return next;
    });
  };

  const propInput = (key: PropKey) => {
    if (!field) return null;
    const yesNo = (on: boolean) => (
      <select value={on ? 'oui' : 'non'} disabled={!editable} onChange={(e) => setProp(key, e.currentTarget.value)}>
        <option value="oui">{S.td.yes}</option>
        <option value="non">{S.td.no}</option>
      </select>
    );
    switch (key) {
      case 'size':
        return (
          <select value={isNumberSize(field.type) ? field.type : 'entier_long'} disabled={!editable} onChange={(e) => setProp(key, e.currentTarget.value)}>
            {NUMBER_SIZES.map((n) => <option key={n} value={n}>{S.sizes[n]}</option>)}
          </select>
        );
      case 'requis': return yesNo(field.requis ?? false);
      case 'chaine_vide_autorisee': return yesNo(field.chaine_vide_autorisee ?? true);
      case 'indexe':
        return (
          <select value={field.indexe ?? 'non'} disabled={!editable} onChange={(e) => setProp(key, e.currentTarget.value)}>
            <option value="non">{S.td.indexNo}</option>
            <option value="avec_doublons">{S.td.indexDup}</option>
            <option value="sans_doublons">{S.td.indexNoDup}</option>
          </select>
        );
      case 'alignement':
        return (
          <select value={field.alignement ?? ''} disabled={!editable} onChange={(e) => setProp(key, e.currentTarget.value)}>
            <option value="">{S.td.alignAuto}</option>
            <option value="gauche">{S.td.alignLeft}</option>
            <option value="centre">{S.td.alignCenter}</option>
            <option value="droite">{S.td.alignRight}</option>
          </select>
        );
      case 'type_resultat':
        return (
          <select value={field.type_resultat ?? 'reel_double'} disabled={!editable} onChange={(e) => setProp(key, e.currentTarget.value)}>
            {RESULT_TYPES.map((t) => <option key={t} value={t}>{t === 'reel_double' || t === 'entier_long' ? S.sizes[t] : S.types[t as keyof typeof S.types]}</option>)}
          </select>
        );
      default: {
        const raw = field[key];
        return <input value={raw === null || raw === undefined ? (key === 'taille' && field.type === 'texte_court' ? '255' : '') : String(raw)} readOnly={!editable} onChange={(e) => setProp(key, e.currentTarget.value)} />;
      }
    }
  };

  const keys = PROPS_BY_TYPE[ui] ?? COMMON;

  return (
    <div className="acc-td">
      <div className="acc-td__top">
        <div className="acc-td__grid fo-scroll">
          <table>
            <thead>
              <tr>
                <th className="acc-td__sel" />
                <th>{S.td.fieldName}</th>
                <th>{S.td.dataType}</th>
                <th>{S.td.description}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, i) => {
                const f = fields[i];
                return (
                  <tr key={i} className={i === sel ? 'is-current' : undefined} onClick={() => setSel(i)}>
                    <td className="acc-td__sel">
                      {f?.cle_primaire ? <Icon name="key" size={16} /> : i === sel ? '▶' : ''}
                    </td>
                    <td>
                      <input value={f?.nom ?? ''} readOnly={!editable} aria-label={S.td.fieldName} onFocus={() => setSel(i)} onChange={(e) => {
                        const v = e.currentTarget.value;
                        edit(i, (x) => ({ ...x, nom: v }));
                      }} />
                    </td>
                    <td>
                      {f && f.nom !== '' ? (
                        <select value={uiTypeOf(f)} disabled={!editable} aria-label={S.td.dataType} onFocus={() => setSel(i)} onChange={(e) => { const v = e.currentTarget.value as (typeof UI_TYPES)[number]; edit(i, (x) => changeType(x, v)); }}>
                          {UI_TYPES.map((t) => <option key={t} value={t}>{S.types[t]}</option>)}
                        </select>
                      ) : null}
                    </td>
                    <td>
                      <input value={f?.description ?? ''} readOnly={!editable || !f} aria-label={S.td.description} onFocus={() => setSel(i)} onChange={(e) => {
                        const v = e.currentTarget.value;
                        edit(i, (x) => ({ ...x, description: v || null }));
                      }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sheet && (
          <aside className="acc-sheet">
            <h3>{S.cmd.tableProps}</h3>
            {(['description', 'valide_si', 'message_validation', 'tri', 'filtre'] as const).map((k) => (
              <label key={k} className="acc-prop">
                <span>{{ description: S.td.description, valide_si: S.td.validation, message_validation: S.td.validationText, tri: S.cmd.asc, filtre: S.cmd.filter }[k]}</span>
                <input value={props[k] ?? ''} readOnly={!editable} onChange={(e) => { const v = e.currentTarget.value; setProps((p) => ({ ...p, [k]: v || null })); setDirty(true); }} />
              </label>
            ))}
          </aside>
        )}
      </div>
      <div className="acc-td__props">
        <div className="acc-td__ptitle">{S.td.fieldProps}</div>
        <div className="acc-td__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={pane === 'general'} className={pane === 'general' ? 'is-on' : undefined} onClick={() => setPane('general')}>{S.td.general}</button>
          <button type="button" role="tab" aria-selected={pane === 'lookup'} className={pane === 'lookup' ? 'is-on' : undefined} onClick={() => setPane('lookup')}>{S.td.lookup}</button>
        </div>
        <div className="acc-td__pbody">
          <div className="acc-td__plist fo-scroll">
            {field && field.nom !== '' && pane === 'general' && keys.map((k) => (
              <label key={k} className="acc-prop">
                <span>{LABELS[k]}</span>
                {propInput(k)}
              </label>
            ))}
            {field && field.nom !== '' && pane === 'lookup' && (
              <>
                <label className="acc-prop is-tall">
                  <span>{S.td.values}</span>
                  <textarea value={(field.liste_valeurs ?? []).join('\n')} readOnly={!editable} onChange={(e) => {
                    const v = e.currentTarget.value.split('\n');
                    edit(sel, (x) => ({ ...x, liste_valeurs: v }));
                  }} />
                </label>
                <label className="acc-prop">
                  <span>{S.td.limitToList}</span>
                  <select value={field.limiter_a_liste ? 'oui' : 'non'} disabled={!editable} onChange={(e) => { const v = e.currentTarget.value === 'oui'; edit(sel, (x) => ({ ...x, limiter_a_liste: v })); }}>
                    <option value="oui">{S.td.yes}</option>
                    <option value="non">{S.td.no}</option>
                  </select>
                </label>
              </>
            )}
          </div>
          <p className="acc-td__help">{S.td.hint}</p>
        </div>
      </div>
    </div>
  );
}
