// Dialogues du texte : Police, Paragraphe, Rechercher/Remplacer, Lien, Signet, Renvoi, Symbole, Equation, Date, Champ.
import { useMemo, useState } from 'react';
import { TextSelection } from 'prosemirror-state';
import { Button, ColorPalette, Dialog, FontPicker, NumberField, TextField } from '@forgeoffice/ui';
import type { Alignment, Inline, LineSpacing, ParagraphProps, RunProps, UnderlineType } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import { X } from '../strings-extra.ts';
import type { Ctl } from '../app/types.ts';
import { linkMarkAttrs } from '../app/actions.ts';
import { insertInline, setMark, setParagraph, setRunProps } from '../editor/commands.ts';
import { findMatches, nextMatch, replaceMatches, buildRegex, type FindOptions } from '../editor/find.ts';
import { searchKey } from '../editor/plugins.ts';
import { runCss } from '../editor/css.ts';
import { collectHeadings } from '../features/toc.ts';
import { cmToPt, colorHex, ptToCm } from '../ribbon/shared.ts';
import { Check, Row, Select } from './common.tsx';

const D = T.dialogs;
type Close = { c: Ctl; onClose: () => void };

/** Declarations CSS « a:b;c:d » -> objet de style React. */
export function styleObject(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) out[decl.slice(0, i).replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())] = decl.slice(i + 1);
  }
  return out;
}

/** Proprietes de caractere a ecrire depuis l'etat d'une boite Police / Caractere (valeurs par defaut = propriete retiree). */
export function runPatch(st: RunProps, r: RunProps): RunProps {
  return {
    fontTheme: st.font === r.font ? r.fontTheme : undefined, font: st.font, size: st.size, bold: st.bold, italic: st.italic,
    underline: st.underline === 'none' ? undefined : st.underline, color: st.color, strike: st.strike || undefined, doubleStrike: st.doubleStrike || undefined,
    vertAlign: st.vertAlign, smallCaps: st.smallCaps || undefined, caps: st.caps || undefined, hidden: st.hidden || undefined, spacing: st.spacing || undefined,
    shadow: st.shadow || undefined, outline: st.outline || undefined, emboss: st.emboss || undefined, imprint: st.imprint || undefined,
    scale: st.scale && st.scale !== 100 ? st.scale : undefined, position: st.position || undefined, border: st.border,
    underlineColor: st.underline && st.underline !== 'none' ? st.underlineColor : undefined, kerning: st.kerning || undefined,
  };
}

