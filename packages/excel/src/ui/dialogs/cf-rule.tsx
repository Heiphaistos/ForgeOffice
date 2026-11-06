// « Nouvelle regle de mise en forme » (et modification d'une regle) : les six types d'Excel, parametres des nuances de
// couleurs, barres de donnees et jeux d'icones, et format personnalise (couleurs, gras, italique, souligne).
import { useState, type ReactNode } from 'react';
import { Button, Checkbox, Dialog, TextField } from '@forgeoffice/ui';
import { columnName, type Cfvo, type CfOperator, type CfRule, type DifferentialFormat, type IconSetName } from '@forgeoffice/xlsx';
import { S } from '../../strings/index.ts';
import type { DlgEnv } from './basic.tsx';
import { canon, loc } from './data.tsx';
import { FormatTabs } from './format-cells/editor.tsx';
import { useFormatCtx } from './format-cells/state.ts';
import { editsToDxf } from '../../logic/cf-format.ts';
import { isEmpty } from '../../logic/format-edits.ts';

type Kind = 'values' | 'contains' | 'rank' | 'average' | 'unique' | 'formula';
type Style = 'scale2' | 'scale3' | 'bar' | 'icons';
type Sub = { type: Cfvo['type']; value: string; color: string };

const KINDS: readonly Kind[] = ['values', 'contains', 'rank', 'average', 'unique', 'formula'];
const ICONS: readonly IconSetName[] = ['3Arrows', '3ArrowsGray', '3Flags', '3TrafficLights1', '3TrafficLights2', '3Signs', '3Symbols', '3Symbols2', '4Arrows', '4ArrowsGray', '4RedToBlack', '4Rating', '4TrafficLights', '5Arrows', '5ArrowsGray', '5Rating', '5Quarters', '3Stars', '3Triangles', '5Boxes'];
const CF_PRESETS: Record<string, { font: string; fill: string }> = {
  red: { font: '9C0006', fill: 'FFC7CE' }, yellow: { font: '9C5700', fill: 'FFEB9C' }, green: { font: '006100', fill: 'C6EFCE' },
  redFill: { font: '', fill: 'FFC7CE' }, redText: { font: '9C0006', fill: '' },
};
const rgb = (hex: string): { rgb: string } => ({ rgb: `FF${hex.replace('#', '').toUpperCase()}` });
const hexOf = (c: { rgb?: string } | undefined, fallback: string): string => (c?.rgb ? `#${c.rgb.slice(-6)}` : fallback);

const kindOf = (r: CfRule | undefined, preset: string | undefined): Kind => {
  if (!r) return preset === 'containsText' ? 'contains' : 'values';
  if (r.type === 'cellIs') return 'values';
  if (r.type === 'containsText' || r.type === 'notContainsText' || r.type === 'beginsWith' || r.type === 'endsWith' || r.type === 'containsBlanks' || r.type === 'notContainsBlanks' || r.type === 'containsErrors' || r.type === 'notContainsErrors') return 'contains';
  if (r.type === 'top10') return 'rank';
  if (r.type === 'aboveAverage') return 'average';
  if (r.type === 'duplicateValues' || r.type === 'uniqueValues') return 'unique';
  return 'formula';
};

