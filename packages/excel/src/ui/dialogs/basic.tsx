// Dialogues simples : collage special, rechercher/remplacer, atteindre, taille, serie, symbole, lien,
// protection, note, afficher une feuille, sparklines.
import { useMemo, useState } from 'react';
import { Button, Checkbox, Dialog, NumberField, TextField } from '@forgeoffice/ui';
import { parseRange, rangeName, type Cell, type CellRange, type Sparkline } from '@forgeoffice/xlsx';
import { pasteClip, type PasteOp, type PasteWhat } from '../../logic/clipboard.ts';
import { fillSeries } from '../../logic/fill.ts';
import { pxToColWidth, pxToRowHeight, colWidthToPx, rowHeightToPx, axisSize, colAxis, rowAxis } from '../../logic/geometry.ts';
import { activeRange, cellSelection, rangeSelection } from '../../logic/selection.ts';
import { setColumnWidths, setRowHeights } from '../../logic/structure.ts';
import { commitEntry, editText, parseEntry } from '../../logic/cells.ts';
import { fromScalar } from '../../logic/engine.ts';
import type { Commands, Ctx } from '../commands.ts';
import { S } from '../../strings.ts';

export interface DlgEnv extends Ctx {
  cmd: Commands;
  close: () => void;
}

/** Plage A1 (« B2:D9 », « Feuil2!A1 ») -> plage locale ; undefined si invalide. */
export function readRange(text: string): CellRange | undefined {
  const t = text.trim().replace(/^=/, '').replace(/\$/g, '');
  const local = t.includes('!') ? t.slice(t.lastIndexOf('!') + 1) : t;
  return parseRange(local.toUpperCase());
}

export function PasteSpecialDialog({ x }: { x: DlgEnv }) {
  const [what, setWhat] = useState<PasteWhat>('all');
  const [op, setOp] = useState<PasteOp>('none');
  const [skip, setSkip] = useState(false);
  const [transpose, setTranspose] = useState(false);
  const clip = x.clip;
  const apply = (): void => {
    if (clip) {
      x.store.commit((d) => {
        const r = pasteClip(d, x.si, clip, activeRange(x.sel), {
          what, op, skipBlanks: skip, transpose,
          computed: (r0, c0) => fromScalar(x.store.engine.value(x.store.wb.sheets[clip.sheet]?.name ?? '', clip.range.r1 + r0, clip.range.c1 + c0)),
        });
        x.setSel(rangeSelection(r));
      });
    }
    x.close();
  };
  return (
    <Dialog open title={S.pasteSpecial} onClose={x.close} onConfirm={apply} width={460}>
      <div className="xl-dlg-cols">
        <fieldset className="xl-fs">
          <legend>{S.paste}</legend>
          {Object.entries(S.pasteWhat).map(([k, label]) => (
            <label key={k} className="xl-radio"><input type="radio" name="pw" checked={what === k} onChange={() => setWhat(k as PasteWhat)} />{label}</label>
          ))}
        </fieldset>
        <fieldset className="xl-fs">
          <legend>{S.operation}</legend>
          {Object.entries(S.pasteOp).map(([k, label]) => (
            <label key={k} className="xl-radio"><input type="radio" name="po" checked={op === k} onChange={() => setOp(k as PasteOp)} />{label}</label>
          ))}
        </fieldset>
      </div>
      <div className="xl-dlg-row">
        <Checkbox checked={skip} onChange={setSkip} label={S.skipBlanks} />
        <Checkbox checked={transpose} onChange={setTranspose} label={S.transpose} />
      </div>
    </Dialog>
  );
}

interface Hit { sheet: number; row: number; col: number; text: string }