export function FontDialog({ c, onClose }: Close) {
  const r = c.sel.run;
  const [st, setSt] = useState<RunProps>({ ...r });
  const set = (patch: Partial<RunProps>): void => setSt((s) => ({ ...s, ...patch }));
  const style = st.bold ? (st.italic ? 'bi' : 'b') : st.italic ? 'i' : 'r';
  const apply = (): void => {
    c.run(setRunProps(runPatch(st, r)));
    onClose();
  };
  const preview = runCss(st).replace(/display:none/, '');
  const unders: [UnderlineType, string][] = [['none', D.none], ['single', T.cmd.underline], ['double', T.cmd.underlineDouble], ['dotted', T.cmd.underlineDotted], ['wave', T.cmd.underlineWave], ['words', D.wordsOnly]];
  return (
    <Dialog open title={D.font} onClose={onClose} onConfirm={apply} width={560} actions={[{ label: D.ok, primary: true, onClick: apply }, { label: D.cancel, onClick: onClose }]}>
      <div className="fo-word-form fo-word-form--2">
        <Row label={D.font}><FontPicker value={st.font ?? ''} onChange={(font) => set({ font })} width={220} /></Row>
        <Row label={D.fontStyle}>
          <Select value={style} label={D.fontStyle} options={[['r', D.regular], ['i', T.cmd.italic], ['b', T.cmd.bold], ['bi', D.boldItalic]]}
            onChange={(v) => set({ bold: v.includes('b'), italic: v.includes('i') })} />
        </Row>
        <Row label={D.fontSize}><NumberField value={st.size ?? 11} min={1} max={1638} step={0.5} unit="pt" width={90} label={D.fontSize} onChange={(size) => set({ size })} /></Row>
        <Row label={D.underlineStyle}><Select value={st.underline ?? 'none'} label={D.underlineStyle} options={unders} onChange={(underline) => set({ underline })} /></Row>
        <Row label={D.characterSpacing}><NumberField value={st.spacing ?? 0} min={-10} max={50} step={0.1} unit="pt" width={90} label={D.characterSpacing} onChange={(spacing) => set({ spacing })} /></Row>
      </div>
      <fieldset className="fo-word-fieldset">
        <legend>{D.effects}</legend>
        <div className="fo-word-checks">
          <Check label={T.cmd.strike} checked={!!st.strike} onChange={(strike) => set({ strike })} />
          <Check label={D.doubleStrike} checked={!!st.doubleStrike} onChange={(doubleStrike) => set({ doubleStrike })} />
          <Check label={T.cmd.sup} checked={st.vertAlign === 'superscript'} onChange={(v) => set({ vertAlign: v ? 'superscript' : undefined })} />
          <Check label={T.cmd.sub} checked={st.vertAlign === 'subscript'} onChange={(v) => set({ vertAlign: v ? 'subscript' : undefined })} />
          <Check label={T.cmd.smallCaps} checked={!!st.smallCaps} onChange={(smallCaps) => set({ smallCaps })} />
          <Check label={T.cmd.allCaps} checked={!!st.caps} onChange={(caps) => set({ caps })} />
          <Check label={T.cmd.hidden} checked={!!st.hidden} onChange={(hidden) => set({ hidden })} />
          <Check label={X.font.shadow} checked={!!st.shadow} onChange={(shadow) => set({ shadow })} />
          <Check label={X.font.outline} checked={!!st.outline} onChange={(outline) => set({ outline })} />
          <Check label={X.font.emboss} checked={!!st.emboss} onChange={(emboss) => set({ emboss, imprint: emboss ? false : st.imprint })} />
          <Check label={X.font.border} checked={!!st.border} onChange={(on) => set({ border: on ? { style: 'single', width: 0.5, color: 'auto', space: 0 } : undefined })} />
          <Check label={X.font.imprint} checked={!!st.imprint} onChange={(imprint) => set({ imprint, emboss: imprint ? false : st.emboss })} />
        </div>
        <div className="fo-word-form fo-word-form--2">
          <Row label={X.font.underlineColor}><input type="color" aria-label={X.font.underlineColor} value={st.underlineColor ? `#${st.underlineColor}` : '#000000'} disabled={!st.underline || st.underline === 'none'} onChange={(e) => set({ underlineColor: e.target.value.slice(1).toUpperCase() })} /></Row>
          <Row label={X.font.kerning}><NumberField value={st.kerning ?? 0} min={0} max={1638} step={0.5} unit="pt" width={90} label={X.font.kerning} onChange={(kerning) => set({ kerning })} /></Row>
          <Row label={X.font.scale}><NumberField value={st.scale ?? 100} min={10} max={600} step={10} unit="%" width={90} label={X.font.scale} onChange={(scale) => set({ scale })} /></Row>
          <Row label={X.font.position}><NumberField value={st.position ?? 0} min={-100} max={100} step={0.5} unit="pt" width={90} label={X.font.position} onChange={(position) => set({ position })} /></Row>
        </div>
      </fieldset>
      <fieldset className="fo-word-fieldset">
        <legend>{D.fontColor}</legend>
        <ColorPalette value={colorHex(st)} onPick={(hex) => set({ color: hex ? { rgb: hex.slice(1).toUpperCase() } : undefined })} />
      </fieldset>
      <div className="fo-word-preview" aria-label={D.preview}><span style={styleObject(preview)}>{D.previewText}</span></div>
    </Dialog>
  );
}

