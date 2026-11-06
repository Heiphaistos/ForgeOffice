// Dialogues de page et d'outils : Tableau, Filigrane, Mise en page, Statistiques, Legende, Citation, Index, Style, Atteindre,
// Collage special, Texte de remplacement, Bordure de page, Trier, Encre, Orthographe.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Fragment, type Node as PMNode } from 'prosemirror-model';
import { Button, ColorPalette, Dialog, NumberField, TextField } from '@forgeoffice/ui';
import { statistics, type Border, type BorderStyle, type Inline, type Section } from '@forgeoffice/docx';
import { T } from '../strings.ts';
import type { Ctl } from '../app/types.ts';
import { fullDocument, type Env } from '../app/actions.ts';
import { insertBlocks, insertInline, paragraphs, selectedParagraphs, updateAtom } from '../editor/commands.ts';
import { readWatermark, setCustomProp, WATERMARK_PROP, writeWatermark } from '../features/design.ts';
import { PAGE_SIZES } from '../ribbon/page.ts';
import { cmToPt, ptToCm } from '../ribbon/shared.ts';
import { Check, Row, Select } from './common.tsx';

const D = T.dialogs;
type Close = { c: Ctl; onClose: () => void };

export function TableDialog({ c, onClose }: Close) {
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(5);
  const ok = (): void => { c.act.insertTable(rows, cols); onClose(); };
  return (
    <Dialog open title={T.cmd.insertTable.replace('…', '')} onClose={onClose} onConfirm={ok} width={360} actions={[{ label: D.ok, primary: true, onClick: ok }, { label: D.cancel, onClick: onClose }]}>
      <div className="fo-word-form fo-word-form--2">
        <Row label={D.cols}><NumberField value={cols} min={1} max={63} label={D.cols} width={80} onChange={setCols} /></Row>
        <Row label={D.rows}><NumberField value={rows} min={1} max={500} label={D.rows} width={80} onChange={setRows} /></Row>
      </div>
    </Dialog>
  );
}

export function WatermarkDialog({ c, onClose }: Close) {
  const cur = readWatermark(c.meta);
  const [text, setText] = useState(cur?.text ?? T.watermarks.confidential);
  const [color, setColor] = useState(cur?.color ?? '#C0C0C0');
  const [diagonal, setDiagonal] = useState(cur?.diagonal ?? true);
  const ok = (): void => {
    c.updateMeta((m) => setCustomProp(m, WATERMARK_PROP, writeWatermark(text.trim() ? { text: text.trim(), color, diagonal } : null)));
    onClose();
  };
  return (
    <Dialog open title={D.watermarkTitle} onClose={onClose} onConfirm={ok} width={440} actions={[{ label: D.ok, primary: true, onClick: ok }, { label: D.cancel, onClick: onClose }]}>
      <TextField label={D.watermarkText} value={text} autoFocus maxLength={60} onChange={(e) => setText(e.target.value)} />
      <Check label={D.watermarkDiagonal} checked={diagonal} onChange={setDiagonal} />
      <fieldset className="fo-word-fieldset"><legend>{D.watermarkColor}</legend><ColorPalette value={color} onPick={(v) => setColor(v ?? '#C0C0C0')} /></fieldset>
    </Dialog>
  );
}

