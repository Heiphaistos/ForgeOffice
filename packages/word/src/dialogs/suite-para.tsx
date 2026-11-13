// Format > Paragraphe (dispositions LibreOffice / OpenOffice) : memes onglets et champs que la vraie boite, branches sur les proprietes de paragraphe de ForgeOffice.
import { useState, type ReactNode } from 'react';
import { Dialog, NumberField, suiteDialogKind, type DialogTab } from '@forgeoffice/ui';
import type { LineSpacing, ParagraphProps } from '@forgeoffice/docx';
import type { Ctl } from '../app/types.ts';
import { setParagraph } from '../editor/commands.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';
import { SD } from '../strings-suite.ts';
import { Check, Select } from './common.tsx';
import { Field, Radio, Title } from './suite-char.tsx';

const P = SD.paragraph;
type Close = { c: Ctl; onClose: () => void };
type Kind = 'single' | '1.15' | '1.5' | 'double' | 'prop' | 'atLeast' | 'exact';

const kindOf = (ls: LineSpacing): Kind => {
  if (ls.rule !== 'auto') return ls.rule;
  return ls.value === 1 ? 'single' : ls.value === 1.15 ? '1.15' : ls.value === 1.5 ? '1.5' : ls.value === 2 ? 'double' : 'prop';
};

function PreviewPage() {
  return <div className="fo-sdlg__preview-page" aria-hidden>{['', '', '', 'd', 'd', 'd', '', '', ''].map((k, i) => <i key={i} className={k} />)}</div>;
}

