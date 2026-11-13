// Format > Page, Insertion > Tableau, Rechercher et remplacer (dispositions LibreOffice / OpenOffice), branches sur les memes fonctions que les boites Word.
import { useMemo, useState, type ReactNode } from 'react';
import { TextSelection } from 'prosemirror-state';
import { Dialog, NumberField, suiteDialogKind, type DialogTab } from '@forgeoffice/ui';
import type { Section } from '@forgeoffice/docx';
import type { Ctl } from '../app/types.ts';
import { PAGE_SIZES } from '../ribbon/page.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';
import { findMatches, nextMatch, replaceMatches, buildRegex, type FindOptions } from '../editor/find.ts';
import { searchKey } from '../editor/plugins.ts';
import { PAGE_COLOR_PROP, pageColor, setCustomProp } from '../features/design.ts';
import { T } from '../strings.ts';
import { SD } from '../strings-suite.ts';
import { Check, Select } from './common.tsx';
import { Field, Radio, Title } from './suite-char.tsx';

type Close = { c: Ctl; onClose: () => void };
const G = SD.page;
const na = SD.na;

export function PageSuiteDialog({ c, onClose }: Close) {
  const oo = suiteDialogKind() === 'openoffice';
  const s0 = c.section;
  const [st, setSt] = useState<Section>({ ...s0, margins: { ...s0.margins }, columns: { ...s0.columns } });
  const [evenOdd, setEvenOdd] = useState(c.meta.settings.evenAndOddHeaders);
  const bg0 = pageColor(c.meta);
  const [bg, setBg] = useState<string | null>(bg0);
  const m = st.margins;
  const setM = (k: keyof Section['margins'], cm: number): void => setSt({ ...st, margins: { ...m, [k]: cmToPt(cm) } });
  const ok = (): void => {
    c.act.setSection({ margins: st.margins, pageWidth: st.pageWidth, pageHeight: st.pageHeight, orientation: st.orientation, columns: st.columns, titlePage: st.titlePage, verticalAlign: st.verticalAlign }, 'section');
    if (bg !== bg0) c.updateMeta((x) => setCustomProp(x, PAGE_COLOR_PROP, bg));
    if (evenOdd !== c.meta.settings.evenAndOddHeaders) c.updateMeta((x) => ({ ...x, settings: { ...x.settings, evenAndOddHeaders: evenOdd } }));
    onClose();
  };
  const reset = (): void => { setSt({ ...s0, margins: { ...s0.margins }, columns: { ...s0.columns } }); setEvenOdd(c.meta.settings.evenAndOddHeaders); setBg(bg0); };
  const size = PAGE_SIZES.find((p) => Math.abs(Math.min(st.pageWidth, st.pageHeight) - p.w) < 2 && Math.abs(Math.max(st.pageWidth, st.pageHeight) - p.h) < 2)?.id ?? 'custom';
  const cm = (label: string, pt: number, on: (cm: number) => void, min = 0, max = 55): ReactNode => (
    <Field label={label}><NumberField value={ptToCm(pt)} min={min} max={max} step={0.1} unit="cm" width={110} label={label} onChange={on} /></Field>
  );
  const orient = (o: 'portrait' | 'landscape'): void => { if (o !== st.orientation) setSt({ ...st, orientation: o, pageWidth: st.pageHeight, pageHeight: st.pageWidth }); };
  const pageTab = (
    <div className="fo-sdlg__cols fo-sdlg__cols--2">
      <div>
        <Title>{G.paper}</Title>
        <Field label={G.format}>
          <Select value={size} label={G.format} options={[...PAGE_SIZES.map((p): [string, string] => [p.id, T.sizes[p.id]]), ['custom', '—']]}
            onChange={(id) => { const p = PAGE_SIZES.find((x) => x.id === id); if (p) setSt({ ...st, pageWidth: st.orientation === 'landscape' ? p.h : p.w, pageHeight: st.orientation === 'landscape' ? p.w : p.h }); }} />
        </Field>
        {cm(G.width, st.pageWidth, (v) => setSt({ ...st, pageWidth: cmToPt(v) }), 2, 55)}
        {cm(G.height, st.pageHeight, (v) => setSt({ ...st, pageHeight: cmToPt(v) }), 2, 55)}
        <Field label={G.orientation}><span><Radio label={G.portrait} checked={st.orientation === 'portrait'} onChange={() => orient('portrait')} /><Radio label={G.landscape} checked={st.orientation === 'landscape'} onChange={() => orient('landscape')} /></span></Field>
        <Field label={G.textDir}><select disabled title={na} aria-label={G.textDir}><option>{G.ltr}</option></select></Field>
        <Title>{G.margins}</Title>
        {cm(G.left, m.left, (v) => setM('left', v))}
        {cm(G.right, m.right, (v) => setM('right', v))}
        {cm(G.top, m.top, (v) => setM('top', v))}
        {cm(G.bottom, m.bottom, (v) => setM('bottom', v))}
        {cm(G.gutter, m.gutter, (v) => setM('gutter', v))}
      </div>
      <div>
        <Field label={G.tray}><select disabled title={na} aria-label={G.tray}><option>{G.trayDefault}</option></select></Field>
        <Title>{G.layout}</Title>
        <Field label={G.pageLayout}><select disabled title={na} aria-label={G.pageLayout}><option>{G.rightLeft}</option></select></Field>
        <Field label={G.numbers}><select disabled title={na} aria-label={G.numbers}><option>1, 2, 3...</option></select></Field>
        <Field label={G.vertical}><Select value={st.verticalAlign ?? 'top'} label={G.vertical} options={[['top', G.top2], ['center', G.center], ['bottom', G.bottom2]]} onChange={(v) => setSt({ ...st, verticalAlign: v === 'top' ? undefined : v })} /></Field>
        <Check label={G.firstDiff} checked={st.titlePage} onChange={(titlePage) => setSt({ ...st, titlePage })} />
        <Check label={G.oddEven} checked={evenOdd} onChange={setEvenOdd} />
        {cm(G.headerDist, m.header, (v) => setM('header', v))}
        {cm(G.footerDist, m.footer, (v) => setM('footer', v))}
      </div>
    </div>
  );
  const columns = (
    <>
      <Title>{G.tabs.columns}</Title>
      <Field label={G.columnsCount}><NumberField value={st.columns.count} min={1} max={6} width={100} label={G.columnsCount} onChange={(count) => setSt({ ...st, columns: { ...st.columns, count, equalWidth: true, widths: undefined } })} /></Field>
      {cm(G.columnsSpace, st.columns.space, (v) => setSt({ ...st, columns: { ...st.columns, space: cmToPt(v) } }))}
      <Check label={G.separator} checked={st.columns.separator} onChange={(separator) => setSt({ ...st, columns: { ...st.columns, separator } })} />
    </>
  );
  const general = (
    <>
      <Title>{G.style}</Title>
      <Field label={G.name}><input disabled readOnly value={oo ? 'Standard' : 'Style de page par défaut'} aria-label={G.name} /></Field>
      <p className="fo-sdlg__hint">{na}</p>
    </>
  );
  const border = <><button type="button" className="fo-sbtn" onClick={() => { ok(); c.openDialog('pageBorder'); }}>{G.tabs.border}…</button></>;
  const background = (
    <>
      <Title>{G.tabs.background}</Title>
      <Field label={G.bgAs}><span><Radio label={G.bgNone} checked={bg === null} onChange={() => setBg(null)} /><Radio label={G.bgColor} checked={bg !== null} onChange={() => setBg(bg ?? '#F2F2F2')} /></span></Field>
      {bg !== null && <Field label={G.bgColor}><input type="color" value={bg.slice(0, 7)} aria-label={G.bgColor} onChange={(e) => setBg(e.target.value.toUpperCase())} /></Field>}
    </>
  );
  // En-tete / pied de page : la modification se fait dans la page (comme Insertion > En-tete et pied de page) ; la boite l'ouvre apres validation.
  const hf = (kind: 'header' | 'footer'): ReactNode => (
    <>
      <Title>{kind === 'header' ? G.tabs.header : G.tabs.footer}</Title>
      <button type="button" className="fo-sbtn" onClick={() => { ok(); c.act.editHeaderFooter(kind); }}>{kind === 'header' ? G.editHeader : G.editFooter}</button>
    </>
  );
  const off = (id: string, label: string, h = na): DialogTab => ({ id, label, content: null, disabled: true, hint: h });
  const tabs: DialogTab[] = oo
    ? [off('organizer', G.tabs.organizer), { id: 'page', label: G.tabs.page, content: pageTab }, { id: 'background', label: G.tabs.background, content: background }, { id: 'header', label: G.tabs.header, content: hf('header') }, { id: 'footer', label: G.tabs.footer, content: hf('footer') },
      { id: 'border', label: G.tabs.border, content: border }, { id: 'columns', label: G.tabs.columns, content: columns }, off('footnote', G.tabs.footnote)]
    : [{ id: 'general', label: G.tabs.general, content: general }, { id: 'page', label: G.tabs.page, content: pageTab }, { id: 'background', label: G.tabs.background, content: background }, off('transparency', G.tabs.transparency), { id: 'header', label: G.tabs.header, content: hf('header') }, { id: 'footer', label: G.tabs.footer, content: hf('footer') },
      { id: 'border', label: G.tabs.border, content: border }, { id: 'columns', label: G.tabs.columns, content: columns }, off('footnote', G.tabs.footnote), off('grid', G.tabs.grid)];
  return (
    <Dialog open title={oo ? G.titleOO : G.title} onClose={onClose} onConfirm={ok} width={oo ? 700 : 950} tabs={tabs} onReset={reset}
      actions={[{ label: SD.ok, primary: true, onClick: ok }, { label: SD.cancel, onClick: onClose }]}>
      {null}
    </Dialog>
  );
}

