// Onglet Nombre : categories d'Excel, options (decimales, milliers, negatifs, symbole), types, code personnalise, apercu.
import { useEffect, useState } from 'react';
import { Checkbox, NumberField, TextField } from '@forgeoffice/ui';
import { dateToSerial } from '@forgeoffice/xlsx';
import { displayText } from '../../../logic/look.ts';
import {
  CURRENCY_SYMBOLS, CUSTOM_EXAMPLES, MAX_DECIMALS, NEGATIVE_STYLES, NUM_CATEGORIES, buildFormat, parseNumFmt, typesOf, usesOption,
  type NumCategory, type NumOptions,
} from '../../../logic/numfmt-ui.ts';
import { FC } from '../../../strings/index.ts';
import type { FormatCtx } from './state.ts';

/** 14 mars 2012, 13 h 30 min 55 s : exemple des listes de dates et d'heures. */
const SAMPLE_DATE = dateToSerial(new Date(Date.UTC(2012, 2, 14, 13, 30, 55)));

const TYPE_LABELS: Partial<Record<NumCategory, Record<string, string>>> = {
  date: FC.dateTypes, time: FC.timeTypes, fraction: FC.fractionTypes, special: FC.specialTypes,
};

export function NumberTab({ f, category: wanted }: { f: FormatCtx; category?: NumCategory }) {
  const code = f.get('numFmt');
  const parsed = parseNumFmt(code);
  const [category, setCategory] = useState<NumCategory>(f.isMixed('numFmt') ? 'general' : parsed.category);
  const [options, setOptions] = useState<NumOptions>(parsed.options);
  const shown = (c: string): string => {
    try {
      return displayText(f.wb, f.sample, c).text;
    } catch {
      return ''; // code en cours de saisie
    }
  };
  const apply = (cat: NumCategory, o: NumOptions, type = ''): void => {
    setCategory(cat);
    setOptions(o);
    if (cat === 'custom' && !type) return;
    f.set({ numFmt: buildFormat(cat, o, type) });
  };
  // Ouverture sur une categorie precise (« Autres formats comptabilite... ») : elle est appliquee d'emblee, comme dans Excel.
  useEffect(() => {
    if (wanted && wanted !== parsed.category) apply(wanted, options);
  }, []);
  const types = typesOf(category);
  const customCodes = [...new Set([...f.wb.styles.numFmts.map((n) => n.code), ...CUSTOM_EXAMPLES])];
  const preview = shown(code);
  const sampleDate = (c: string): string => displayText(f.wb, SAMPLE_DATE, c).text;
  return (
    <div className="xl-fc-cols">
      <div>
        <label className="xl-fc-label">{FC.category}</label>
        <ul className="xl-list xl-list--tall xl-fc-cats" role="listbox" aria-label={FC.category}>
          {NUM_CATEGORIES.map((c) => (
            <li key={c}>
              <button type="button" role="option" aria-selected={category === c} className={category === c ? 'is-active' : ''} onClick={() => apply(c, options)}>{FC.categories[c]}</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="xl-fc-body">
        <label className="xl-fc-label">{FC.sample}</label>
        <div className="xl-sample xl-fc-sample" data-testid="fc-sample">{preview}</div>
        {usesOption(category, 'decimals') && (
          <div className="xl-fc-row"><label>{FC.decimals}</label><NumberField value={options.decimals} min={0} max={MAX_DECIMALS} width={80} label={FC.decimals} onChange={(n) => apply(category, { ...options, decimals: n })} /></div>
        )}
        {usesOption(category, 'symbol') && (
          <div className="xl-fc-row">
            <label>{FC.symbol}</label>
            <select value={options.symbol} aria-label={FC.symbol} onChange={(e) => apply(category, { ...options, symbol: e.target.value })}>
              {CURRENCY_SYMBOLS.map((s) => <option key={s.id} value={s.id}>{FC.symbols[s.id]}</option>)}
            </select>
          </div>
        )}
        {usesOption(category, 'thousands') && <Checkbox checked={options.thousands} onChange={(v) => apply(category, { ...options, thousands: v })} label={FC.thousands} />}
        {usesOption(category, 'negative') && (
          <>
            <label className="xl-fc-label">{FC.negatives}</label>
            <ul className="xl-list xl-fc-neg" role="listbox" aria-label={FC.negatives}>
              {NEGATIVE_STYLES.map((n) => (
                <li key={n}>
                  <button type="button" role="option" aria-selected={options.negative === n} className={options.negative === n ? 'is-active' : ''} style={n === 1 || n === 3 ? { color: '#C00000' } : undefined} onClick={() => apply(category, { ...options, negative: n })}>
                    {FC.negativeStyles[n]}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {types.length > 0 && (
          <>
            <label className="xl-fc-label">{FC.type}</label>
            <ul className="xl-list xl-list--tall" role="listbox" aria-label={FC.type}>
              {types.map((t) => (
                <li key={t.id}>
                  <button type="button" role="option" aria-selected={code === t.code} className={code === t.code ? 'is-active' : ''} title={TYPE_LABELS[category]?.[t.id] ?? t.id} onClick={() => apply(category, options, t.code)}>
                    {category === 'date' || category === 'time' ? sampleDate(t.code) : (TYPE_LABELS[category]?.[t.id] ?? t.id)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {category === 'custom' && (
          <>
            <label className="xl-fc-label" htmlFor="fc-code">{FC.typeCode}</label>
            <TextField id="fc-code" value={code} onChange={(e) => f.set({ numFmt: e.target.value })} aria-label={FC.typeCode} />
            <ul className="xl-list xl-list--tall" role="listbox" aria-label={FC.typeCode}>
              {customCodes.map((c) => <li key={c}><button type="button" role="option" aria-selected={code === c} className={code === c ? 'is-active' : ''} onClick={() => f.set({ numFmt: c })}>{c}</button></li>)}
            </ul>
          </>
        )}
        <p className="xl-fc-desc">{FC.descriptions[category]}</p>
      </div>
    </div>
  );
}