export function PageSetupDialog({ c, onClose }: Close) {
  const s = c.section;
  const [scope, setScope] = useState<'section' | 'document'>('section');
  const [st, setSt] = useState<Section>({ ...s, margins: { ...s.margins }, columns: { ...s.columns } });
  const m = st.margins;
  const setM = (k: keyof Section['margins'], cm: number): void => setSt({ ...st, margins: { ...m, [k]: cmToPt(cm) } });
  const ok = (): void => {
    c.act.setSection({ margins: st.margins, pageWidth: st.pageWidth, pageHeight: st.pageHeight, orientation: st.orientation, columns: st.columns }, scope);
    onClose();
  };
  const size = PAGE_SIZES.find((p) => Math.abs(Math.min(st.pageWidth, st.pageHeight) - p.w) < 2 && Math.abs(Math.max(st.pageWidth, st.pageHeight) - p.h) < 2)?.id ?? 'custom';
  const num = (label: string, value: number, on: (v: number) => void, min = 0, max = 55) => (
    <Row label={label}><NumberField value={value} min={min} max={max} step={0.1} label={label} width={80} onChange={on} /></Row>
  );
  return (
    <Dialog open title={D.pageSetup} onClose={onClose} onConfirm={ok} width={560} actions={[{ label: D.ok, primary: true, onClick: ok }, { label: D.cancel, onClick: onClose }]}>
      {c.sectionCount > 1 && (
        <Row label={D.applyTo}>
          <Select value={scope} label={D.applyTo} options={[['section', D.applySection(c.sectionIndex + 1)], ['document', D.applyDocument]]} onChange={setScope} />
        </Row>
      )}
      <fieldset className="fo-word-fieldset">
        <legend>{D.margins}</legend>
        <div className="fo-word-form fo-word-form--2">
          {num(D.top, ptToCm(m.top), (v) => setM('top', v))}
          {num(D.bottom, ptToCm(m.bottom), (v) => setM('bottom', v))}
          {num(`${D.left} (cm)`, ptToCm(m.left), (v) => setM('left', v))}
          {num(`${D.right} (cm)`, ptToCm(m.right), (v) => setM('right', v))}
          {num(D.gutter, ptToCm(m.gutter), (v) => setM('gutter', v))}
          {num(D.headerDist, ptToCm(m.header), (v) => setM('header', v))}
          {num(D.footerDist, ptToCm(m.footer), (v) => setM('footer', v))}
        </div>
      </fieldset>
      <fieldset className="fo-word-fieldset">
        <legend>{D.paper}</legend>
        <div className="fo-word-form fo-word-form--2">
          <Row label={T.cmd.orientation}>
            <Select value={st.orientation} label={T.cmd.orientation} options={[['portrait', T.cmd.portrait], ['landscape', T.cmd.landscape]]}
              onChange={(o) => o !== st.orientation && setSt({ ...st, orientation: o, pageWidth: st.pageHeight, pageHeight: st.pageWidth })} />
          </Row>
          <Row label={T.cmd.pageSize}>
            <Select value={size} label={T.cmd.pageSize} options={[...PAGE_SIZES.map((p): [string, string] => [p.id, T.sizes[p.id]]), ['custom', '—']]}
              onChange={(id) => {
                const p = PAGE_SIZES.find((x) => x.id === id);
                if (p) setSt({ ...st, pageWidth: st.orientation === 'landscape' ? p.h : p.w, pageHeight: st.orientation === 'landscape' ? p.w : p.h });
              }} />
          </Row>
          {num(D.widthCm, ptToCm(st.pageWidth), (v) => setSt({ ...st, pageWidth: cmToPt(v) }), 2, 55)}
          {num(D.heightCm, ptToCm(st.pageHeight), (v) => setSt({ ...st, pageHeight: cmToPt(v) }), 2, 55)}
        </div>
      </fieldset>
      <fieldset className="fo-word-fieldset">
        <legend>{T.cmd.columns}</legend>
        <div className="fo-word-form fo-word-form--2">
          <Row label={D.columnsCount}><NumberField value={st.columns.count} min={1} max={6} label={D.columnsCount} width={80} onChange={(count) => setSt({ ...st, columns: { ...st.columns, count, equalWidth: true, widths: undefined } })} /></Row>
          {num(D.columnsSpace, ptToCm(st.columns.space), (v) => setSt({ ...st, columns: { ...st.columns, space: cmToPt(v) } }))}
        </div>
        <Check label={D.columnsLine} checked={st.columns.separator} onChange={(separator) => setSt({ ...st, columns: { ...st.columns, separator } })} />
      </fieldset>
    </Dialog>
  );
}

export function StatsDialog({ c, onClose, env, pageCount }: Close & { env: Env; pageCount: number }) {
  const [notes, setNotes] = useState(false);
  const doc = fullDocument(env);
  const st = statistics(notes ? { ...doc, body: [...doc.body, ...doc.footnotes.flatMap((n) => n.blocks), ...doc.endnotes.flatMap((n) => n.blocks)] } : doc);
  const b = T.backstage;
  const rows: [string, number][] = [[b.pages, pageCount], [b.words, st.words], [b.characters, st.charactersNoSpaces], [b.charactersNoSpaces, st.charactersNoSpaces], [b.characters, st.characters], [b.paragraphs, st.paragraphs], [b.lines, st.lines]];
  return (
    <Dialog open title={D.statsTitle} onClose={onClose} width={400} actions={[{ label: D.close, primary: true, onClick: onClose }]}>
      <table className="fo-word-stats__table"><tbody>{rows.filter((_, i) => i !== 2).map(([l, v]) => <tr key={l}><th scope="row">{l}</th><td>{v.toLocaleString('fr-FR')}</td></tr>)}</tbody></table>
      <Check label={D.includeNotes} checked={notes} onChange={setNotes} />
      <Button appearance="subtle" icon="data_bar_vertical" onClick={() => { c.setUi({ pane: 'stats' }); onClose(); }}>{T.cmd.advancedStats}</Button>
    </Dialog>
  );
}