export function ParagraphDialog({ c, onClose }: Close) {
  const p = c.sel.para;
  const [st, setSt] = useState<ParagraphProps>({ ...p });
  const set = (patch: Partial<ParagraphProps>): void => setSt((s) => ({ ...s, ...patch }));
  const ls: LineSpacing = st.lineSpacing ?? { rule: 'auto', value: 1.08 };
  const apply = (): void => {
    const { numbering: _n, tabs: _t, borders: _b, shading: _s, ...rest } = st;
    c.run(setParagraph({ props: rest }));
    onClose();
  };
  const aligns: [Alignment, string][] = [['left', T.cmd.alignLeft], ['center', T.cmd.center], ['right', T.cmd.alignRight], ['justify', T.cmd.justify]];
  const levels: [string, string][] = [['9', D.bodyText], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): [string, string] => [String(n - 1), D.level(n)])];
  return (
    <Dialog open title={D.paragraph} onClose={onClose} onConfirm={apply} width={560} footerStart={<Button onClick={() => { apply(); c.openDialog('tabs'); }}>{X.tabs.menu}</Button>} actions={[{ label: D.ok, primary: true, onClick: apply }, { label: D.cancel, onClick: onClose }]}>
      <fieldset className="fo-word-fieldset">
        <legend>{D.general}</legend>
        <div className="fo-word-form fo-word-form--2">
          <Row label={D.alignment}><Select value={st.alignment ?? 'left'} label={D.alignment} options={aligns} onChange={(alignment) => set({ alignment })} /></Row>
          <Row label={D.outlineLevel}><Select value={String(st.outlineLevel ?? 9)} label={D.outlineLevel} options={levels} onChange={(v) => set({ outlineLevel: v === '9' ? undefined : Number(v) })} /></Row>
        </div>
      </fieldset>
      <fieldset className="fo-word-fieldset">
        <legend>{D.indents}</legend>
        <div className="fo-word-form fo-word-form--3">
          <Row label={`${D.left} (cm)`}><NumberField value={ptToCm(st.indentLeft ?? 0)} step={0.1} min={-20} max={50} label={D.left} width={80} onChange={(v) => set({ indentLeft: cmToPt(v) })} /></Row>
          <Row label={`${D.right} (cm)`}><NumberField value={ptToCm(st.indentRight ?? 0)} step={0.1} min={-20} max={50} label={D.right} width={80} onChange={(v) => set({ indentRight: cmToPt(v) })} /></Row>
          <Row label={D.firstLine}><NumberField value={ptToCm(st.indentFirstLine ?? 0)} step={0.1} min={-20} max={50} label={D.firstLine} width={80} onChange={(v) => set({ indentFirstLine: cmToPt(v) })} /></Row>
        </div>
      </fieldset>
      <fieldset className="fo-word-fieldset">
        <legend>{D.spacing}</legend>
        <div className="fo-word-form fo-word-form--3">
          <Row label={D.before}><NumberField value={st.spacingBefore ?? 0} step={6} min={0} max={1584} label={D.before} width={80} onChange={(spacingBefore) => set({ spacingBefore })} /></Row>
          <Row label={D.after}><NumberField value={st.spacingAfter ?? 0} step={6} min={0} max={1584} label={D.after} width={80} onChange={(spacingAfter) => set({ spacingAfter })} /></Row>
          <Row label={D.lineSpacing}>
            <Select value={ls.rule} label={D.lineSpacing} options={[['auto', D.multiple], ['exact', D.exactly], ['atLeast', D.atLeast]]} onChange={(rule) => set({ lineSpacing: { rule, value: rule === 'auto' ? 1.15 : 12 } })} />
            <NumberField value={ls.value} step={ls.rule === 'auto' ? 0.05 : 1} min={0.06} max={1584} label={D.lineSpacing} width={80} onChange={(value) => set({ lineSpacing: { ...ls, value } })} />
          </Row>
        </div>
        <Check label={D.contextual} checked={!!st.contextualSpacing} onChange={(contextualSpacing) => set({ contextualSpacing })} />
      </fieldset>
      <div className="fo-word-checks">
        <Check label={D.widowControl} checked={st.widowControl !== false} onChange={(widowControl) => set({ widowControl })} />
        <Check label={D.keepNext} checked={!!st.keepNext} onChange={(keepNext) => set({ keepNext })} />
        <Check label={D.keepLines} checked={!!st.keepLines} onChange={(keepLines) => set({ keepLines })} />
        <Check label={D.pageBreakBefore} checked={!!st.pageBreakBefore} onChange={(pageBreakBefore) => set({ pageBreakBefore })} />
      </div>
    </Dialog>
  );
}

