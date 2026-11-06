// Gestionnaire des regles de mise en forme conditionnelle : regles de la feuille ou de la selection, par ordre de priorite,
// Monter / Descendre, « Arreter si vrai », plage d'application modifiable, modification et suppression.
import { useState } from 'react';
import { Button, Checkbox, Dialog, TextField } from '@forgeoffice/ui';
import { parseSqref, sqrefName, type CellRange, type CfRule } from '@forgeoffice/xlsx';
import { S } from '../../strings/index.ts';
import type { DlgEnv } from './basic.tsx';
import { CfRuleDialog } from './cf-rule.tsx';
import { loc } from './data.tsx';

type Row = { i: number; j: number; ranges: CellRange[]; rule: CfRule };

const touches = (a: CellRange, b: CellRange): boolean => !(a.r2 < b.r1 || a.r1 > b.r2 || a.c2 < b.c1 || a.c1 > b.c2);

/** Description lisible (francais) d'une regle. */
export function describeRule(r: CfRule): string {
  const D = S.cfDescribe;
  const f = (r.formulas ?? []).map(loc).join(' ; ');
  switch (r.type) {
    case 'cellIs': return D.cellIs(S.ops[r.operator ?? 'equal'] ?? r.operator ?? '', f);
    case 'containsText': return D.containsText(r.text ?? '');
    case 'notContainsText': return D.notContainsText(r.text ?? '');
    case 'beginsWith': return D.beginsWith(r.text ?? '');
    case 'endsWith': return D.endsWith(r.text ?? '');
    case 'expression': return D.expression(f);
    case 'colorScale': return D.colorScale(r.colorScale?.colors.length ?? 2);
    case 'dataBar': return D.dataBar;
    case 'iconSet': return D.iconSet(S.iconSetNames[r.iconSet?.iconSet ?? ''] ?? r.iconSet?.iconSet ?? '');
    case 'top10': return D.top10(r.rank ?? 10, Boolean(r.percent), Boolean(r.bottom));
    case 'aboveAverage': return D.aboveAverage(r.aboveAverage !== false);
    case 'timePeriod': return D.timePeriod(r.timePeriod ?? '');
    case 'duplicateValues': return D.duplicateValues;
    case 'uniqueValues': return D.uniqueValues;
    case 'containsBlanks': return D.containsBlanks;
    case 'notContainsBlanks': return D.notContainsBlanks;
    case 'containsErrors': return D.containsErrors;
    case 'notContainsErrors': return D.notContainsErrors;
    default: return String(r.type);
  }
}

/** Regles de la feuille triees par priorite croissante (1 = la plus prioritaire). */
export function sortedRules(x: DlgEnv, scope: 'sheet' | 'selection'): Row[] {
  const sh = x.store.wb.sheets[x.si];
  const sel = x.sel.ranges;
  return (sh?.conditionalFormats ?? [])
    .flatMap((cf, i) => cf.rules.map((rule, j) => ({ i, j, ranges: cf.ranges, rule })))
    .filter((row) => scope === 'sheet' || row.ranges.some((r) => sel.some((s) => touches(r, s))))
    .sort((a, b) => a.rule.priority - b.rule.priority);
}