export function CaptionDialog({ c, onClose }: Close) {
  const labels = [D.figure, D.tableLabel, D.equationLabel] as const;
  const [label, setLabel] = useState<string>(c.sel.image ? D.figure : c.sel.inTable ? D.tableLabel : D.figure);
  const [text, setText] = useState('');
  const count = (): number => {
    let n = 0;
    c.state()?.doc.descendants((node) => {
      if (node.type.name === 'paragraph' && node.attrs.styleId === 'Caption' && node.textContent.startsWith(label)) n++;
      return node.type.name !== 'paragraph';
    });
    return n + 1;
  };
  const ok = (): void => {
    const n = count();
    const seq: Inline = { type: 'field', code: 'SEQ', instruction: ` SEQ ${label.replace(/\s/g, '_')} \\* ARABIC `, result: [{ type: 'text', text: String(n), props: {} }] };
    c.run((state, dispatch) => {
      const para = c.schema.nodes.paragraph!.create({ styleId: 'Caption' }, [c.schema.text(`${label} `), c.schema.nodes.atom!.create({ data: seq }), ...(text ? [c.schema.text(` : ${text}`)] : [])]);
      const $from = state.selection.$from;
      const at = $from.depth ? $from.after(1) : state.doc.content.size;
      if (dispatch) dispatch(state.tr.insert(at, para));
      return true;
    });
    c.act.applyStyle('Caption');
    onClose();
  };
  return (
    <Dialog open title={D.captionTitle} onClose={onClose} onConfirm={ok} width={420} actions={[{ label: D.ok, primary: true, onClick: ok }, { label: D.cancel, onClick: onClose }]}>
      <Row label={D.captionLabel}><Select value={label} label={D.captionLabel} options={labels.map((l): [string, string] => [l, l])} onChange={setLabel} /></Row>
      <TextField label={D.captionText} value={text} autoFocus onChange={(e) => setText(e.target.value)} />
    </Dialog>
  );
}

const SOURCES = 'ForgeOffice.Sources';
interface Source { author: string; title: string; year: string; publisher: string }

export function CitationDialog({ c, onClose }: Close) {
  const sources: Source[] = (() => {
    try {
      const raw: unknown = JSON.parse(c.meta.properties.custom[SOURCES] ?? '[]');
      return Array.isArray(raw) ? (raw as Source[]).filter((x) => typeof x?.author === 'string') : [];
    } catch {
      return []; // propriete abimee : on repart d'une liste vide
    }
  })();
  const [src, setSrc] = useState<Source>({ author: '', title: '', year: '', publisher: '' });
  const cite = (s: Source): void => {
    c.run((state, dispatch) => { if (dispatch) dispatch(state.tr.insertText(`(${s.author}${s.year ? `, ${s.year}` : ''})`)); return true; });
    onClose();
  };
  const add = (): void => {
    if (!src.author.trim()) return;
    c.updateMeta((m) => setCustomProp(m, SOURCES, JSON.stringify([...sources, src])));
    cite(src);
  };
  const bibliography = (): void => {
    const sorted = [...sources].sort((a, b) => a.author.localeCompare(b.author, 'fr'));
    c.run(insertBlocks(paragraphs(c.schema, [
      { text: T.cmd.bibliography, styleId: 'Heading1' },
      ...sorted.map((s) => ({ text: `${s.author}. ${s.year ? `(${s.year}). ` : ''}${s.title}${s.publisher ? `. ${s.publisher}` : ''}.`, props: { indentLeft: 36, indentFirstLine: -36 } })),
    ])));
    onClose();
  };
  const f = (k: keyof Source, label: string) => <TextField label={label} value={src[k]} onChange={(e) => setSrc({ ...src, [k]: e.target.value })} />;
  return (
    <Dialog open title={D.citationTitle} onClose={onClose} onConfirm={add} width={480}
      footerStart={sources.length ? <Button appearance="subtle" icon="library" onClick={bibliography}>{T.cmd.bibliography}</Button> : undefined}
      actions={[{ label: D.insert, primary: true, onClick: add, disabled: !src.author.trim() }, { label: D.cancel, onClick: onClose }]}>
      <div className="fo-word-form">{f('author', D.citationAuthor)}{f('title', D.citationTitleField)}{f('year', D.citationYear)}{f('publisher', D.citationPublisher)}</div>
      {sources.length > 0 && <ul className="fo-word-list">{sources.map((s, i) => <li key={i}><span>{s.author} — {s.title} ({s.year})</span><Button size="small" onClick={() => cite(s)}>{D.insert}</Button></li>)}</ul>}
    </Dialog>
  );
}

