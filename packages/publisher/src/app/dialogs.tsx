// Boites de dialogue : taille de page, reperes de disposition, insertion de pages, tableau, icones, destinataires du
// publipostage (CSV), zone de texte, arriere-plan, texte de remplacement, rechercher / remplacer, lien.
import { useState, type ReactNode } from 'react';
import { Button, Checkbox, ColorPicker, Dialog, Icon, isIconName, NumberField as BareNumber, TextField, type IconName, type NumberFieldProps } from '@forgeoffice/ui';
import { mmToPt, ptToMm, replaceText } from '@forgeoffice/pptx';
import { parseCsv } from '../merge.ts';
import { exportPptx } from './export.ts';
import { pptxLosses } from '../pptx-export.ts';
import { isWorkbookName, openMergeBook, pickFields, XLSX_EXTENSIONS, type MergeBook } from '../merge-xlsx.ts';
import type { MergeSource } from '../model.ts';
import { S } from '../strings.ts';
import type { Editor } from './editor.ts';
import { addPages, applyBody, colorFromHex, currentBody, hexOf, insertIcon, insertTable, themeSwatches } from './ops.ts';
import { resize } from './ribbon/design.tsx';

const ICONS = [
  'briefcase', 'handshake', 'trophy', 'target', 'flag', 'money', 'building', 'megaphone', 'chat', 'heart', 'rocket', 'leaf_two', 'gift', 'airplane', 'vehicle_car', 'food',
  'camera', 'location', 'map', 'shopping_bag', 'music_note_2', 'puzzle_piece', 'hat_graduation', 'star', 'lightbulb', 'calendar_ltr', 'clock', 'mail', 'phone', 'globe',
  'people', 'person', 'home', 'book_open', 'certificate', 'ticket_diagonal', 'contact_card', 'cloud', 'weather_sunny', 'weather_moon', 'sparkle', 'pin', 'emoji', 'library',
].filter(isIconName);

const mm = (pt: number): number => Math.round(ptToMm(pt) * 10) / 10;

/** Compteur avec son libelle visible a gauche. */
export function NumberField(props: NumberFieldProps) {
  return (
    <label className="pub-field">
      <span>{props.label}</span>
      <BareNumber {...props} />
    </label>
  );
}