export function ParagraphSuiteDialog({ c, onClose }: Close) {
  const oo = suiteDialogKind() === 'openoffice';
  const p0 = c.sel.para;
  const [st, setSt] = useState<ParagraphProps>({ ...p0 });
  const set = (patch: Partial<ParagraphProps>): void => setSt((s) => ({ ...s, ...patch }));
  const ls: LineSpacing = st.lineSpacing ?? { rule: 'auto', value: 1 };
  const kind = kindOf(ls);
  const na = SD.na;
  const apply = (): void => {
    const { numbering: _n, tabs: _t, borders: _b, shading, ...rest } = st;
    c.run(setParagraph({ props: p0.shading === shading ? rest : { ...rest, shading } }));
    onClose();
  };
  const setKind = (k: Kind): void => {
    const rule = k === 'atLeast' || k === 'exact' ? k : 'auto';
    const value = k === 'single' ? 1 : k === '1.15' ? 1.15 : k === '1.5' ? 1.5 : k === 'double' ? 2 : k === 'prop' ? ls.rule === 'auto' ? ls.value : 1 : 12;
    set({ lineSpacing: { rule, value } });
  };
  const cm = (label: string, v: number | undefined, on: (pt: number) => void, min = -20): ReactNode => (
    <Field label={label}><NumberField value={ptToCm(v ?? 0)} step={0.1} min={min} max={50} unit="cm" width={110} label={label} onChange={(x) => on(cmToPt(x))} /></Field>
  );
  const off = (id: string, label: string, hint = na): DialogTab => ({ id, label, content: null, disabled: true, hint });
  const withPreview = (body: ReactNode): ReactNode => <div className="fo-sdlg__withprev"><div>{body}</div><PreviewPage /></div>;

  const indents = withPreview(
    <>
      <Title>{P.indent}</Title>
      {cm(P.before, st.indentLeft, (indentLeft) => set({ indentLeft }))}
      {cm(P.after, st.indentRight, (indentRight) => set({ indentRight }))}
      {cm(P.first, st.indentFirstLine, (indentFirstLine) => set({ indentFirstLine }))}
      <Check label={P.autoFirst} checked={false} onChange={() => undefined} />
      <Title>{P.spacing}</Title>
      {cm(P.above, st.spacingBefore, (spacingBefore) => set({ spacingBefore }), 0)}
      {cm(P.below, st.spacingAfter, (spacingAfter) => set({ spacingAfter }), 0)}
      <Check label={P.noSpace} checked={!!st.contextualSpacing} onChange={(contextualSpacing) => set({ contextualSpacing })} />
      <Title>{P.line}</Title>
      <div className="fo-sdlg__inline">
        <Select value={kind} label={P.line} options={P.lineOptions.map(([v, l]): [Kind, string] => [v, l])} onChange={setKind} />
        <span>{P.of}</span>
        <NumberField value={kind === 'prop' ? Math.round(ls.value * 100) : ls.value} min={kind === 'prop' ? 6 : 0.1} max={kind === 'prop' ? 9999 : 1584} step={kind === 'prop' ? 5 : 1} unit={kind === 'prop' ? '%' : 'pt'} width={100} label={P.of}
          disabled={kind !== 'prop' && kind !== 'atLeast' && kind !== 'exact'} onChange={(v) => set({ lineSpacing: { rule: ls.rule, value: kind === 'prop' ? v / 100 : v } })} />
      </div>
      <Check label={P.pageLine} checked={false} onChange={() => undefined} />
    </>,
  );
  const align = st.alignment ?? 'left';
  const alignment = withPreview(
    <>
      <Title>{P.options}</Title>
      <Radio label={P.start} checked={align === 'left'} onChange={() => set({ alignment: 'left' })} />
      <Radio label={P.center} checked={align === 'center'} onChange={() => set({ alignment: 'center' })} />
      <Radio label={P.end} checked={align === 'right'} onChange={() => set({ alignment: 'right' })} />
      <Radio label={P.justify} checked={align === 'justify'} onChange={() => set({ alignment: 'justify' })} />
      <Title>{P.texttotext}</Title>
      <Field label={P.alignment}><select disabled title={na} aria-label={P.alignment}><option>Automatique</option></select></Field>
      <Title>{P.props}</Title>
      <Field label={P.direction}><select disabled title={na} aria-label={P.direction}><option>{P.directionOn}</option></select></Field>
      <Check label={P.autoDir} checked={!st.bidi} onChange={(on) => set({ bidi: on ? undefined : true })} />
    </>,
  );
  const flow = (
    <div className="fo-sdlg__cols fo-sdlg__cols--2">
      <div>
        <Title>{P.hyphenation}</Title>
        <Check label={P.autoHyph} checked={false} onChange={() => undefined} />
        <p className="fo-sdlg__hint">{na}</p>
      </div>
      <div>
        <Title>{P.breaks}</Title>
        <Check label={P.insert} checked={!!st.pageBreakBefore} onChange={(pageBreakBefore) => set({ pageBreakBefore })} />
        <Title>{P.split}</Title>
        <Check label={P.keepNext} checked={!!st.keepNext} onChange={(keepNext) => set({ keepNext })} />
        <Check label={P.allowSplit} checked={!st.keepLines} onChange={(on) => set({ keepLines: on ? undefined : true })} />
        <Check label={P.orphans} checked={st.widowControl !== false} onChange={(widowControl) => set({ widowControl })} />
        <Check label={P.widows} checked={st.widowControl !== false} onChange={(widowControl) => set({ widowControl })} />
      </div>
    </div>
  );
  const levels: [string, string][] = [['9', P.body], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): [string, string] => [String(n - 1), P.level(n)])];
  const outline = (
    <>
      <Title>{P.outlineSection}</Title>
      <Field label={P.outlineLevel}><Select value={String(st.outlineLevel ?? 9)} label={P.outlineLevel} options={levels} onChange={(v) => set({ outlineLevel: v === '9' ? undefined : Number(v) })} /></Field>
    </>
  );
  const tabsTab = (
    <>
      <p className="fo-sdlg__hint">{P.tabsHint}</p>
      <button type="button" className="fo-sbtn" onClick={() => { apply(); c.openDialog('tabs'); }}>{P.openTabs}</button>
    </>
  );
  const drop = st.dropCap;
  const dropcaps = (
    <>
      <Title>{P.tabs.dropcaps}</Title>
      <Check label="Afficher les lettrines" checked={!!drop} onChange={(on) => set({ dropCap: on ? { kind: 'drop', lines: 3 } : undefined })} />
      <Field label="Nombre de lignes :"><NumberField value={drop?.lines ?? 3} min={2} max={10} width={100} disabled={!drop} label="Nombre de lignes" onChange={(lines) => drop && set({ dropCap: { ...drop, lines } })} /></Field>
      <Field label="Position :"><Select value={drop?.kind ?? 'drop'} label="Position" options={[['drop', 'Dans le texte'], ['margin', 'Dans la marge']]} onChange={(kind) => drop && set({ dropCap: { ...drop, kind } })} /></Field>
    </>
  );
  const borderTab = (
    <>
      <p className="fo-sdlg__hint">{P.bordersHint}</p>
      <button type="button" className="fo-sbtn" onClick={() => { apply(); c.openDialog('borders'); }}>{P.openBorders}</button>
    </>
  );
  const fill = st.shading?.fill && st.shading.fill !== 'auto' ? `#${st.shading.fill}` : '';
  const background = (
    <>
      <Title>{P.tabs.background}</Title>
      <Check label={P.noFill} checked={!fill} onChange={(on) => set({ shading: on ? undefined : { fill: 'FFFF00', pattern: 'clear' } })} />
      <Field label={P.fill}><input type="color" aria-label={P.fill} disabled={!fill} value={fill || '#ffffff'} onChange={(e) => set({ shading: { fill: e.target.value.slice(1).toUpperCase(), pattern: 'clear' } })} /></Field>
    </>
  );
  const tabs: DialogTab[] = oo
    ? [{ id: 'indents', label: P.tabs.indents, content: indents }, { id: 'align', label: P.tabs.align, content: alignment }, { id: 'flow', label: P.tabs.flow, content: flow }, { id: 'outline', label: P.tabs.numbering, content: outline },
      { id: 'tabs', label: P.tabs.tabs, content: tabsTab }, { id: 'dropcaps', label: P.tabs.dropcaps, content: dropcaps }, { id: 'border', label: P.tabs.bordersOO, content: borderTab }, { id: 'background', label: P.tabs.background, content: background }]
    : [{ id: 'indents', label: P.tabs.indents, content: indents }, { id: 'align', label: P.tabs.align, content: alignment }, { id: 'flow', label: P.tabs.flow, content: flow }, off('asian', P.tabs.asian), { id: 'outline', label: P.tabs.outline, content: outline },
      { id: 'tabs', label: P.tabs.tabs, content: tabsTab }, { id: 'dropcaps', label: P.tabs.dropcaps, content: dropcaps }, { id: 'border', label: P.tabs.border, content: borderTab }, { id: 'background', label: P.tabs.background, content: background }, off('transparency', P.tabs.transparency)];
  return (
    <Dialog open title={P.title} onClose={onClose} onConfirm={apply} width={oo ? 580 : 880} tabs={tabs} onReset={() => setSt({ ...p0 })}
      actions={[{ label: SD.ok, primary: true, onClick: apply }, { label: SD.cancel, onClick: onClose }]}>
      {null}
    </Dialog>
  );
}