export function IndexDialog({ c, onClose, pageOfPos }: Close & { pageOfPos: (pos: number) => number }) {
  const [entry, setEntry] = useState(c.sel.text.slice(0, 80));
  const mark = (): void => {
    if (!entry.trim()) return;
    c.run(insertInline({ type: 'field', code: 'XE', instruction: ` XE "${entry.replace(/"/g, '')}" `, result: [] }));
    onClose();
  };
  const build = (): void => {
    const terms = new Map<string, Set<number>>();
    c.state()?.doc.descendants((n, pos) => {
      const d = n.attrs.data as Inline | undefined;
      if (n.type.name === 'atom' && d?.type === 'field' && d.code === 'XE') {
        const term = d.instruction.match(/XE\s+"([^"]*)"/)?.[1];
        if (term) terms.set(term, (terms.get(term) ?? new Set()).add(pageOfPos(pos)));
      }
      return true;
    });
    const items = [...terms.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr')).map(([t, pages]) => ({ text: `${t}, ${[...pages].sort((a, b) => a - b).join(', ')}` }));
    c.run(insertBlocks(paragraphs(c.schema, [{ text: D.indexHeading, styleId: 'Heading1' }, ...items])));
    onClose();
  };
  return (
    <Dialog open title={D.indexTitle} onClose={onClose} onConfirm={mark} width={440}
      footerStart={<Button appearance="subtle" icon="list" onClick={build}>{T.cmd.insertIndex}</Button>}
      actions={[{ label: T.cmd.markEntry, primary: true, onClick: mark, disabled: !entry.trim() }, { label: D.close, onClick: onClose }]}>
      <TextField label={D.indexEntry} value={entry} autoFocus onChange={(e) => setEntry(e.target.value)} />
    </Dialog>
  );
}

export function StyleDialog({ c, onClose }: Close) {
  const [name, setName] = useState<string>(D.styleNew);
  const ok = (): void => { c.act.createStyle(name); onClose(); };
  return (
    <Dialog open title={T.cmd.createStyle} onClose={onClose} onConfirm={ok} width={400} description={D.styleBasedOn} actions={[{ label: D.ok, primary: true, onClick: ok, disabled: !name.trim() }, { label: D.cancel, onClick: onClose }]}>
      <TextField label={D.styleName} value={name} autoFocus maxLength={60} onChange={(e) => setName(e.target.value)} />
    </Dialog>
  );
}

export function GotoDialog({ c, onClose, pageCount }: Close & { pageCount: number }) {
  const [page, setPage] = useState(1);
  const ok = (): void => {
    if (page < 1 || page > pageCount) return c.notify(D.goToBad, 'warning');
    c.act.gotoPage(page);
    onClose();
  };
  return (
    <Dialog open title={D.goToTitle} onClose={onClose} onConfirm={ok} width={340} actions={[{ label: D.goTo, primary: true, onClick: ok }, { label: D.close, onClick: onClose }]}>
      <Row label={D.goToPage}><NumberField value={page} min={1} max={Math.max(1, pageCount)} label={D.goToPage} width={90} onChange={setPage} /></Row>
    </Dialog>
  );
}