export function FindDialog({ c, onClose }: Close) {
  const [q, setQ] = useState(c.sel.text.split('\n')[0] ?? '');
  const [rep, setRep] = useState('');
  const [opts, setOpts] = useState<FindOptions>({});
  const [msg, setMsg] = useState('');
  const doc = c.state()?.doc;
  const matches = useMemo(() => (doc && (q || opts.format) ? findMatches(doc, q, opts) : []), [doc, q, opts]);
  const bad = !!q && opts.regex && !buildRegex(q, opts);
  const show = (i: number): void => {
    const v = c.view();
    if (!v) return;
    const m = matches[i];
    const tr = v.state.tr.setMeta(searchKey, { matches, current: i });
    if (m) tr.setSelection(TextSelection.create(v.state.doc, m.from, m.to)).scrollIntoView();
    v.dispatch(tr);
    setMsg(D.results(matches.length));
  };
  const go = (back: boolean): void => {
    const v = c.view();
    if (!v || !matches.length) return setMsg(D.results(0));
    show(nextMatch(matches, back ? v.state.selection.from : v.state.selection.to, back));
  };
  const replaceOne = (): void => {
    const v = c.view();
    if (!v) return;
    const { from, to } = v.state.selection;
    const cur = matches.find((m) => m.from === from && m.to === to);
    if (cur) {
      const tr = v.state.tr;
      replaceMatches(tr, [cur], q, rep, opts);
      v.dispatch(tr);
    }
    go(false);
  };
  const replaceAll = (): void => {
    const v = c.view();
    if (!v) return;
    const tr = v.state.tr;
    const n = replaceMatches(tr, matches, q, rep, opts);
    v.dispatch(tr.setMeta(searchKey, { matches: [], current: -1 }));
    setMsg(D.replaced(n));
  };
  const close = (): void => {
    const v = c.view();
    v?.dispatch(v.state.tr.setMeta(searchKey, { matches: [], current: -1 }));
    onClose();
  };
  return (
    <Dialog open title={D.findReplace} onClose={close} width={540} onConfirm={() => go(false)}
      footerStart={<span className="fo-word-dialog__msg" role="status">{bad ? D.badRegex : msg || (q || opts.format ? D.results(matches.length) : '')}</span>}
      actions={[{ label: D.replaceAll, onClick: replaceAll, disabled: !matches.length }, { label: D.replaceOne, onClick: replaceOne, disabled: !matches.length }, { label: D.findPrev, onClick: () => go(true) }, { label: D.findNext, primary: true, onClick: () => go(false) }]}>
      <div className="fo-word-form">
        <TextField label={D.findWhat} value={q} autoFocus onChange={(e) => { setQ(e.target.value); setMsg(''); }} />
        <TextField label={D.replaceWith} value={rep} onChange={(e) => setRep(e.target.value)} />
      </div>
      <div className="fo-word-checks">
        <Check label={D.matchCase} checked={!!opts.caseSensitive} onChange={(caseSensitive) => setOpts({ ...opts, caseSensitive })} />
        <Check label={D.wholeWord} checked={!!opts.wholeWord} onChange={(wholeWord) => setOpts({ ...opts, wholeWord })} />
        <Check label={D.regex} checked={!!opts.regex} onChange={(regex) => setOpts({ ...opts, regex })} />
        <Check label={D.ignoreAccents} checked={!!opts.ignoreAccents} onChange={(ignoreAccents) => setOpts({ ...opts, ignoreAccents })} />
        <Check label={X.find.wildcards} checked={!!opts.wildcards} onChange={(wildcards) => setOpts({ ...opts, wildcards, regex: wildcards ? false : opts.regex })} />
        <Check label={X.find.inSelection} checked={!!opts.range} onChange={(on) => { const s = c.state()?.selection; setOpts({ ...opts, range: on && s && s.from !== s.to ? { from: s.from, to: s.to } : undefined }); }} />
      </div>
      <div className="fo-word-form fo-word-form--2">
        <Row label={X.find.format}><Select value={opts.format ?? ''} label={X.find.format} options={[['', X.find.noFormat], ['bold', T.cmd.bold], ['italic', T.cmd.italic], ['underline', T.cmd.underline], ['strike', T.cmd.strike], ['highlight', T.cmd.highlight]]} onChange={(f) => setOpts({ ...opts, format: f || undefined })} /></Row>
        <Row label={X.find.specialFind}><Select value="" label={X.find.specialFind} options={[['', '—'], ['^p', `${X.find.paragraph} (^p)`], ...X.find.codes.map(([code, label]): [string, string] => [code, `${label} (${code})`])]} onChange={(code) => code && setQ(q + code)} /></Row>
        <Row label={X.find.specialReplace}><Select value="" label={X.find.specialReplace} options={[['', '—'], ['^&', `${X.find.found} (^&)`], ['^p', `${X.find.paragraph} (^p)`], ...X.find.codes.map(([code, label]): [string, string] => [code, `${label} (${code})`])]} onChange={(code) => code && setRep(rep + code)} /></Row>
      </div>
      <p className="fo-word-hint">{D.specialCodes}</p>
    </Dialog>
  );
}