const TB = SD.table;
export function TableSuiteDialog({ c, onClose }: Close) {
  const oo = suiteDialogKind() === 'openoffice';
  // OpenOffice n'a pas les deux-points des libelles de champ.
  const lab = (t: string): string => (oo ? t.replace(/ ?:$/, '') : t);
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [header, setHeader] = useState(false);
  const [help, setHelp] = useState(false);
  const ok = (): void => { c.act.insertTable(rows, cols); onClose(); };
  return (
    <Dialog open title={TB.title} onClose={onClose} onConfirm={ok} width={oo ? 580 : 440} sideButtons onHelp={() => setHelp((v) => !v)} actions={[{ label: oo ? SD.ok : TB.insert, primary: true, onClick: ok }, { label: SD.cancel, onClick: onClose }]}>
      {oo && <Field label={lab(TB.name)}><input defaultValue="Tableau1" aria-label={TB.name} disabled title={na} /></Field>}
      <Title>{oo ? TB.size : TB.general}</Title>
      {!oo && <Field label={lab(TB.name)}><input defaultValue="Tableau1" aria-label={TB.name} disabled title={na} /></Field>}
      <Field label={lab(TB.columns)}><NumberField value={cols} min={1} max={63} width={90} label={TB.columns} onChange={setCols} /></Field>
      <Field label={lab(TB.rows)}><NumberField value={rows} min={1} max={500} width={90} label={TB.rows} onChange={setRows} /></Field>
      <Title>{TB.options}</Title>
      <Check label={oo ? TB.headerOO : TB.header} checked={header} onChange={setHeader} />
      {oo ? (
        <div className="fo-sdlg__indent">
          <Check label={TB.repeatOO} checked disabled={!header} onChange={() => undefined} />
          <Field label={lab(TB.firstRows)}><NumberField value={1} min={1} max={9} width={60} label={TB.firstRows} disabled onChange={() => undefined} /></Field>
        </div>
      ) : <Check label={TB.repeat} checked={false} onChange={() => undefined} />}
      <Check label={oo ? TB.noSplitOO : TB.noSplit} checked={false} onChange={() => undefined} />
      {oo ? (
        <>
          <Check label={TB.border} checked disabled onChange={() => undefined} />
          <button type="button" className="fo-sbtn fo-sdlg__wide" disabled title={na}>{TB.auto}</button>
        </>
      ) : (
        <><Title>{TB.styles}</Title><select size={5} disabled title={na} aria-label={TB.styles} className="fo-sdlg__list"><option>{TB.stylesNone}</option></select></>
      )}
      {help && <p className="fo-sdlg__note" role="note">{TB.help}</p>}
    </Dialog>
  );
}