export function PasteSpecialDialog({ c, onClose }: Close) {
  const [mode, setMode] = useState<'keep' | 'text'>('keep');
  const ok = (): void => { void c.act.paste(mode); onClose(); };
  return (
    <Dialog open title={D.pasteSpecialTitle} onClose={onClose} onConfirm={ok} width={400} actions={[{ label: D.ok, primary: true, onClick: ok }, { label: D.cancel, onClick: onClose }]}>
      <div className="fo-word-nav__title">{D.pasteAs}</div>
      <ul className="fo-word-list fo-word-list--select" role="listbox" aria-label={D.pasteAs}>
        {([['keep', D.pasteFormatted], ['text', D.pastePlain]] as const).map(([k, l]) => <li key={k} role="option" aria-selected={mode === k} className={mode === k ? 'is-active' : ''} onClick={() => setMode(k)} onDoubleClick={ok}>{l}</li>)}
      </ul>
    </Dialog>
  );
}

export function AltDialog({ c, onClose }: Close) {
  const img = c.sel.image;
  const [alt, setAlt] = useState(img?.data.alt ?? '');
  const ok = (): void => {
    if (img) c.run(updateAtom(img.pos, { ...img.data, alt }));
    onClose();
  };
  return (
    <Dialog open title={T.cmd.altText} onClose={onClose} onConfirm={ok} width={440} actions={[{ label: D.ok, primary: true, onClick: ok }, { label: D.cancel, onClick: onClose }]}>
      <label className="fo-word-label" htmlFor="fo-alt">{D.imageAlt}</label>
      <textarea id="fo-alt" className="fo-word-textarea" rows={4} autoFocus value={alt} onChange={(e) => setAlt(e.target.value)} />
    </Dialog>
  );
}

export function PageBorderDialog({ c, onClose }: Close) {
  const cur = c.section.pageBorders?.top;
  const [style, setStyle] = useState<BorderStyle>(cur?.style ?? 'single');
  const [width, setWidth] = useState(cur?.width ?? 1);
  const [color, setColor] = useState(cur && cur.color !== 'auto' ? `#${cur.color}` : '#000000');
  const ok = (): void => {
    const b: Border = { style, width, color: color.slice(1).toUpperCase(), space: 24 };
    c.act.setSection({ pageBorders: style === 'none' ? undefined : { top: b, bottom: b, left: b, right: b, offsetFrom: 'page' } });
    onClose();
  };
  return (
    <Dialog open title={D.borderTitle} onClose={onClose} onConfirm={ok} width={440} actions={[{ label: D.ok, primary: true, onClick: ok }, { label: D.cancel, onClick: onClose }]}>
      <div className="fo-word-form fo-word-form--2">
        <Row label={D.borderStyle}><Select value={style} label={D.borderStyle} options={[['none', D.none], ['single', '———'], ['double', '═══'], ['dotted', '·····'], ['dashed', '- - -'], ['thick', '▬▬▬']]} onChange={setStyle} /></Row>
        <Row label={D.borderWidth}><NumberField value={width} min={0.25} max={6} step={0.25} label={D.borderWidth} width={80} onChange={setWidth} /></Row>
      </div>
      <fieldset className="fo-word-fieldset"><legend>{D.borderColor}</legend><ColorPalette value={color} onPick={(v) => setColor(v ?? '#000000')} /></fieldset>
    </Dialog>
  );
}

export function SortDialog({ c, onClose }: Close) {
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const ok = (): void => {
    const cmp = (a: string, b: string): number => (dir === 'asc' ? 1 : -1) * a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
    c.run((state, dispatch) => {
      const $from = state.selection.$from;
      for (let d = $from.depth; d > 0; d--) {
        const table = $from.node(d);
        if (table.type.name !== 'table') continue;
        const rows: PMNode[] = [];
        table.forEach((r) => rows.push(r));
        const head = rows[0]?.attrs.props?.header ? rows.splice(0, 1) : [];
        rows.sort((a, b) => cmp(a.firstChild?.textContent ?? '', b.firstChild?.textContent ?? ''));
        if (dispatch) dispatch(state.tr.replaceWith($from.before(d) + 1, $from.after(d) - 1, Fragment.from([...head, ...rows])));
        return true;
      }
      const paras = selectedParagraphs(state);
      if (paras.length < 2) return false;
      const first = paras[0]!;
      const last = paras[paras.length - 1]!;
      const sorted = paras.map((p) => p.node).sort((a, b) => cmp(a.textContent, b.textContent));
      if (dispatch) dispatch(state.tr.replaceWith(first.pos, last.pos + last.node.nodeSize, Fragment.from(sorted)));
      return true;
    });
    onClose();
  };
  return (
    <Dialog open title={D.sortTitle} onClose={onClose} onConfirm={ok} width={360} actions={[{ label: D.ok, primary: true, onClick: ok }, { label: D.cancel, onClick: onClose }]}>
      <Select value={dir} label={D.sortTitle} options={[['asc', D.ascending], ['desc', D.descending]]} onChange={setDir} />
    </Dialog>
  );
}