export function bookmarksOf(c: Ctl): { name: string; pos: number }[] {
  const out: { name: string; pos: number }[] = [];
  c.state()?.doc.descendants((n, pos) => {
    const d = n.attrs.data as Inline | undefined;
    if (n.type.name === 'atom' && d?.type === 'bookmarkStart' && !d.name.startsWith('_')) out.push({ name: d.name, pos });
    return true;
  });
  return out;
}

export function LinkDialog({ c, onClose }: Close) {
  const st = c.state();
  const existing = st ? (st.storedMarks ?? st.selection.$from.marks()).find((m) => m.type.name === 'link') : undefined;
  const [text, setText] = useState(c.sel.text);
  const [addr, setAddr] = useState(existing ? String(existing.attrs.url ?? `#${String(existing.attrs.anchor ?? '')}`) : '');
  const [tip, setTip] = useState(existing ? String(existing.attrs.tooltip ?? '') : '');
  const [err, setErr] = useState('');
  const marks = bookmarksOf(c);
  const apply = (): void => {
    const attrs = linkMarkAttrs(addr, tip);
    if (!attrs) return setErr(D.badUrl);
    const mark = c.schema.marks.link!.create(attrs);
    c.run((state, dispatch) => {
      if (!dispatch) return true;
      const { from, to, empty } = state.selection;
      const label = text || addr;
      if (empty || text !== c.sel.text) dispatch(state.tr.replaceWith(from, to, c.schema.text(label, [...state.selection.$from.marks(), mark])));
      else dispatch(state.tr.addMark(from, to, mark));
      return true;
    });
    onClose();
  };
  return (
    <Dialog open title={T.cmd.link} onClose={onClose} onConfirm={apply} width={500}
      footerStart={existing ? <Button appearance="subtle" icon="delete" onClick={() => { c.run(setMark(c.schema.marks.link!, null)); onClose(); }}>{T.cmd.removeLink}</Button> : undefined}
      actions={[{ label: D.ok, primary: true, onClick: apply, disabled: !addr.trim() }, { label: D.cancel, onClick: onClose }]}>
      <div className="fo-word-form">
        <TextField label={D.linkText} value={text} onChange={(e) => setText(e.target.value)} />
        <TextField label={D.linkAddress} value={addr} autoFocus placeholder="https://" error={err || undefined} onChange={(e) => { setAddr(e.target.value); setErr(''); }} />
        {marks.length > 0 && (
          <Row label={D.linkPlace}>
            <Select value={addr.startsWith('#') ? addr : ''} label={D.linkPlace} options={[['', '—'], ...marks.map((b): [string, string] => [`#${b.name}`, b.name])]} onChange={(v) => setAddr(v)} />
          </Row>
        )}
        <TextField label={D.linkTip} value={tip} onChange={(e) => setTip(e.target.value)} />
      </div>
    </Dialog>
  );
}