const F = SD.find;
export function FindSuiteDialog({ c, onClose }: Close) {
  const oo = suiteDialogKind() === 'openoffice';
  const [q, setQ] = useState(c.sel.text.split('\n')[0] ?? '');
  const [rep, setRep] = useState('');
  const [opts, setOpts] = useState<FindOptions>({});
  const [more, setMore] = useState(oo);
  const [msg, setMsg] = useState('');
  const doc = c.state()?.doc;
  const matches = useMemo(() => (doc && q ? findMatches(doc, q, opts) : []), [doc, q, opts]);
  const bad = !!q && opts.regex && !buildRegex(q, opts);
  const show = (i: number): void => {
    const v = c.view();
    if (!v) return;
    const mt = matches[i];
    const tr = v.state.tr.setMeta(searchKey, { matches, current: i });
    if (mt) tr.setSelection(TextSelection.create(v.state.doc, mt.from, mt.to)).scrollIntoView();
    v.dispatch(tr);
    setMsg(T.dialogs.results(matches.length));
  };
  const go = (back: boolean): void => {
    const v = c.view();
    if (!v || !matches.length) return setMsg(T.dialogs.results(0));
    show(nextMatch(matches, back ? v.state.selection.from : v.state.selection.to, back));
  };
  const all = (): void => {
    const v = c.view();
    if (!v || !matches.length) return setMsg(T.dialogs.results(0));
    show(0);
  };
  const replaceOne = (): void => {
    const v = c.view();
    if (!v) return;
    const { from, to } = v.state.selection;
    const cur = matches.find((x) => x.from === from && x.to === to);
    if (cur) { const tr = v.state.tr; replaceMatches(tr, [cur], q, rep, opts); v.dispatch(tr); }
    go(false);
  };
  const replaceAll = (): void => {
    const v = c.view();
    if (!v) return;
    const tr = v.state.tr;
    const n = replaceMatches(tr, matches, q, rep, opts);
    v.dispatch(tr.setMeta(searchKey, { matches: [], current: -1 }));
    setMsg(T.dialogs.replaced(n));
  };
  const close = (): void => { const v = c.view(); v?.dispatch(v.state.tr.setMeta(searchKey, { matches: [], current: -1 })); onClose(); };
  const btn = (label: string, on: () => void, dis = !matches.length, primary = false): ReactNode => <button type="button" className={`fo-sbtn${primary ? ' is-primary' : ''}`} disabled={dis} onClick={on}>{label}</button>;
  return (
    <Dialog open title={F.title} onClose={close} onConfirm={() => go(false)} width={oo ? 560 : 860}
      footerStart={<span className="fo-word-dialog__msg" role="status">{bad ? T.dialogs.badRegex : msg}</span>}
      actions={[{ label: F.close, onClick: close }]}>
      <div className={`fo-sdlg__find${oo ? ' is-oo' : ''}`}>
        <div className="fo-sdlg__findmain">
          <Field label={F.findLabel}><input autoFocus data-autofocus value={q} aria-label={F.findLabel} onChange={(e) => { setQ(e.target.value); setMsg(''); }} /></Field>
          <div className="fo-sdlg__inline"><Check label={F.matchCase} checked={!!opts.caseSensitive} onChange={(caseSensitive) => setOpts({ ...opts, caseSensitive })} /><Check label={F.whole} checked={!!opts.wholeWord} onChange={(wholeWord) => setOpts({ ...opts, wholeWord })} /></div>
          <Field label={F.replaceLabel}><input value={rep} aria-label={F.replaceLabel} onChange={(e) => setRep(e.target.value)} /></Field>
          {!oo && <div className="fo-sdlg__findbtns">{btn(F.findAll, all)}{btn(F.findPrev, () => go(true))}{btn(F.findNext, () => go(false), !matches.length, true)}{btn(F.replace, replaceOne)}{btn(F.replaceAll, replaceAll)}</div>}
          <button type="button" className="fo-sdlg__more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? '−' : '+'} <b>{F.more}</b></button>
          {more && (
            <div className="fo-sdlg__inline fo-sdlg__inline--wrap">
              <Check label={F.regex} checked={!!opts.regex} onChange={(regex) => setOpts({ ...opts, regex, wildcards: regex ? false : opts.wildcards })} />
              <Check label={F.accents} checked={!!opts.ignoreAccents} onChange={(ignoreAccents) => setOpts({ ...opts, ignoreAccents })} />
              <Check label={F.selection} checked={!!opts.range} onChange={(on) => { const s = c.state()?.selection; setOpts({ ...opts, range: on && s && s.from !== s.to ? { from: s.from, to: s.to } : undefined }); }} />
            </div>
          )}
        </div>
        {oo && <div className="fo-sdlg__findcol">{btn(F.findNext, () => go(false), !matches.length, true)}{btn(F.findAll, all)}{btn(F.replace, replaceOne)}{btn(F.replaceAll, replaceAll)}{btn(F.findPrev, () => go(true))}</div>}
      </div>
    </Dialog>
  );
}