/** Bloc de dessin a main levee : le dessin est insere comme image PNG au curseur. */
export function InkDialog({ c, onClose, env }: Close & { env: Env }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pen, setPen] = useState(c.ui.pen);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);
  // Trace au doigt, au stylet ou a la souris : le point de depart compte deja comme un dessin (le bouton Inserer s'active des le contact).
  const down = (e: RPointerEvent<HTMLCanvasElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const sx = el.width / Math.max(1, r.width);
    const sy = el.height / Math.max(1, r.height);
    const at = (ev: PointerEvent | RPointerEvent<HTMLCanvasElement>): [number, number] => [(ev.clientX - r.left) * sx, (ev.clientY - r.top) * sy];
    const widthFor = (ev: PointerEvent | RPointerEvent<HTMLCanvasElement>): number => pen.width * (ev.pointerType === 'pen' && ev.pressure > 0 ? Math.max(0.3, ev.pressure * 2) : 1);
    ctx.strokeStyle = pen.color;
    ctx.fillStyle = pen.color;
    ctx.globalAlpha = pen.highlighter ? 0.4 : 1;
    const [x0, y0] = at(e);
    ctx.lineWidth = widthFor(e);
    ctx.beginPath();
    ctx.arc(x0, y0, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    setDrawn(true);
    const move = (ev: PointerEvent): void => {
      for (const p of ev.getCoalescedEvents?.().length ? ev.getCoalescedEvents() : [ev]) {
        const [x, y] = at(p);
        ctx.lineWidth = widthFor(p);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    };
    const up = (): void => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const clear = (): void => {
    const el = canvas.current;
    el?.getContext('2d')?.clearRect(0, 0, el.width, el.height);
    setDrawn(false);
  };
  const insert = (): void => {
    const el = canvas.current;
    if (!el || !drawn) return onClose();
    el.toBlob((blob) => {
      if (!blob) return;
      void blob.arrayBuffer().then((buf) => {
        const id = `fo-ink-${Date.now().toString(36)}`;
        env.extraMedia[id] = { id, fileName: `${id}.png`, contentType: 'image/png', bytes: new Uint8Array(buf) };
        c.run(insertInline({ type: 'image', mediaId: id, width: el.width * 0.75, height: el.height * 0.75, alt: T.cmd.drawMode, name: id }));
        onClose();
      });
    }, 'image/png');
  };
  const pens = [['#000000', 2, false], ['#C00000', 2, false], ['#185ABD', 2, false], ['#107C41', 3, false], ['#FFE600', 14, true]] as const;
  return (
    <Dialog open title={T.cmd.drawMode} onClose={onClose} width={680}
      footerStart={<Button appearance="subtle" icon="eraser" onClick={clear}>{T.cmd.clearInk}</Button>}
      actions={[{ label: D.insert, primary: true, onClick: insert, disabled: !drawn }, { label: D.cancel, onClick: onClose }]}>
      <div className="fo-word-pens" role="toolbar" aria-label={T.groups.pens}>
        {pens.map(([color, width, hl]) => (
          <button key={color} type="button" className={pen.color === color ? 'is-active' : ''} aria-label={hl ? T.cmd.highlighter : T.cmd.pen}
            style={{ background: color }} onClick={() => setPen({ color, width, highlighter: hl })} />
        ))}
      </div>
      <canvas ref={canvas} width={620} height={300} className="fo-word-ink" onPointerDown={down} />
    </Dialog>
  );
}

export function SpellingDialog({ c, onClose }: Close) {
  return (
    <Dialog open title={D.spellingTitle} onClose={onClose} width={440} actions={[{ label: D.close, primary: true, onClick: onClose }]}>
      <p>{D.spellingText}</p>
      <Check label={c.ui.spell ? D.spellOn : D.spellOff} checked={c.ui.spell} onChange={(spell) => c.setUi({ spell })} />
    </Dialog>
  );
}