export function BookmarkDialog({ c, onClose }: Close) {
  const [name, setName] = useState('');
  const list = bookmarksOf(c);
  const valid = /^\p{L}[\p{L}\p{N}_]{0,39}$/u.test(name);
  const add = (): void => {
    if (!valid) return;
    c.run((state, dispatch) => {
      let max = 0;
      state.doc.descendants((n) => {
        const d = n.attrs.data as Inline | undefined;
        if (n.type.name === 'atom' && d?.type === 'bookmarkStart') max = Math.max(max, d.id);
        return true;
      });
      const id = max + 1;
      const { from, to } = state.selection;
      if (dispatch) dispatch(state.tr.insert(to, c.schema.nodes.atom!.create({ data: { type: 'bookmarkEnd', id } })).insert(from, c.schema.nodes.atom!.create({ data: { type: 'bookmarkStart', id, name } })));
      return true;
    });
    onClose();
  };
  return (
    <Dialog open title={T.cmd.bookmark} onClose={onClose} onConfirm={add} width={420} actions={[{ label: D.insert, primary: true, onClick: add, disabled: !valid }, { label: D.close, onClick: onClose }]}>
      <TextField label={D.bookmarkName} value={name} autoFocus error={name && !valid ? D.bookmarkBad : undefined} onChange={(e) => setName(e.target.value)} />
      {list.length > 0 && <div className="fo-word-nav__title">{D.bookmarks}</div>}
      <ul className="fo-word-list">
        {list.map((b) => <li key={b.pos}><span>{b.name}</span><Button size="small" onClick={() => { c.act.gotoPos(b.pos + 1); onClose(); }}>{D.goTo}</Button></li>)}
      </ul>
    </Dialog>
  );
}

export function CrossRefDialog({ c, onClose }: Close) {
  const st = c.state();
  const heads = st ? collectHeadings(st.doc, c.meta, 9) : [];
  const marks = bookmarksOf(c);
  const [kind, setKind] = useState<'heading' | 'bookmark'>(heads.length ? 'heading' : 'bookmark');
  const [index, setIndex] = useState(0);
  const items = kind === 'heading' ? heads.map((h) => ({ label: h.text, pos: h.pos })) : marks.map((b) => ({ label: b.name, pos: b.pos }));
  const insert = (): void => {
    const target = items[index];
    if (!target) return;
    const text = kind === 'heading' ? target.label : (st?.doc.resolve(target.pos + 1).parent.textContent.slice(0, 80) || target.label);
    const anchor = kind === 'bookmark' ? target.label : undefined;
    c.run((state, dispatch) => {
      const marksAt = state.selection.$from.marks();
      const node = anchor ? c.schema.text(text, [...marksAt, c.schema.marks.link!.create({ anchor })]) : c.schema.text(text, marksAt);
      if (dispatch) dispatch(state.tr.replaceSelectionWith(node, false));
      return true;
    });
    onClose();
  };
  return (
    <Dialog open title={T.cmd.crossRef} onClose={onClose} onConfirm={insert} width={460} actions={[{ label: D.insert, primary: true, onClick: insert, disabled: !items.length }, { label: D.close, onClick: onClose }]}>
      <Row label={D.crossRefType}><Select value={kind} label={D.crossRefType} options={[['heading', T.cmd.crossRefHeading], ['bookmark', T.cmd.bookmark]]} onChange={(k) => { setKind(k); setIndex(0); }} /></Row>
      <div className="fo-word-nav__title">{D.crossRefTo}</div>
      <ul className="fo-word-list fo-word-list--select" role="listbox" aria-label={D.crossRefTo}>
        {items.map((it, i) => <li key={it.pos} role="option" aria-selected={i === index} className={i === index ? 'is-active' : ''} onClick={() => setIndex(i)} onDoubleClick={insert}>{it.label}</li>)}
      </ul>
    </Dialog>
  );
}