export function FindDialog({ x, replace }: { x: DlgEnv; replace: boolean }) {
  const [what, setWhat] = useState('');
  const [by, setBy] = useState('');
  const [mode, setMode] = useState(replace);
  const [matchCase, setMatchCase] = useState(false);
  const [whole, setWhole] = useState(false);
  const [inFormulas, setInFormulas] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const test = (text: string): boolean => {
    if (!what) return false;
    const a = matchCase ? text : text.toLowerCase();
    const b = matchCase ? what : what.toLowerCase();
    return whole ? a === b : a.includes(b);
  };
  const scan = (): Hit[] => {
    const out: Hit[] = [];
    const sh = x.store.wb.sheets[x.si];
    if (!sh) return out;
    const rows = [...sh.cells.keys()].sort((a, b) => a - b);
    for (const row of rows) {
      const line = sh.cells.get(row);
      if (!line) continue;
      for (const col of [...line.keys()].sort((a, b) => a - b)) {
        const cell = line.get(col);
        const text = inFormulas && cell?.formula !== undefined ? editText(x.store.wb, cell) : x.display(row, col);
        if (test(text)) out.push({ sheet: x.si, row, col, text });
        if (out.length >= 5000) return out;
      }
    }
    return out;
  };
  const next = (): void => {
    const list = scan();
    if (!list.length) {
      x.notify(S.notFound, 'info');
      return;
    }
    const a = x.sel.active;
    const h = list.find((k) => k.row > a.row || (k.row === a.row && k.col > a.col)) ?? list[0];
    if (h) x.setSel(cellSelection(h.row, h.col));
  };
  const replaceIn = (cell: Cell | undefined): Cell | undefined => {
    if (!cell) return cell;
    const source = editText(x.store.wb, cell);
    const flags = matchCase ? 'g' : 'gi';
    const re = new RegExp(what.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const text = whole ? (test(source) ? by : source) : source.replace(re, by);
    const e = parseEntry(text, x.store.wb.date1904);
    if (!e.ok) return cell;
    const out: Cell = { value: e.value };
    if (e.formula !== undefined) out.formula = e.formula;
    if (cell.styleId) out.styleId = cell.styleId;
    return out;
  };
  const doReplace = (all: boolean): void => {
    const a = x.sel.active;
    const targets = all ? scan() : scan().filter((h) => h.row === a.row && h.col === a.col);
    if (!targets.length) {
      if (!all) next();
      else x.notify(S.notFound, 'info');
      return;
    }
    x.store.commit((d) => {
      for (const h of targets) d.set(x.si, h.row, h.col, replaceIn(d.get(x.si, h.row, h.col)));
    });
    if (all) x.notify(S.replaced(targets.length), 'success');
    else next();
  };
  return (
    <Dialog open title={S.find} onClose={x.close} width={520} actions={[
      ...(mode ? [{ label: S.replaceAll, onClick: () => doReplace(true) }, { label: S.replace, onClick: () => doReplace(false) }] : []),
      { label: S.findAll, onClick: () => setHits(scan()) },
      { label: S.findNext, primary: true, onClick: next },
      { label: S.close, onClick: x.close },
    ]}>
      <div className="xl-tabsbar">
        <button type="button" className={!mode ? 'is-active' : ''} onClick={() => setMode(false)}>{S.findWhat.replace(' :', '')}</button>
        <button type="button" className={mode ? 'is-active' : ''} onClick={() => setMode(true)}>{S.replace}</button>
      </div>
      <div className="xl-form">
        <label>{S.findWhat}</label>
        <TextField value={what} onChange={(e) => setWhat(e.target.value)} data-autofocus aria-label={S.findWhat} />
        {mode && <label>{S.replaceWith}</label>}
        {mode && <TextField value={by} onChange={(e) => setBy(e.target.value)} aria-label={S.replaceWith} />}
      </div>
      <div className="xl-dlg-row">
        <Checkbox checked={matchCase} onChange={setMatchCase} label={S.matchCase} />
        <Checkbox checked={whole} onChange={setWhole} label={S.wholeCell} />
        <Checkbox checked={inFormulas} onChange={setInFormulas} label={S.lookInFormulas} />
      </div>
      {hits.length > 0 && (
        <ul className="xl-hits">
          {hits.slice(0, 500).map((h) => (
            <li key={`${h.row},${h.col}`}>
              <button type="button" onClick={() => x.setSel(cellSelection(h.row, h.col))}>
                <span>{rangeName({ r1: h.row, c1: h.col, r2: h.row, c2: h.col })}</span><span>{h.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

export function GoToDialog({ x }: { x: DlgEnv }) {
  const [ref, setRef] = useState('');
  const names = x.store.wb.definedNames.filter((n) => !n.name.startsWith('_xlnm'));
  const go = (text: string): void => {
    const n = names.find((k) => k.name.toLowerCase() === text.toLowerCase());
    const r = readRange(n ? n.formula : text);
    if (!r) {
      x.notify(S.invalidRef, 'error');
      return;
    }
    x.setSel(rangeSelection(r));
    x.close();
  };
  return (
    <Dialog open title={S.goTo} onClose={x.close} onConfirm={() => go(ref)} width={380}>
      <ul className="xl-list">
        {names.map((n) => <li key={n.name}><button type="button" onClick={() => setRef(n.name)} onDoubleClick={() => go(n.name)}>{n.name}</button></li>)}
      </ul>
      <TextField label={S.reference} value={ref} onChange={(e) => setRef(e.target.value)} data-autofocus />
    </Dialog>
  );
}

export function SizeDialog({ x, axis }: { x: DlgEnv; axis: 'row' | 'col' }) {
  const r = activeRange(x.sel);
  const sh = x.store.wb.sheets[x.si];
  const initial = sh ? (axis === 'col' ? pxToColWidth(axisSize(colAxis(sh), r.c1)) : pxToRowHeight(axisSize(rowAxis(sh), r.r1))) : 0;
  const [v, setV] = useState(Math.round(initial * 100) / 100);
  const apply = (): void => {
    x.store.commit((d) => {
      for (const s of x.sel.ranges) {
        if (axis === 'col') setColumnWidths(d, x.si, s.c1, s.c2, v, v === 0 ? true : undefined);
        else setRowHeights(d, x.si, s.r1, s.r2, v, v === 0 ? true : undefined);
      }
    });
    x.close();
  };
  return (
    <Dialog open title={axis === 'col' ? S.columnWidth : S.rowHeight} onClose={x.close} onConfirm={apply} width={320}>
      <div className="xl-form">
        <label>{axis === 'col' ? S.widthLabel : S.heightLabel}</label>
        <NumberField value={v} min={0} max={axis === 'col' ? 255 : 409} step={axis === 'col' ? 1 : 0.75} width={96} onChange={setV} label={axis === 'col' ? S.widthLabel : S.heightLabel} />
      </div>
      <p className="xl-hint">{axis === 'col' ? `${colWidthToPx(v)} px` : `${rowHeightToPx(v)} px`}</p>
    </Dialog>
  );
}

export function SeriesDialog({ x }: { x: DlgEnv }) {
  const r = activeRange(x.sel);
  const [byRows, setByRows] = useState(r.c2 - r.c1 > r.r2 - r.r1);
  const [kind, setKind] = useState<'linear' | 'growth'>('linear');
  const [step, setStep] = useState(1);
  const [stop, setStop] = useState('');
  const apply = (): void => {
    const s = Number(stop.replace(',', '.'));
    x.store.commit((d) => fillSeries(d, x.si, r, byRows, step, kind, stop.trim() && Number.isFinite(s) ? s : undefined));
    x.close();
  };
  return (
    <Dialog open title={S.series} onClose={x.close} onConfirm={apply} width={420}>
      <div className="xl-dlg-cols">
        <fieldset className="xl-fs">
          <legend>{S.seriesRows}/{S.seriesCols}</legend>
          <label className="xl-radio"><input type="radio" checked={byRows} onChange={() => setByRows(true)} />{S.seriesRows}</label>
          <label className="xl-radio"><input type="radio" checked={!byRows} onChange={() => setByRows(false)} />{S.seriesCols}</label>
        </fieldset>
        <fieldset className="xl-fs">
          <legend>Type</legend>
          <label className="xl-radio"><input type="radio" checked={kind === 'linear'} onChange={() => setKind('linear')} />{S.seriesLinear}</label>
          <label className="xl-radio"><input type="radio" checked={kind === 'growth'} onChange={() => setKind('growth')} />{S.seriesGrowth}</label>
        </fieldset>
      </div>
      <div className="xl-form">
        <label>{S.seriesStep}</label>
        <NumberField value={step} step={1} width={96} onChange={setStep} label={S.seriesStep} />
        <label>{S.seriesStop}</label>
        <TextField value={stop} onChange={(e) => setStop(e.target.value)} aria-label={S.seriesStop} />
      </div>
    </Dialog>
  );
}

const SYMBOLS = '€£$¥¢©®™°±×÷≠≈≤≥∞√∑∏∫πΩµαβγδθλσφω←↑→↓↔⇒⇔✓✗★☆●○■□▲△▼▽◆◇♠♣♥♦§¶†‡•…‰′″¼½¾¹²³ªº«»¿¡ÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ'.split('');

export function SymbolDialog({ x }: { x: DlgEnv }) {
  const insert = (ch: string): void => {
    const a = x.sel.active;
    const cell = x.store.wb.sheets[x.si]?.cells.get(a.row)?.get(a.col);
    const text = `${cell && cell.formula === undefined && typeof cell.value === 'string' ? cell.value : ''}${ch}`;
    x.store.commit((d) => commitEntry(d, x.si, a.row, a.col, { ok: true, value: text }));
  };
  return (
    <Dialog open title={S.symbols} onClose={x.close} actions={[{ label: S.close, primary: true, onClick: x.close }]} width={520}>
      <div className="xl-symbols">
        {SYMBOLS.map((ch) => <button type="button" key={ch} onClick={() => insert(ch)} title={`U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`}>{ch}</button>)}
      </div>
    </Dialog>
  );
}

/** Adresse de lien acceptee : http(s), mailto, ou reference interne (jamais javascript:). */
export function safeLink(target: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(target.trim());
}

export function LinkDialog({ x }: { x: DlgEnv }) {
  const a = x.sel.active;
  const sh = x.store.wb.sheets[x.si];
  const existing = sh?.hyperlinks.find((h) => a.row >= h.ref.r1 && a.row <= h.ref.r2 && a.col >= h.ref.c1 && a.col <= h.ref.c2);
  const [address, setAddress] = useState(existing?.target ?? '');
  const [place, setPlace] = useState(existing?.location ?? '');
  const [text, setText] = useState(x.display(a.row, a.col));
  const apply = (): void => {
    if (address && !safeLink(address)) {
      x.notify(S.linkBlocked, 'error');
      return;
    }
    x.store.commit((d) => {
      const s = d.sheet(x.si);
      const ref = { r1: a.row, c1: a.col, r2: a.row, c2: a.col };
      s.hyperlinks = [...s.hyperlinks.filter((h) => h !== existing), { ref, ...(address ? { target: address.trim() } : {}), ...(place ? { location: place.trim() } : {}), display: text }];
      if (text) commitEntry(d, x.si, a.row, a.col, { ok: true, value: text });
    });
    x.close();
  };
  return (
    <Dialog open title={S.link} onClose={x.close} onConfirm={apply} width={480}>
      <div className="xl-form">
        <label>{S.linkText}</label>
        <TextField value={text} onChange={(e) => setText(e.target.value)} aria-label={S.linkText} />
        <label>{S.linkAddress}</label>
        <TextField value={address} onChange={(e) => setAddress(e.target.value)} placeholder="https://" aria-label={S.linkAddress} data-autofocus />
        <label>{S.linkPlace}</label>
        <TextField value={place} onChange={(e) => setPlace(e.target.value)} aria-label={S.linkPlace} />
      </div>
    </Dialog>
  );
}

/** Empreinte 16 bits historique d'Excel (protection de feuille sans chiffrement). */
export function legacyHash(password: string): string {
  let h = 0;
  for (let i = password.length - 1; i >= 0; i--) {
    h = ((h >> 14) & 1) | ((h << 1) & 0x7fff);
    h ^= password.charCodeAt(i);
  }
  h = ((h >> 14) & 1) | ((h << 1) & 0x7fff);
  h ^= password.length;
  h ^= 0xce4b;
  return h.toString(16).toUpperCase().padStart(4, '0');
}

export function ProtectDialog({ x, target }: { x: DlgEnv; target: 'sheet' | 'book' }) {
  const sh = x.store.wb.sheets[x.si];
  const current = target === 'sheet' ? sh?.protection?.sheet : x.store.wb.protection?.lockStructure;
  const stored = target === 'sheet' ? sh?.protection?.password?.legacy : x.store.wb.protection?.password?.legacy;
  const [pw, setPw] = useState('');
  const apply = (): void => {
    if (current && stored && legacyHash(pw) !== stored) {
      x.notify(S.wrongPassword, 'error');
      return;
    }
    x.store.commit((d) => {
      if (target === 'sheet') {
        const s = d.sheet(x.si);
        if (current) delete s.protection;
        else s.protection = { sheet: true, ...(pw ? { password: { legacy: legacyHash(pw) } } : {}), allow: { selectLockedCells: true, selectUnlockedCells: true } };
      } else if (current) delete d.wb.protection;
      else d.wb.protection = { lockStructure: true, ...(pw ? { password: { legacy: legacyHash(pw) } } : {}) };
    });
    x.close();
  };
  const title = target === 'sheet' ? (current ? S.unprotectSheet : S.protectSheet) : current ? S.unprotectBook : S.protectBook;
  return (
    <Dialog open title={title} onClose={x.close} onConfirm={apply} width={380}>
      {(!current || stored) && <TextField type="password" label={S.password} value={pw} onChange={(e) => setPw(e.target.value)} data-autofocus />}
    </Dialog>
  );
}

export function NoteDialog({ x }: { x: DlgEnv }) {
  const a = x.sel.active;
  const sh = x.store.wb.sheets[x.si];
  const existing = sh?.notes.find((n) => n.ref.row === a.row && n.ref.col === a.col);
  const [text, setText] = useState(existing?.text ?? '');
  const apply = (): void => {
    x.store.commit((d) => {
      const s = d.sheet(x.si);
      const rest = s.notes.filter((n) => n !== existing);
      s.notes = text.trim() ? [...rest, { ref: { row: a.row, col: a.col }, author: S.author, text }] : rest;
    });
    x.close();
  };
  return (
    <Dialog open title={S.note} onClose={x.close} onConfirm={apply} width={380}>
      <textarea className="xl-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label={S.note} data-autofocus />
    </Dialog>
  );
}

export function UnhideSheetDialog({ x }: { x: DlgEnv }) {
  const hidden = x.store.wb.sheets.map((s, i) => ({ s, i })).filter((k) => k.s.state !== 'visible');
  const [pick, setPick] = useState(hidden[0]?.i ?? -1);
  return (
    <Dialog open title={S.unhideTitle} onClose={x.close} onConfirm={() => { if (pick >= 0) x.cmd.sheetState(pick, 'visible'); x.close(); }} width={340}>
      <p>{S.unhideLabel}</p>
      <ul className="xl-list">
        {hidden.map(({ s, i }) => <li key={s.name}><button type="button" className={pick === i ? 'is-active' : ''} onClick={() => setPick(i)}>{s.name}</button></li>)}
      </ul>
    </Dialog>
  );
}

export function SparklineDialog({ x, type }: { x: DlgEnv; type: 'line' | 'column' | 'stacked' }) {
  const r = activeRange(x.sel);
  const [source, setSource] = useState(rangeName(r));
  const [location, setLocation] = useState(rangeName({ r1: r.r1, c1: r.c2 + 1, r2: r.r2, c2: r.c2 + 1 }));
  const name = x.store.wb.sheets[x.si]?.name ?? '';
  const apply = (): void => {
    const src = readRange(source);
    const loc = readRange(location);
    if (!src || !loc) {
      x.notify(S.invalidRef, 'error');
      return;
    }
    const vertical = loc.c1 === loc.c2;
    const sparklines: Sparkline[] = [];
    const count = vertical ? loc.r2 - loc.r1 + 1 : loc.c2 - loc.c1 + 1;
    for (let i = 0; i < count; i++) {
      const s = vertical ? { ...src, r1: src.r1 + i, r2: src.r1 + i } : { ...src, c1: src.c1 + i, c2: src.c1 + i };
      sparklines.push({ source: `${name.includes(' ') ? `'${name}'` : name}!${rangeName(s)}`, location: vertical ? { row: loc.r1 + i, col: loc.c1 } : { row: loc.r1, col: loc.c1 + i } });
    }
    x.store.commit((d) => {
      const s = d.sheet(x.si);
      s.sparklineGroups = [...s.sparklineGroups, { type, sparklines, colorSeries: { rgb: 'FF156082' }, colorNegative: { rgb: 'FFC00000' }, colorHigh: { rgb: 'FFC00000' }, high: type === 'line', low: type === 'line', lineWeight: 1.25 }];
    });
    x.close();
  };
  return (
    <Dialog open title={S.sparkline} onClose={x.close} onConfirm={apply} width={420}>
      <div className="xl-form">
        <label>{S.sparkData}</label>
        <TextField value={source} onChange={(e) => setSource(e.target.value)} aria-label={S.sparkData} data-autofocus />
        <label>{S.sparkLocation}</label>
        <TextField value={location} onChange={(e) => setLocation(e.target.value)} aria-label={S.sparkLocation} />
      </div>
    </Dialog>
  );
}

export function ZoomDialog({ x, zoom, onZoom }: { x: DlgEnv; zoom: number; onZoom: (z: number) => void }) {
  const [v, setV] = useState(zoom);
  const presets = useMemo(() => [200, 100, 75, 50, 25], []);
  return (
    <Dialog open title={S.zoomTitle} onClose={x.close} onConfirm={() => { onZoom(v); x.close(); }} width={300}>
      {presets.map((p) => <label key={p} className="xl-radio"><input type="radio" checked={v === p} onChange={() => setV(p)} />{p} %</label>)}
      <NumberField value={v} min={10} max={400} unit="%" width={96} onChange={setV} label={S.zoomTitle} />
      <Button appearance="subtle" onClick={() => setV(100)}>100 %</Button>
    </Dialog>
  );
}