export function CfManageDialog({ x }: { x: DlgEnv }) {
  const [scope, setScope] = useState<'sheet' | 'selection'>('sheet');
  const [editing, setEditing] = useState<{ i: number; j: number } | null>(null);
  const [applies, setApplies] = useState<Record<string, string>>({});
  const [, refresh] = useState(0);
  const rows = sortedRules(x, scope);
  const key = (r: Row): string => `${r.i}-${r.j}`;
  const touch = (fn: Parameters<typeof x.store.commit>[0]): void => {
    x.store.commit(fn);
    refresh((n) => n + 1);
  };
  const move = (row: Row, delta: -1 | 1): void => {
    const at = rows.findIndex((r) => key(r) === key(row));
    const other = rows[at + delta];
    if (!other) return;
    touch((d) => {
      const s = d.sheet(x.si);
      const a = s.conditionalFormats[row.i]?.rules[row.j];
      const b = s.conditionalFormats[other.i]?.rules[other.j];
      if (!a || !b) return;
      const pa = a.priority;
      a.priority = b.priority;
      b.priority = pa;
    });
  };
  const setStop = (row: Row, on: boolean): void =>
    touch((d) => {
      const r = d.sheet(x.si).conditionalFormats[row.i]?.rules[row.j];
      if (!r) return;
      if (on) r.stopIfTrue = true;
      else delete r.stopIfTrue;
    });
  const remove = (row: Row): void =>
    touch((d) => {
      const s = d.sheet(x.si);
      s.conditionalFormats = s.conditionalFormats.flatMap((cf, k) => {
        if (k !== row.i) return [cf];
        const rest = cf.rules.filter((_, m) => m !== row.j);
        return rest.length ? [{ ...cf, rules: rest }] : [];
      });
    });
  const commitApplies = (row: Row): void => {
    const text = applies[key(row)];
    if (text === undefined) return;
    const parsed = parseSqref(text.replace(/\$/g, '').toUpperCase());
    if (parsed.length === 0) {
      x.notify(S.cfAppliesInvalid, 'error');
      return;
    }
    touch((d) => {
      const cf = d.sheet(x.si).conditionalFormats[row.i];
      if (cf) cf.ranges = parsed;
    });
    setApplies((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== key(row))));
  };
  if (editing) return <CfRuleDialog x={{ ...x, close: () => { setEditing(null); refresh((n) => n + 1); } }} edit={editing} />;
  const look = (r: CfRule): { color?: string; background?: string } => {
    const d = r.dxfId !== undefined ? x.store.wb.styles.dxfs[r.dxfId] : undefined;
    const rgb = (c: { rgb?: string } | undefined): string | undefined => (c?.rgb ? `#${c.rgb.slice(-6)}` : undefined);
    return { color: rgb(d?.font?.color as { rgb?: string } | undefined), background: rgb((d?.fill as { bg?: { rgb?: string } } | undefined)?.bg) };
  };
  return (
    <Dialog open title={S.cfManage} onClose={x.close} actions={[{ label: S.close, primary: true, onClick: x.close }]} width={760}>
      <div className="xl-form">
        <label>{S.cfShowFor}</label>
        <select value={scope} onChange={(e) => setScope(e.target.value as 'sheet' | 'selection')} aria-label={S.cfShowFor}>
          <option value="sheet">{S.cfScopeSheet}</option>
          <option value="selection">{S.cfScopeSelection}</option>
        </select>
      </div>
      {rows.length === 0 ? <p>{S.cfNone}</p> : (
        <table className="xl-dlg-table">
          <thead><tr><th>{S.cfRule}</th><th>{S.cfFormatCol}</th><th>{S.cfApplies}</th><th>{S.cfStop}</th><th /></tr></thead>
          <tbody>
            {rows.map((row) => {
              const lk = look(row.rule);
              return (
                <tr key={key(row)} data-cf-rule={row.rule.priority}>
                  <td>{describeRule(row.rule)}</td>
                  <td><span style={{ display: 'inline-block', minWidth: 54, padding: '1px 6px', border: '1px solid #8886', color: lk.color, background: lk.background }}>Aa</span></td>
                  <td>
                    <TextField
                      value={applies[key(row)] ?? sqrefName(row.ranges)}
                      onChange={(e) => setApplies((a) => ({ ...a, [key(row)]: e.target.value }))}
                      onBlur={() => commitApplies(row)}
                      aria-label={S.cfApplies}
                    />
                  </td>
                  <td><Checkbox checked={Boolean(row.rule.stopIfTrue)} onChange={(v) => setStop(row, v)} label="" aria-label={S.cfStop} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Button appearance="subtle" icon="arrow_up" aria-label={S.cfUp} onClick={() => move(row, -1)} />
                    <Button appearance="subtle" icon="arrow_down" aria-label={S.cfDown} onClick={() => move(row, 1)} />
                    <Button appearance="subtle" icon="edit" aria-label={S.cfEdit} onClick={() => setEditing({ i: row.i, j: row.j })} />
                    <Button appearance="subtle" icon="delete" aria-label={S.del} onClick={() => remove(row)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}