export const SYMBOL_SETS: readonly [string, string][] = [
  [D.symLatin, 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿŒœŠšŸŽž'],
  [D.symGreek, 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω'],
  [D.symMath, '±×÷≈≠≤≥∞√∑∏∫∂∆∇∈∉∩∪⊂⊃⊆⊇∀∃¬∧∨⇒⇔∝∠⊥∥°′″‰'],
  [D.symArrows, '←↑→↓↔↕⇐⇑⇒⇓⇔↖↗↘↙➔➜➤'],
  [D.symCurrency, '€£¥¢₽₹₩₺₿$'],
  [D.symMisc, '©®™§¶†‡•·…«»‹›“”‘’—–¡¿№℃℉☐☑☒★☆♠♣♥♦✓✔✗✘☎✉♪♫'],
];

export function SymbolDialog({ c, onClose }: Close) {
  const [recent, setRecent] = useState<string[]>(() => c.services.settings.get<string[]>('word.recentSymbols', []));
  const insert = (ch: string): void => {
    c.run((state, dispatch) => {
      if (dispatch) dispatch(state.tr.insertText(ch));
      return true;
    });
    const next = [ch, ...recent.filter((x) => x !== ch)].slice(0, 20);
    setRecent(next);
    c.services.settings.set('word.recentSymbols', next);
  };
  const grid = (chars: readonly string[]) => (
    <div className="fo-word-symbols">{chars.map((ch) => <button key={ch} type="button" title={`U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`} onClick={() => insert(ch)}>{ch}</button>)}</div>
  );
  return (
    <Dialog open title={D.symbolTitle} onClose={onClose} width={560} actions={[{ label: D.close, primary: true, onClick: onClose }]}>
      {recent.length > 0 && <><div className="fo-word-nav__title">{D.recentSymbols}</div>{grid(recent)}</>}
      {SYMBOL_SETS.map(([name, chars]) => <div key={name}><div className="fo-word-nav__title">{name}</div>{grid([...chars])}</div>)}
    </Dialog>
  );
}

const EQUATIONS: readonly [string, string][] = [
  [T.equations.quadratic, 'x = (−b ± √(b² − 4ac)) / 2a'], [T.equations.pythagore, 'a² + b² = c²'], [T.equations.circle, 'A = πr²'],
  [T.equations.binome, '(x + a)ⁿ = ∑ₖ₌₀ⁿ (ⁿₖ) xᵏ aⁿ⁻ᵏ'], [T.equations.euler, 'e^(iπ) + 1 = 0'],
];

export function EquationDialog({ c, onClose }: Close) {
  const [text, setText] = useState('');
  const insert = (t: string): void => {
    if (!t.trim()) return;
    c.run(insertInline({ type: 'equation', display: false, text: t, omml: { name: 'm:oMath', attrs: {}, children: [{ name: 'm:r', attrs: {}, children: [{ name: 'm:t', attrs: {}, children: [t] }] }] } }));
    onClose();
  };
  return (
    <Dialog open title={D.equationTitle} onClose={onClose} onConfirm={() => insert(text)} width={520} actions={[{ label: D.insert, primary: true, onClick: () => insert(text), disabled: !text.trim() }, { label: D.cancel, onClick: onClose }]}>
      <TextField label={D.equationTitle} value={text} autoFocus hint={D.equationHint} onChange={(e) => setText(e.target.value)} />
      <div className="fo-word-symbols">{[...'²³ⁿ√∑∫π±×÷≤≥≠∞αβγθλμσΔ'].map((ch) => <button key={ch} type="button" onClick={() => setText((t) => t + ch)}>{ch}</button>)}</div>
      <div className="fo-word-nav__title">{D.equationPresets}</div>
      <ul className="fo-word-list">{EQUATIONS.map(([name, eq]) => <li key={name}><span><strong>{name}</strong> <span className="fo-eq">{eq}</span></span><Button size="small" onClick={() => insert(eq)}>{D.insert}</Button></li>)}</ul>
    </Dialog>
  );
}

const DATE_FORMATS: readonly [string, Intl.DateTimeFormatOptions][] = [
  ['dd/MM/yyyy', { day: '2-digit', month: '2-digit', year: 'numeric' }],
  ['d MMMM yyyy', { day: 'numeric', month: 'long', year: 'numeric' }],
  ['dddd d MMMM yyyy', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }],
  ['MMMM yyyy', { month: 'long', year: 'numeric' }],
  ['HH:mm', { hour: '2-digit', minute: '2-digit' }],
  ['dd/MM/yyyy HH:mm', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }],
];