function PageSetup({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [w, setW] = useState(mm(ed.deck.size.width));
  const [h, setH] = useState(mm(ed.deck.size.height));
  return (
    <Dialog open title={S.dialogs.pageSetup} onClose={onClose} onConfirm={() => { resize(ed, { width: mmToPt(w), height: mmToPt(h) }); onClose(); }}>
      <div className="pub-form">
        <NumberField label={S.dialogs.width} value={w} min={25.4} max={1422} step={1} unit={S.dialogs.mm} onChange={setW} />
        <NumberField label={S.dialogs.height} value={h} min={25.4} max={1422} step={1} unit={S.dialogs.mm} onChange={setH} />
      </div>
    </Dialog>
  );
}

function Guides({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [p, setP] = useState(ed.pub);
  const num = (label: string, value: number, set: (v: number) => void, max = 200): ReactNode => <NumberField label={label} value={mm(value)} min={0} max={max} step={0.5} unit={S.dialogs.mm} onChange={(v) => set(mmToPt(v))} />;
  return (
    <Dialog open width={560} title={S.dialogs.guidesTitle} onClose={onClose} onConfirm={() => { ed.commitPub(p, 'guides'); ed.setUi({ twoPage: p.facing }); onClose(); }}>
      <div className="pub-form pub-form--cols">
        <fieldset>
          <legend>{S.dialogs.marginsTab}</legend>
          {num(p.facing ? S.dialogs.inside : S.dialogs.left, p.margins.inside, (v) => setP({ ...p, margins: { ...p.margins, inside: v } }))}
          {num(p.facing ? S.dialogs.outside : S.dialogs.right, p.margins.outside, (v) => setP({ ...p, margins: { ...p.margins, outside: v } }))}
          {num(S.dialogs.top, p.margins.top, (v) => setP({ ...p, margins: { ...p.margins, top: v } }))}
          {num(S.dialogs.bottom, p.margins.bottom, (v) => setP({ ...p, margins: { ...p.margins, bottom: v } }))}
          <Checkbox checked={p.facing} label={S.dialogs.masterTwoPage} onChange={(v) => setP({ ...p, facing: v })} />
        </fieldset>
        <fieldset>
          <legend>{S.dialogs.gridTab}</legend>
          <NumberField label={S.dialogs.columns} value={p.columns.count} min={1} max={24} step={1} onChange={(v) => setP({ ...p, columns: { ...p.columns, count: Math.round(v) } })} />
          {num(S.dialogs.spacing, p.columns.gap, (v) => setP({ ...p, columns: { ...p.columns, gap: v } }), 100)}
          <NumberField label={S.dialogs.rows} value={p.rows.count} min={1} max={24} step={1} onChange={(v) => setP({ ...p, rows: { ...p.rows, count: Math.round(v) } })} />
          {num(S.dialogs.spacing, p.rows.gap, (v) => setP({ ...p, rows: { ...p.rows, gap: v } }), 100)}
        </fieldset>
        <fieldset>
          <legend>{S.dialogs.baselineTab}</legend>
          <NumberField label={S.dialogs.spacing} value={Math.round(p.baseline.spacing * 10) / 10} min={1} max={144} step={0.5} unit={S.dialogs.pt} onChange={(v) => setP({ ...p, baseline: { ...p.baseline, spacing: v } })} />
          <NumberField label={S.dialogs.offset} value={Math.round(p.baseline.offset * 10) / 10} min={0} max={144} step={0.5} unit={S.dialogs.pt} onChange={(v) => setP({ ...p, baseline: { ...p.baseline, offset: v } })} />
        </fieldset>
      </div>
    </Dialog>
  );
}

function InsertPages({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [n, setN] = useState(1);
  const [before, setBefore] = useState(false);
  return (
    <Dialog open title={S.dialogs.insertPages} onClose={onClose} onConfirm={() => { addPages(ed, Math.max(1, Math.min(100, Math.round(n))), before); onClose(); }}>
      <div className="pub-form">
        <NumberField label={S.dialogs.howMany} value={n} min={1} max={100} step={1} onChange={setN} />
        <Checkbox checked={!before} label={S.dialogs.after} onChange={(v) => setBefore(!v)} />
        <Checkbox checked={before} label={S.dialogs.before} onChange={setBefore} />
      </div>
    </Dialog>
  );
}

function TableDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);
  return (
    <Dialog open title={S.dialogs.table} onClose={onClose} onConfirm={() => { insertTable(ed, rows, cols); onClose(); }}>
      <div className="pub-form">
        <NumberField label={S.dialogs.tableRows} value={rows} min={1} max={60} step={1} onChange={(v) => setRows(Math.round(v))} />
        <NumberField label={S.dialogs.tableCols} value={cols} min={1} max={30} step={1} onChange={(v) => setCols(Math.round(v))} />
      </div>
    </Dialog>
  );
}

function Icons({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<IconName | null>(null);
  const list = ICONS.filter((n) => n.includes(query.toLowerCase().replace(/\s+/g, '_')));
  return (
    <Dialog open width={560} title={S.dialogs.icons} onClose={onClose} actions={[{ label: S.dialogs.insert, primary: true, disabled: !pick, onClick: () => { if (pick) void insertIcon(ed, pick); onClose(); } }, { label: S.dialogs.cancel, onClick: onClose }]}>
      <TextField icon="search" placeholder={S.dialogs.iconSearch} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={S.dialogs.iconSearch} />
      <div className="pub-icons">
        {list.map((n) => (
          <button key={n} type="button" className={pick === n ? 'is-active' : ''} title={n.replace(/_/g, ' ')} onClick={() => setPick(n)} onDoubleClick={() => { void insertIcon(ed, n); onClose(); }}>
            <Icon name={n} size={32} />
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/** Liste en cours de choix : source complete (CSV ou feuille d'un classeur), feuille et champs retenus. */
interface MergeDraft {
  name: string;
  book: MergeBook | null;
  sheet: number;
  full: MergeSource;
  keep: Set<string>;
}

function Merge({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const source = ed.pub.merge;
  const [draft, setDraft] = useState<MergeDraft | null>(null);
  const load = async (): Promise<void> => {
    const file = await ed.services.openFile([{ name: S.dialogs.mergeFilter, extensions: ['csv', 'txt', ...XLSX_EXTENSIONS] }]);
    if (!file) return;
    if (file.bytes.length > 32 * 1024 * 1024) return;
    try {
      if (isWorkbookName(file.name)) {
        const book = await openMergeBook(file.bytes, file.name);
        if (!book.sheets.length) throw new Error(S.dialogs.mergeBadFile);
        const full = book.read(0);
        if (!full.fields.length) throw new Error(S.dialogs.mergeBadSheet);
        setDraft({ name: file.name, book, sheet: 0, full, keep: new Set(full.fields) });
        return;
      }
      const parsed = parseCsv(new TextDecoder().decode(file.bytes), file.name);
      if (!parsed.fields.length) throw new Error(S.dialogs.mergeBadCsv);
      setDraft({ name: file.name, book: null, sheet: 0, full: parsed, keep: new Set(parsed.fields) });
    } catch (err) {
      ed.notify(err instanceof Error && err.message ? err.message : S.dialogs.mergeBadFile, 'error');
    }
  };
  const chooseSheet = (i: number): void => {
    if (!draft?.book) return;
    const full = draft.book.read(i);
    setDraft({ ...draft, sheet: i, full, keep: new Set(full.fields) });
  };
  const use = (): void => {
    if (!draft) return;
    ed.commitPub({ ...ed.pub, merge: pickFields(draft.full, draft.keep) }, 'merge');
    setDraft(null);
  };
  const shown = draft ? pickFields(draft.full, draft.keep) : source;
  return (
    <Dialog
      open
      width={680}
      title={S.dialogs.mergeTitle}
      onClose={onClose}
      actions={draft ? [{ label: S.dialogs.mergeUse, primary: true, disabled: draft.keep.size === 0, onClick: use }, { label: S.dialogs.cancel, onClick: () => setDraft(null) }] : [{ label: S.dialogs.close, primary: true, onClick: onClose }]}
      footerStart={<Button data-autofocus icon="arrow_import" onClick={() => void load()}>{S.dialogs.mergeImport}</Button>}
    >
      {draft && (
        <div className="pub-merge-pick" data-testid="merge-pick">
          {draft.book && (
            <label className="pub-merge-sheet">
              {S.dialogs.mergeSheet}
              <select value={draft.sheet} onChange={(e) => chooseSheet(Number(e.target.value))}>
                {draft.book.sheets.map((n, i) => <option key={n} value={i}>{n}</option>)}
              </select>
            </label>
          )}
          <fieldset>
            <legend>{S.dialogs.mergeFields}</legend>
            <div className="pub-merge-fields">
              {draft.full.fields.map((f) => (
                <Checkbox key={f} label={f} checked={draft.keep.has(f)} onChange={(on) => setDraft({ ...draft, keep: new Set(on ? [...draft.keep, f] : [...draft.keep].filter((k) => k !== f)) })} />
              ))}
            </div>
          </fieldset>
        </div>
      )}
      {!shown ? (
        <p className="pub-muted">{S.dialogs.mergeEmpty}</p>
      ) : (
        <>
          <p><strong>{shown.name}</strong> · {S.dialogs.mergeRecords(shown.records.length)}</p>
          <div className="pub-merge-table fo-scroll">
            <table>
              <thead><tr>{shown.fields.map((f) => <th key={f}>{f}</th>)}</tr></thead>
              <tbody>{shown.records.slice(0, 200).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </Dialog>
  );
}

/** Export .pptx : ce que PowerPoint ne garde pas, avant l'enregistrement. */
function PptxExport({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const lost = pptxLosses(ed.deck, ed.pub);
  return (
    <Dialog open width={560} title={S.pptx.title} onClose={onClose} actions={[{ label: S.pptx.export, primary: true, onClick: () => { onClose(); void exportPptx(ed); } }, { label: S.dialogs.cancel, onClick: onClose }]}>
      <div className="pub-pptx-loss" data-testid="pptx-loss">
        <p>{S.pptx.intro}</p>
        <ul>
          {lost.map((l) => (
            <li key={l.kind}>
              <strong>{S.pptx.lost[l.kind](l.count)}</strong>
              <span className="pub-muted"> {S.pptx.why[l.kind]}</span>
            </li>
          ))}
        </ul>
        <p className="pub-muted">{S.pptx.kept}</p>
      </div>
    </Dialog>
  );
}

function TextBoxDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const body = currentBody(ed);
  const ins = { left: 7.2, top: 3.6, right: 7.2, bottom: 3.6, ...(body.insets ?? {}) };
  const [insets, setInsets] = useState(ins);
  const [cols, setCols] = useState(body.columns ?? 1);
  const [gap, setGap] = useState(body.columnSpacing ?? 14.4);
  const side = (key: keyof typeof ins, label: string): ReactNode => <NumberField label={label} value={mm(insets[key])} min={0} max={50} step={0.5} unit={S.dialogs.mm} onChange={(v) => setInsets({ ...insets, [key]: mmToPt(v) })} />;
  return (
    <Dialog open title={S.dialogs.textBox} onClose={onClose} onConfirm={() => { applyBody(ed, { insets, columns: cols, columnSpacing: cols > 1 ? gap : undefined }); onClose(); }}>
      <div className="pub-form pub-form--cols">
        <fieldset>
          <legend>{S.dialogs.insets}</legend>
          {side('left', S.dialogs.left)}
          {side('right', S.dialogs.right)}
          {side('top', S.dialogs.top)}
          {side('bottom', S.dialogs.bottom)}
        </fieldset>
        <fieldset>
          <legend>{S.cmd.columns}</legend>
          <NumberField label={S.dialogs.columns} value={cols} min={1} max={16} step={1} onChange={(v) => setCols(Math.round(v))} />
          <NumberField label={S.dialogs.colGap} value={mm(gap)} min={0} max={50} step={0.5} unit={S.dialogs.mm} onChange={(v) => setGap(mmToPt(v))} />
        </fieldset>
      </div>
    </Dialog>
  );
}

function Background({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [c1, setC1] = useState<string | null>(hexOf(ed, { type: 'scheme', value: 'accent1' }));
  const [c2, setC2] = useState<string | null>('#FFFFFF');
  const [gradient, setGradient] = useState(false);
  const apply = (): void => {
    const page = ed.page;
    if (!page || !c1) return;
    const fill = gradient && c2
      ? { type: 'gradient' as const, kind: 'linear' as const, angle: 90, stops: [{ position: 0, color: colorFromHex(ed, c1) }, { position: 100, color: colorFromHex(ed, c2) }] }
      : { type: 'solid' as const, color: colorFromHex(ed, c1) };
    ed.commitDeck({ ...ed.deck, slides: ed.deck.slides.map((s) => (s.id === page.id ? { ...s, background: { type: 'fill', fill } } : s)) }, 'background');
    onClose();
  };
  return (
    <Dialog open title={S.dialogs.background} onClose={onClose} onConfirm={apply}>
      <div className="pub-form">
        <ColorPicker label={S.dialogs.color} value={c1} onChange={setC1} themeColors={themeSwatches(ed)} showLabel />
        <Checkbox checked={gradient} label={S.dialogs.gradient} onChange={setGradient} />
        {gradient && <ColorPicker label={S.dialogs.color2} value={c2} onChange={setC2} themeColors={themeSwatches(ed)} showLabel />}
      </div>
    </Dialog>
  );
}

function AltText({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [text, setText] = useState(ed.selectedShapes[0]?.description ?? '');
  return (
    <Dialog open title={S.dialogs.altText} description={S.dialogs.altHelp} onClose={onClose} onConfirm={() => { ed.editSelected((s) => { s.description = text.slice(0, 2000); }, 'alt'); onClose(); }}>
      <TextField value={text} onChange={(e) => setText(e.target.value)} aria-label={S.dialogs.altText} data-autofocus />
    </Dialog>
  );
}

function FindReplace({ ed, replace, onClose }: { ed: Editor; replace: boolean; onClose: () => void }) {
  const [find, setFind] = useState('');
  const [by, setBy] = useState('');
  const run = (): void => {
    if (!find) return;
    if (!replace) {
      const index = ed.deck.slides.findIndex((s) => JSON.stringify(s.shapes).toLowerCase().includes(JSON.stringify(find).slice(1, -1).toLowerCase()));
      if (index < 0) ed.notify(S.dialogs.notFound, 'info');
      else ed.goto(index);
      return;
    }
    const deck = structuredClone(ed.deck);
    const n = replaceText(deck, find, by);
    if (n) ed.commitDeck(deck, 'replace');
    ed.notify(n ? S.dialogs.replaced(n) : S.dialogs.notFound, n ? 'success' : 'info');
  };
  return (
    <Dialog open title={replace ? S.cmd.replace : S.cmd.find} onClose={onClose} actions={[{ label: replace ? S.dialogs.replaceAll : S.dialogs.find, primary: true, onClick: run }, { label: S.dialogs.close, onClick: onClose }]}>
      <div className="pub-form">
        <TextField label={S.dialogs.find} value={find} onChange={(e) => setFind(e.target.value)} data-autofocus />
        {replace && <TextField label={S.dialogs.replaceWith} value={by} onChange={(e) => setBy(e.target.value)} />}
      </div>
    </Dialog>
  );
}

function LinkDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [url, setUrl] = useState(ed.selectedShapes[0]?.click?.url ?? 'https://');
  const apply = (): void => {
    if (!/^(https?:|mailto:)/i.test(url)) {
      ed.notify(S.dialogs.badLink, 'error');
      return;
    }
    ed.editSelected((s) => { s.click = { url }; }, 'link');
    onClose();
  };
  return (
    <Dialog open title={S.cmd.link} onClose={onClose} onConfirm={apply}>
      <TextField label={S.dialogs.linkUrl} value={url} onChange={(e) => setUrl(e.target.value)} data-autofocus />
    </Dialog>
  );
}

export function Dialogs({ ed }: { ed: Editor }) {
  const id = ed.ui.dialog;
  const close = (): void => ed.setUi({ dialog: null });
  switch (id) {
    case 'pageSetup': return <PageSetup ed={ed} onClose={close} />;
    case 'guides': return <Guides ed={ed} onClose={close} />;
    case 'insertPages': return <InsertPages ed={ed} onClose={close} />;
    case 'table': return <TableDialog ed={ed} onClose={close} />;
    case 'icons': return <Icons ed={ed} onClose={close} />;
    case 'merge': return <Merge ed={ed} onClose={close} />;
    case 'pptxExport': return <PptxExport ed={ed} onClose={close} />;
    case 'textBox': return <TextBoxDialog ed={ed} onClose={close} />;
    case 'background': return <Background ed={ed} onClose={close} />;
    case 'altText': return <AltText ed={ed} onClose={close} />;
    case 'find': return <FindReplace ed={ed} replace={false} onClose={close} />;
    case 'replace': return <FindReplace ed={ed} replace onClose={close} />;
    case 'link': return <LinkDialog ed={ed} onClose={close} />;
    default: return null;
  }
}