export function CfRuleDialog({ x, preset, edit }: { x: DlgEnv; preset?: string; edit?: { i: number; j: number } }) {
  const R = S.cfRuleDlg;
  const current = edit ? x.store.wb.sheets[x.si]?.conditionalFormats[edit.i]?.rules[edit.j] : undefined;
  const unq = (f: string | undefined): string => (f && /^".*"$/.test(f) ? f.slice(1, -1).replace(/""/g, '"') : loc(f));
  const colorBased = current?.type === 'colorScale' || current?.type === 'dataBar' || current?.type === 'iconSet';
  const [kind, setKind] = useState<Kind | 'style'>(colorBased ? 'style' : kindOf(current, preset));
  // Type 1 : conditions de valeur
  const [op, setOp] = useState<CfOperator>((current?.operator && current.type === 'cellIs' ? current.operator : preset && preset !== 'containsText' ? preset : 'greaterThan') as CfOperator);
  const [v1, setV1] = useState(current ? (current.type === 'containsText' ? current.text ?? '' : unq(current.formulas?.[0])) : '');
  const [v2, setV2] = useState(current ? unq(current.formulas?.[1]) : '');
  // « Contient » : texte, vides, erreurs
  const [containsKind, setContainsKind] = useState<'containsText' | 'notContainsText' | 'beginsWith' | 'endsWith' | 'containsBlanks' | 'notContainsBlanks' | 'containsErrors' | 'notContainsErrors'>(
    current && kindOf(current, undefined) === 'contains' ? (current.type as 'containsText') : 'containsText');
  // Plus / moins eleves, moyenne, doublons
  const [bottom, setBottom] = useState(Boolean(current?.bottom));
  const [rank, setRank] = useState(String(current?.rank ?? 10));
  const [percent, setPercent] = useState(Boolean(current?.percent));
  const [above, setAbove] = useState(current?.type === 'aboveAverage' ? current.aboveAverage !== false : true);
  const [duplicates, setDuplicates] = useState(current?.type !== 'uniqueValues');
  // Style : nuances, barres, icones
  const [style, setStyle] = useState<Style>(current?.type === 'dataBar' ? 'bar' : current?.type === 'iconSet' ? 'icons' : current?.type === 'colorScale' && (current.colorScale?.colors.length ?? 2) === 3 ? 'scale3' : 'scale2');
  const scaleOf = (r: CfRule | undefined, n: 2 | 3): Sub[] => {
    const defaults: Sub[] = n === 3
      ? [{ type: 'min', value: '', color: '#F8696B' }, { type: 'percentile', value: '50', color: '#FFEB84' }, { type: 'max', value: '', color: '#63BE7B' }]
      : [{ type: 'min', value: '', color: '#FFEF9C' }, { type: 'max', value: '', color: '#63BE7B' }];
    const cs = r?.colorScale;
    if (!cs || cs.cfvos.length !== n) return defaults;
    return cs.cfvos.map((v, k) => ({ type: v.type, value: v.value ?? '', color: hexOf(cs.colors[k] as { rgb?: string } | undefined, defaults[k]?.color ?? '#888888') }));
  };
  const [scale2, setScale2] = useState<Sub[]>(scaleOf(current, 2));
  const [scale3, setScale3] = useState<Sub[]>(scaleOf(current, 3));
  const [barColor, setBarColor] = useState(hexOf(current?.dataBar?.color as { rgb?: string } | undefined, '#638EC6'));
  const [gradient, setGradient] = useState(current?.dataBar?.gradient !== false);
  const [iconSet, setIconSet] = useState<IconSetName>(current?.iconSet?.iconSet ?? '3Arrows');
  const [reverse, setReverse] = useState(Boolean(current?.iconSet?.reverse));
  // Format
  const dxf0 = current?.dxfId !== undefined ? x.store.wb.styles.dxfs[current.dxfId] : undefined;
  const [fontColor, setFontColor] = useState(hexOf(dxf0?.font?.color as { rgb?: string } | undefined, '#9C0006'));
  const [useFont, setUseFont] = useState(current ? Boolean(dxf0?.font?.color) : true);
  const [fillColor, setFillColor] = useState(hexOf((dxf0?.fill as { bg?: { rgb?: string } } | undefined)?.bg, '#FFC7CE'));
  const [useFill, setUseFill] = useState(current ? Boolean(dxf0?.fill) : true);
  const [bold, setBold] = useState(Boolean(dxf0?.font?.bold));
  const [italic, setItalic] = useState(Boolean(dxf0?.font?.italic));
  const [underline, setUnderline] = useState(Boolean(dxf0?.font?.underline));
  const [keepFormat, setKeepFormat] = useState(Boolean(current));
  // « Format... » : boite a 4 onglets (Nombre, Police, Bordure, Remplissage) ; son resultat remplace le format simple ci-dessous.
  const [custom, setCustom] = useState<DifferentialFormat | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const fmt = useFormatCtx(x.store.wb, x.si, x.sel.ranges, x.sel.active, x.value(x.sel.active.row, x.sel.active.col));

  const val = (t: string): string => (Number.isFinite(Number(t.replace(',', '.'))) && t.trim() !== '' ? t.replace(',', '.') : t.startsWith('=') ? canon(t) : `"${t.replace(/"/g, '""')}"`);
  const cfvo = (s: Sub): Cfvo => ({ type: s.type, ...(s.type === 'min' || s.type === 'max' ? {} : { value: s.type === 'formula' ? canon(s.value) : s.value }) });

  const build = (): { rule: Omit<CfRule, 'priority'>; withFormat: boolean } | null => {
    if (kind === 'style') {
      if (style === 'bar') return { rule: { type: 'dataBar', dataBar: { cfvos: [{ type: 'min' }, { type: 'max' }], color: rgb(barColor), gradient } }, withFormat: false };
      if (style === 'icons') {
        const n = Number(iconSet.charAt(0)) || 3;
        const cfvos = Array.from({ length: n }, (_, i) => ({ type: 'percent' as const, value: String(Math.round((i * 100) / n)) }));
        return { rule: { type: 'iconSet', iconSet: { iconSet, cfvos, ...(reverse ? { reverse: true } : {}) } }, withFormat: false };
      }
      const subs = style === 'scale3' ? scale3 : scale2;
      return { rule: { type: 'colorScale', colorScale: { cfvos: subs.map(cfvo), colors: subs.map((s) => rgb(s.color)) } }, withFormat: false };
    }
    if (kind === 'values') return { rule: { type: 'cellIs', operator: op, formulas: op === 'between' || op === 'notBetween' ? [val(v1), val(v2)] : [val(v1)] }, withFormat: true };
    if (kind === 'contains') {
      if (containsKind === 'containsBlanks' || containsKind === 'notContainsBlanks' || containsKind === 'containsErrors' || containsKind === 'notContainsErrors') {
        const top = x.sel.ranges[0] ?? { r1: x.sel.active.row, c1: x.sel.active.col };
        const ref = `${columnName(top.c1)}${top.r1 + 1}`;
        const formulas = { containsBlanks: `LEN(TRIM(${ref}))=0`, notContainsBlanks: `LEN(TRIM(${ref}))>0`, containsErrors: `ISERROR(${ref})`, notContainsErrors: `NOT(ISERROR(${ref}))` }[containsKind];
        return { rule: { type: containsKind, formulas: [formulas] }, withFormat: true };
      }
      if (!v1) return null;
      return { rule: { type: containsKind, operator: containsKind === 'notContainsText' ? 'notContains' : containsKind, text: v1 }, withFormat: true };
    }
    if (kind === 'rank') {
      const n = Math.max(1, Math.min(1000, Math.floor(Number(rank) || 10)));
      return { rule: { type: 'top10', rank: n, ...(percent ? { percent: true } : {}), ...(bottom ? { bottom: true } : {}) }, withFormat: true };
    }
    if (kind === 'average') return { rule: { type: 'aboveAverage', aboveAverage: above }, withFormat: true };
    if (kind === 'unique') return { rule: { type: duplicates ? 'duplicateValues' : 'uniqueValues' }, withFormat: true };
    if (!v1) return null;
    return { rule: { type: 'expression', formulas: [canon(v1)] }, withFormat: true };
  };

  const dxf = (): DifferentialFormat => custom ?? ({
    ...(useFont || bold || italic || underline ? { font: { ...(useFont ? { color: rgb(fontColor) } : {}), ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}), ...(underline ? { underline: 'single' as const } : {}) } } : {}),
    ...(useFill ? { fill: { type: 'pattern' as const, pattern: 'solid' as const, bg: rgb(fillColor) } } : {}),
  });

  const apply = (): void => {
    const built = build();
    if (!built) {
      x.notify(S.invalidRef, 'error');
      return;
    }
    const { rule, withFormat } = built;
    if (edit && current) {
      x.store.commit((d) => {
        const list = d.sheet(x.si).conditionalFormats[edit.i]?.rules;
        const old = list?.[edit.j];
        if (!list || !old) return;
        const dxfId = !withFormat ? undefined : keepFormat && !custom ? old.dxfId : d.wb.styles.dxfs.push(dxf()) - 1;
        list[edit.j] = { ...rule, priority: old.priority, ...(old.stopIfTrue ? { stopIfTrue: true } : {}), ...(dxfId !== undefined ? { dxfId } : {}) };
      });
    } else x.cmd.addCf(rule, withFormat ? dxf() : undefined);
    x.close();
  };

  const kindLabel = (k: Kind | 'style'): string => R.kinds[k] ?? '';
  const subRow = (list: Sub[], set: (s: Sub[]) => void, labels: readonly string[]): ReactNode[] =>
    list.map((s, k) => (
      <div key={k} className="xl-dlg-row" style={{ alignItems: 'center', gap: 8 }}>
        <span style={{ minWidth: 84 }}>{labels[k]}</span>
        <select value={s.type} aria-label={R.type} onChange={(e) => set(list.map((o, m) => (m === k ? { ...o, type: e.target.value as Cfvo['type'] } : o)))}>
          {(['min', 'num', 'percent', 'percentile', 'formula', 'max'] as const).map((t) => <option key={t} value={t}>{R.cfvoTypes[t]}</option>)}
        </select>
        <TextField value={s.type === 'min' || s.type === 'max' ? '' : s.value} disabled={s.type === 'min' || s.type === 'max'} aria-label={R.value} onChange={(e) => set(list.map((o, m) => (m === k ? { ...o, value: e.target.value } : o)))} />
        <input type="color" value={s.color} aria-label={R.color} onChange={(e) => set(list.map((o, m) => (m === k ? { ...o, color: e.target.value } : o)))} />
      </div>
    ));

  return (
    <Dialog open title={edit ? S.cfEdit : S.cf} onClose={x.close} onConfirm={apply} width={620}>
      <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
        <label>{R.selectType}</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind | 'style')} aria-label={R.selectType}>
          <option value="style">{kindLabel('style')}</option>
          {KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
        </select>
      </div>

      {kind === 'style' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="xl-dlg-row" style={{ gap: 8, alignItems: 'center' }}>
            <label>{R.formatStyle}</label>
            <select value={style} onChange={(e) => setStyle(e.target.value as Style)} aria-label={R.formatStyle}>
              <option value="scale2">{R.styles.scale2}</option>
              <option value="scale3">{R.styles.scale3}</option>
              <option value="bar">{R.styles.bar}</option>
              <option value="icons">{R.styles.icons}</option>
            </select>
          </div>
          {style === 'scale2' && subRow(scale2, setScale2, [R.minimum, R.maximum])}
          {style === 'scale3' && subRow(scale3, setScale3, [R.minimum, R.midpoint, R.maximum])}
          {style === 'bar' && (
            <div className="xl-dlg-row" style={{ gap: 8, alignItems: 'center' }}>
              <label>{R.barColor}</label>
              <input type="color" value={barColor} aria-label={R.barColor} onChange={(e) => setBarColor(e.target.value)} />
              <Checkbox checked={gradient} onChange={setGradient} label={R.gradient} />
            </div>
          )}
          {style === 'icons' && (
            <div className="xl-dlg-row" style={{ gap: 8, alignItems: 'center' }}>
              <select value={iconSet} onChange={(e) => setIconSet(e.target.value as IconSetName)} aria-label={R.iconSet}>
                {ICONS.map((n) => <option key={n} value={n}>{S.iconSetNames[n] ?? n}</option>)}
              </select>
              <Checkbox checked={reverse} onChange={setReverse} label={R.reverse} />
            </div>
          )}
        </div>
      )}

      {kind === 'values' && (
        <div className="xl-dlg-row" style={{ gap: 8 }}>
          <select value={op} onChange={(e) => setOp(e.target.value as CfOperator)} aria-label={R.operator}>{Object.entries(S.ops).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <TextField value={v1} onChange={(e) => setV1(e.target.value)} aria-label={S.value} data-autofocus />
          {(op === 'between' || op === 'notBetween') && <TextField value={v2} onChange={(e) => setV2(e.target.value)} aria-label={S.value} />}
        </div>
      )}
      {kind === 'contains' && (
        <div className="xl-dlg-row" style={{ gap: 8 }}>
          <select value={containsKind} onChange={(e) => setContainsKind(e.target.value as typeof containsKind)} aria-label={R.operator}>
            {Object.entries(R.containsKinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {(containsKind === 'containsText' || containsKind === 'notContainsText' || containsKind === 'beginsWith' || containsKind === 'endsWith') && <TextField value={v1} onChange={(e) => setV1(e.target.value)} aria-label={S.value} data-autofocus />}
        </div>
      )}
      {kind === 'rank' && (
        <div className="xl-dlg-row" style={{ gap: 8, alignItems: 'center' }}>
          <select value={bottom ? 'bottom' : 'top'} onChange={(e) => setBottom(e.target.value === 'bottom')} aria-label={R.operator}>
            <option value="top">{S.cfTop}</option>
            <option value="bottom">{S.cfBottom}</option>
          </select>
          <TextField value={rank} onChange={(e) => setRank(e.target.value)} aria-label={R.rank} style={{ width: 70 }} />
          <Checkbox checked={percent} onChange={setPercent} label={R.percentOfRange} />
        </div>
      )}
      {kind === 'average' && (
        <select value={above ? 'above' : 'below'} onChange={(e) => setAbove(e.target.value === 'above')} aria-label={R.operator}>
          <option value="above">{R.averageAbove}</option>
          <option value="below">{R.averageBelow}</option>
        </select>
      )}
      {kind === 'unique' && (
        <select value={duplicates ? 'dup' : 'uni'} onChange={(e) => setDuplicates(e.target.value === 'dup')} aria-label={R.operator}>
          <option value="dup">{R.duplicates}</option>
          <option value="uni">{R.uniques}</option>
        </select>
      )}
      {kind === 'formula' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <label>{S.cfFormula}</label>
          <TextField value={v1} onChange={(e) => setV1(e.target.value)} aria-label={S.cfFormula} placeholder="=$A1>100" data-autofocus />
        </div>
      )}

      {kind !== 'style' && (
        <fieldset className="xl-fs" style={{ marginTop: 12 }}>
          <legend>{R.format}</legend>
          <div className="xl-dlg-row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Button onClick={() => setFormatOpen(true)}>{R.formatButton}</Button>
            {custom && <Button appearance="subtle" onClick={() => setCustom(null)}>{R.formatClear}</Button>}
            {custom && <span>{R.formatSet}</span>}
          </div>
          {current && !custom && <Checkbox checked={keepFormat} onChange={setKeepFormat} label={S.cfKeepFormat} />}
          {!keepFormat && !custom && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="xl-dlg-row" style={{ gap: 8, alignItems: 'center' }}>
                <select aria-label={R.preset} value="" onChange={(e) => {
                  const p = CF_PRESETS[e.target.value];
                  if (!p) return;
                  setUseFont(Boolean(p.font));
                  setUseFill(Boolean(p.fill));
                  if (p.font) setFontColor(`#${p.font}`);
                  if (p.fill) setFillColor(`#${p.fill}`);
                }}>
                  <option value="">{R.preset}</option>
                  {Object.entries(S.cfPresets).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div className="xl-dlg-row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Checkbox checked={useFont} onChange={setUseFont} label={R.fontColor} />
                <input type="color" value={fontColor} aria-label={R.fontColor} onChange={(e) => { setFontColor(e.target.value); setUseFont(true); }} />
                <Checkbox checked={useFill} onChange={setUseFill} label={R.fillColor} />
                <input type="color" value={fillColor} aria-label={R.fillColor} onChange={(e) => { setFillColor(e.target.value); setUseFill(true); }} />
                <Checkbox checked={bold} onChange={setBold} label={R.bold} />
                <Checkbox checked={italic} onChange={setItalic} label={R.italic} />
                <Checkbox checked={underline} onChange={setUnderline} label={R.underline} />
              </div>
              <div style={{ padding: '6px 10px', border: '1px solid #8886', borderRadius: 4, color: useFont ? fontColor : undefined, background: useFill ? fillColor : undefined, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal', textDecoration: underline ? 'underline' : 'none' }}>
                {R.sample}
              </div>
            </div>
          )}
        </fieldset>
      )}
      {formatOpen && (
        <Dialog open title={R.formatTitle} onClose={() => setFormatOpen(false)} width={640}
          onConfirm={() => { if (!isEmpty(fmt.edits)) setCustom(editsToDxf(x.store.wb, fmt.edits)); setFormatOpen(false); }}>
          <FormatTabs f={fmt} tabs={['number', 'font', 'border', 'fill']} />
        </Dialog>
      )}
    </Dialog>
  );
}