export function DateDialog({ c, onClose }: Close) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  const now = new Date();
  const label = (k: number): string => now.toLocaleString('fr-FR', DATE_FORMATS[k]![1]);
  const insert = (): void => {
    const text = label(i);
    const pattern = DATE_FORMATS[i]![0];
    const code = pattern.startsWith('HH') ? 'TIME' : 'DATE';
    if (auto) c.run(insertInline({ type: 'field', code, instruction: ` ${code} \\@ "${pattern}" `, result: [{ type: 'text', text, props: {} }] }));
    else c.run((state, dispatch) => { if (dispatch) dispatch(state.tr.insertText(text)); return true; });
    onClose();
  };
  return (
    <Dialog open title={D.dateTitle} onClose={onClose} onConfirm={insert} width={420} actions={[{ label: D.ok, primary: true, onClick: insert }, { label: D.cancel, onClick: onClose }]}>
      <div className="fo-word-nav__title">{D.dateFormats}</div>
      <ul className="fo-word-list fo-word-list--select" role="listbox" aria-label={D.dateFormats}>
        {DATE_FORMATS.map((_, k) => <li key={k} role="option" aria-selected={k === i} className={k === i ? 'is-active' : ''} onClick={() => setI(k)} onDoubleClick={insert}>{label(k)}</li>)}
      </ul>
      <Check label={D.updateAuto} checked={auto} onChange={setAuto} />
    </Dialog>
  );
}

export function FieldDialog({ c, onClose }: Close) {
  const codes = (Object.keys(T.fieldNames) as (keyof typeof T.fieldNames)[]).filter((k) => !['MERGEFIELD', 'REF', 'TOC'].includes(k));
  const [code, setCode] = useState<string>('DATE');
  const insert = (): void => {
    c.act.insertField(code);
    onClose();
  };
  return (
    <Dialog open title={D.fieldTitle} onClose={onClose} onConfirm={insert} width={380} actions={[{ label: D.ok, primary: true, onClick: insert }, { label: D.cancel, onClick: onClose }]}>
      <ul className="fo-word-list fo-word-list--select" role="listbox" aria-label={D.fieldCode}>
        {codes.map((k) => <li key={k} role="option" aria-selected={k === code} className={k === code ? 'is-active' : ''} onClick={() => setCode(k)} onDoubleClick={insert}><strong>{k}</strong> — {T.fieldNames[k]}</li>)}
      </ul>
    </Dialog>
  );
}
