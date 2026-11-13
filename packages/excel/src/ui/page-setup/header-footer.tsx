// Onglet En-tete/Pied de page : listes predefinies, editeur personnalise a trois zones (codes &[Page], &[Date]... et mise en forme),
// premiere page differente, pages paires/impaires, echelle et alignement.
import { useRef, useState } from 'react';
import { Button, Checkbox } from '@forgeoffice/ui';
import type { HeaderFooter } from '@forgeoffice/xlsx';
import { HF_FIELDS, HF_PRESETS, hfFromDisplay, hfJoin, hfPlain, hfSplit, hfToDisplay } from '../../logic/pagesetup.ts';
import type { TabProps } from './types.ts';
import { PS } from '../../strings/index.ts';

export type Key = 'oddHeader' | 'oddFooter' | 'evenHeader' | 'evenFooter' | 'firstHeader' | 'firstFooter';
export type Which = 'odd' | 'even' | 'first';
type Zone = 'left' | 'center' | 'right';

const SAMPLE = { page: 1, pages: 3, now: new Date(2026, 10, 5, 9, 30), file: 'Classeur1.xlsx', path: '', sheet: 'Feuil1' };
export const keyOf = (kind: 'Header' | 'Footer', which: Which): Key => `${which}${kind}` as Key;

const FIELD_LABELS: Record<string, string> = { P: PS.hfPage, N: PS.hfPages, D: PS.hfDate, T: PS.hfTime, Z: PS.hfPath, F: PS.hfFile, A: PS.hfSheet };

/** Editeur des trois zones d'un en-tete ou pied de page (valeur = chaine de codes Excel). */
export function ZoneEditor({ value, onChange }: { value: string; onChange: (raw: string) => void }) {
  const parts = hfSplit(value);
  const refs = useRef<Partial<Record<Zone, HTMLTextAreaElement | null>>>({});
  const [zone, setZone] = useState<Zone>('center');
  const set = (z: Zone, display: string): void => {
    const next = { ...parts, [z]: hfFromDisplay(display) };
    onChange(hfJoin(next.left, next.center, next.right));
  };
  const insert = (text: string): void => {
    const el = refs.current[zone];
    const shown = hfToDisplay(parts[zone]);
    const at = el ? [el.selectionStart, el.selectionEnd] as const : [shown.length, shown.length] as const;
    set(zone, shown.slice(0, at[0]) + text + shown.slice(at[1]));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at[0] + text.length, at[0] + text.length);
    });
  };
  const tools: readonly { id: string; label: string; text: string; cls?: string }[] = [
    { id: 'b', label: PS.hfBold, text: '&B', cls: 'is-b' },
    { id: 'i', label: PS.hfItalic, text: '&I', cls: 'is-i' },
    { id: 'u', label: PS.hfUnderline, text: '&U', cls: 'is-u' },
    ...HF_FIELDS.map((f) => ({ id: f.code, label: FIELD_LABELS[f.code] ?? f.display, text: `&[${f.display}]` })),
  ];
  return (
    <div className="ps-hfedit">
      <div className="ps-hfedit__tools" role="toolbar" aria-label={PS.hfEdit}>
        {tools.map((t) => <button key={t.id} type="button" className={`ps-tool ${t.cls ?? ''}`} title={t.label} aria-label={t.label} onClick={() => insert(t.text)}>{t.cls ? t.id.toUpperCase() : `&[${HF_FIELDS.find((f) => f.code === t.id)?.display ?? ''}]`}</button>)}
        <label className="ps-tool-size">{PS.hfSize}
          <select aria-label={PS.hfSize} value="" onChange={(e) => { if (e.target.value) insert(`&${e.target.value}`); e.target.value = ''; }}>
            <option value="" />
            {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="ps-hfedit__zones">
        {(['left', 'center', 'right'] as const).map((z) => (
          <label key={z}>{z === 'left' ? PS.hfLeft : z === 'center' ? PS.hfCenter : PS.hfRight}
            <textarea
              ref={(el) => { refs.current[z] = el; }} className="xl-textarea" rows={4} value={hfToDisplay(parts[z])} data-zone={z}
              onFocus={() => setZone(z)} onChange={(e) => set(z, e.target.value)}
            />
          </label>
        ))}
      </div>
      <p className="xl-hint">{PS.hfHint}</p>
    </div>
  );
}

export function HeaderFooterTab({ d, up }: TabProps) {
  const hf: HeaderFooter = d.headerFooter ?? {};
  const [edit, setEdit] = useState<'Header' | 'Footer' | null>(null);
  const [which, setWhich] = useState<Which>('odd');
  const put = (patch: Partial<HeaderFooter>): void => {
    const next = { ...hf, ...patch };
    for (const k of Object.keys(next) as (keyof HeaderFooter)[]) if (next[k] === undefined || next[k] === '') delete next[k];
    up({ headerFooter: Object.keys(next).length ? next : undefined });
  };
  const variants: Which[] = ['odd', ...(hf.differentOddEven ? (['even'] as const) : []), ...(hf.differentFirst ? (['first'] as const) : [])];
  const current = variants.includes(which) ? which : 'odd';
  const list = (kind: 'Header' | 'Footer') => {
    const raw = hf[keyOf(kind, current)] ?? '';
    const preset = HF_PRESETS.find((p) => p.raw === raw);
    return (
      <div className="ps-hfrow">
        <label>{kind === 'Header' ? PS.headerLabel : PS.footerLabel}
          <select value={preset ? preset.id : 'custom'} onChange={(e) => { const p = HF_PRESETS.find((k) => k.id === e.target.value); if (p) put({ [keyOf(kind, current)]: p.raw }); }}>
            {!preset && <option value="custom">{hfPlain(raw, SAMPLE)}</option>}
            {HF_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.raw ? hfPlain(p.raw, SAMPLE) : p.label}</option>)}
          </select>
        </label>
        <Button onClick={() => setEdit(edit === kind ? null : kind)}>{kind === 'Header' ? PS.customHeader : PS.customFooter}</Button>
        <div className="ps-hfsample" aria-label={PS.hfPreviewLabel}>{hfPlain(raw, SAMPLE) || ' '}</div>
      </div>
    );
  };
  return (
    <div className="ps-form">
      {variants.length > 1 && (
        <div className="xl-dlg-row" role="radiogroup">
          {variants.map((v) => <label key={v} className="xl-radio"><input type="radio" name="ps-which" checked={current === v} onChange={() => setWhich(v)} />{PS.hfWhich[v]}</label>)}
        </div>
      )}
      {list('Header')}
      {edit === 'Header' && <ZoneEditor value={hf[keyOf('Header', current)] ?? ''} onChange={(raw) => put({ [keyOf('Header', current)]: raw })} />}
      {list('Footer')}
      {edit === 'Footer' && <ZoneEditor value={hf[keyOf('Footer', current)] ?? ''} onChange={(raw) => put({ [keyOf('Footer', current)]: raw })} />}
      <Checkbox checked={!!hf.differentOddEven} onChange={(v) => put({ differentOddEven: v || undefined })} label={PS.differentOddEven} />
      <Checkbox checked={!!hf.differentFirst} onChange={(v) => put({ differentFirst: v || undefined })} label={PS.differentFirst} />
      <Checkbox checked={hf.scaleWithDoc !== false} onChange={(v) => put({ scaleWithDoc: v ? undefined : false })} label={PS.scaleWithDoc} />
      <Checkbox checked={hf.alignWithMargins !== false} onChange={(v) => put({ alignWithMargins: v ? undefined : false })} label={PS.alignWithMargins} />
    </div>
  );
}
