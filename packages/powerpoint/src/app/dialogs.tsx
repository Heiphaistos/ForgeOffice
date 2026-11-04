// Boites de dialogue : taille des diapositives, en-tete et pied, lien, tableau, donnees du graphique, icones,
// arriere-plan, commentaire, rechercher / remplacer, renommer, rogner.
import { useMemo, useState } from 'react';
import { Button, Checkbox, ColorPalette, Dialog, Icon, NumberField, TextField, type IconName } from '@forgeoffice/ui';
import { replaceText, SIZE_NAMES, SLIDE_SIZES, chartSeries, clampSlideDimension, type Fill, type SlideSizePreset } from '@forgeoffice/pptx';
import { findInBody, type TextRange } from '../canvas/text.ts';
import { applyHeaderFooter, editMasters, editSlides, renameSection, resizeDeck, type HeaderFooter } from './deck-ops.ts';
import type { DialogId, Editor } from './editor.ts';
import { colorFromHex } from './format.ts';
import { insertIcon, insertTable, setLink } from './insert.ts';
import { themeSwatches } from './themes.ts';
import { S } from '../strings.ts';
import './dialogs.css';

/** Icones proposees par Insertion > Icones (bibliotheque Fluent incluse). */
const ICON_LIBRARY: ReadonlyArray<{ category: string; icons: readonly IconName[] }> = [
  { category: S.icons.business, icons: ['people', 'person', 'person_add', 'briefcase', 'handshake', 'trophy', 'target', 'flag', 'money', 'building', 'calendar_ltr', 'clock', 'mail', 'send', 'share', 'chart_multiple', 'data_trending', 'data_pie', 'calculator', 'currency_dollar_euro', 'document', 'folder', 'task_list_ltr', 'checkbox_checked', 'key', 'lock_closed', 'shield_lock', 'signature'] },
  { category: S.icons.communication, icons: ['megaphone', 'chat', 'comment', 'comment_multiple', 'phone', 'mic', 'video', 'speaker_2', 'globe', 'link', 'cloud', 'alert', 'note'] },
  { category: S.icons.symbols, icons: ['heart', 'rocket', 'leaf_two', 'gift', 'star', 'sparkle', 'lightbulb', 'checkmark', 'dismiss', 'add', 'subtract', 'info', 'warning', 'question_circle', 'error_circle', 'pin', 'bookmark', 'eye', 'circle', 'square', 'arrow_right', 'arrow_up', 'arrow_down', 'arrow_left', 'arrow_sync', 'arrow_clockwise'] },
  { category: S.icons.technology, icons: ['airplane', 'vehicle_car', 'food', 'camera', 'location', 'map', 'shopping_bag', 'music_note_2', 'puzzle_piece', 'hat_graduation', 'desktop', 'tablet', 'phone', 'database', 'cube', 'brain_circuit', 'settings', 'keyboard', 'print', 'save', 'search', 'home', 'apps', 'grid', 'design_ideas', 'image', 'pen', 'paint_brush', 'weather_sunny', 'weather_moon', 'library', 'book_open'] },
];

function SizeDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [w, setW] = useState(Math.round((ed.deck.size.width / 72) * 2.54 * 100) / 100);
  const [h, setH] = useState(Math.round((ed.deck.size.height / 72) * 2.54 * 100) / 100);
  const [mode, setMode] = useState<'fit' | 'max'>('fit');
  const presets = Object.keys(SIZE_NAMES) as SlideSizePreset[];
  const apply = (): void => {
    const size = { width: clampSlideDimension((w / 2.54) * 72), height: clampSlideDimension((h / 2.54) * 72), type: 'custom' };
    ed.commit(resizeDeck(ed.deck, size, mode));
    onClose();
  };
  return (
    <Dialog open title={S.dialogs.slideSize} onClose={onClose} onConfirm={apply} width={460} actions={[{ label: S.common.ok, primary: true, onClick: apply }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-form">
        <label>{S.dialogs.sizeFor}</label>
        <select
          onChange={(e) => {
            const p = SLIDE_SIZES[e.target.value as SlideSizePreset];
            if (!p) return;
            setW(Math.round((p.width / 72) * 254) / 100);
            setH(Math.round((p.height / 72) * 254) / 100);
          }}
          defaultValue=""
        >
          <option value="" disabled>
            {S.dialogs.choosePreset}
          </option>
          {presets.map((p) => (
            <option key={p} value={p}>
              {SIZE_NAMES[p]}
            </option>
          ))}
        </select>
        <label>{S.context.width}</label>
        <NumberField value={w} min={2.54} max={142.24} step={0.1} unit="cm" width={110} onChange={setW} label={S.context.width} />
        <label>{S.context.height}</label>
        <NumberField value={h} min={2.54} max={142.24} step={0.1} unit="cm" width={110} onChange={setH} label={S.context.height} />
        <label>{S.dialogs.orientation}</label>
        <div className="pp-form__row">
          <Button icon="document_one_page" onClick={() => w > h && (setW(h), setH(w))}>{S.dialogs.portrait}</Button>
          <Button icon="document_landscape" onClick={() => h > w && (setW(h), setH(w))}>{S.dialogs.landscape}</Button>
        </div>
        <label>{S.dialogs.scaleContent}</label>
        <div className="pp-form__row">
          <label className="pp-radio"><input type="radio" checked={mode === 'max'} onChange={() => setMode('max')} /> {S.dialogs.maximize}</label>
          <label className="pp-radio"><input type="radio" checked={mode === 'fit'} onChange={() => setMode('fit')} /> {S.dialogs.ensureFit}</label>
        </div>
      </div>
    </Dialog>
  );
}

function HeaderFooterDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const has = (type: string): boolean => ed.deck.slides.some((s) => s.shapes.some((x) => x.placeholder?.type === type));
  const [hf, setHf] = useState<HeaderFooter>({ date: has('dt'), slideNumber: has('sldNum'), footer: has('ftr'), footerText: '', notOnTitle: true });
  const [fixed, setFixed] = useState(false);
  const [fixedText, setFixedText] = useState(new Date().toLocaleDateString('fr-FR'));
  const value = (): HeaderFooter => ({ ...hf, fixedDate: fixed ? fixedText : undefined });
  return (
    <Dialog
      open
      title={S.headerFooter.title}
      onClose={onClose}
      width={480}
      actions={[
        { label: S.headerFooter.apply, onClick: () => { if (ed.slide) ed.commit(applyHeaderFooter(ed.deck, value(), ed.slide.id)); onClose(); } },
        { label: S.headerFooter.applyAll, primary: true, onClick: () => { ed.commit(applyHeaderFooter(ed.deck, value())); onClose(); } },
        { label: S.common.cancel, onClick: onClose },
      ]}
    >
      <div className="pp-stack">
        <strong>{S.headerFooter.include}</strong>
        <Checkbox checked={hf.date} label={S.headerFooter.date} onChange={(date) => setHf({ ...hf, date })} />
        {hf.date && (
          <div className="pp-stack pp-indent">
            <label className="pp-radio"><input type="radio" checked={!fixed} onChange={() => setFixed(false)} /> {S.headerFooter.auto}</label>
            <label className="pp-radio"><input type="radio" checked={fixed} onChange={() => setFixed(true)} /> {S.headerFooter.fixed}</label>
            {fixed && <TextField value={fixedText} onChange={(e) => setFixedText(e.target.value)} aria-label={S.headerFooter.fixed} />}
          </div>
        )}
        <Checkbox checked={hf.slideNumber} label={S.headerFooter.number} onChange={(slideNumber) => setHf({ ...hf, slideNumber })} />
        <Checkbox checked={hf.footer} label={S.headerFooter.footer} onChange={(footer) => setHf({ ...hf, footer })} />
        {hf.footer && <TextField value={hf.footerText} onChange={(e) => setHf({ ...hf, footerText: e.target.value })} aria-label={S.headerFooter.footer} />}
        <Checkbox checked={hf.notOnTitle} label={S.headerFooter.notOnTitle} onChange={(notOnTitle) => setHf({ ...hf, notOnTitle })} />
      </div>
    </Dialog>
  );
}

function LinkDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [kind, setKind] = useState<'url' | 'slide'>('url');
  const [url, setUrl] = useState('https://');
  const [slideId, setSlideId] = useState(ed.deck.slides[0]?.id ?? 0);
  const ok = (): void => {
    setLink(ed, kind === 'url' ? { url: url.trim() } : { slideId });
    onClose();
  };
  return (
    <Dialog open title={S.dialogs.link} onClose={onClose} onConfirm={ok} width={520} actions={[{ label: S.dialogs.removeLink, onClick: () => { setLink(ed, null); onClose(); } }, { label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-stack">
        <div className="pp-form__row">
          <label className="pp-radio"><input type="radio" checked={kind === 'url'} onChange={() => setKind('url')} /> {S.dialogs.linkWeb}</label>
          <label className="pp-radio"><input type="radio" checked={kind === 'slide'} onChange={() => setKind('slide')} /> {S.dialogs.linkSlide}</label>
        </div>
        {kind === 'url' ? (
          <TextField label={S.dialogs.address} value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
        ) : (
          <select size={8} value={slideId} onChange={(e) => setSlideId(Number(e.target.value))} className="pp-list">
            {ed.deck.slides.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.shapes.find((x) => x.placeholder?.type === 'title' || x.placeholder?.type === 'ctrTitle') ? S.dialogs.slideTitle(i + 1, titleOf(s)) : S.dialogs.slideN(i + 1)}
              </option>
            ))}
          </select>
        )}
      </div>
    </Dialog>
  );
}

function titleOf(s: { shapes: import('@forgeoffice/pptx').Shape[] }): string {
  const t = s.shapes.find((x) => x.placeholder?.type === 'title' || x.placeholder?.type === 'ctrTitle');
  return t?.kind === 'shape' ? (t.text?.paragraphs.map((p) => p.runs.map((r) => (r.type === 'break' ? ' ' : r.text)).join('')).join(' ') ?? '') : '';
}

function TableDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(5);
  const ok = (): void => {
    insertTable(ed, rows, cols);
    onClose();
  };
  return (
    <Dialog open title={S.dialogs.insertTable} onClose={onClose} onConfirm={ok} width={320} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-form">
        <label>{S.dialogs.columns}</label>
        <NumberField value={cols} min={1} max={75} onChange={setCols} label={S.dialogs.columns} />
        <label>{S.dialogs.rows}</label>
        <NumberField value={rows} min={1} max={75} onChange={setRows} label={S.dialogs.rows} />
      </div>
    </Dialog>
  );
}

/** Feuille de donnees du graphique (categories x series). */
function ChartDataDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const shape = ed.selectedShapes.find((s) => s.kind === 'chart');
  const chart = shape?.kind === 'chart' ? shape.chart : undefined;
  const initial = useMemo(() => {
    const series = chart ? chartSeries(chart) : [];
    const cats = series[0]?.categories.labels ?? [];
    return { names: series.map((s) => s.name), cats: [...cats], values: series.map((s) => cats.map((_, i) => s.values.values[i] ?? null)) };
  }, [chart]);
  const [data, setData] = useState(initial);
  if (!chart || !shape) return null;
  const parse = (v: string): number | null => {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    return v.trim() === '' || !Number.isFinite(n) ? null : n;
  };
  const ok = (): void => {
    ed.editSelected((s) => {
      if (s.kind !== 'chart') return;
      const plot = s.chart.plots[0];
      if (!plot) return;
      const template = plot.series[0];
      plot.series = data.names.map((name, i) => ({
        ...(plot.series[i] ?? template ?? { categories: { labels: [] }, values: { values: [] } }),
        name,
        categories: { labels: [...data.cats] },
        values: { values: data.values[i] ?? [] },
      }));
      delete s.source;
    }, 'chartData');
    onClose();
  };
  const set = (r: number, c: number, v: string): void => setData((d) => ({ ...d, values: d.values.map((row, i) => (i === c ? row.map((x, j) => (j === r ? parse(v) : x)) : row)) }));
  return (
    <Dialog open title={S.dialogs.chartData} onClose={onClose} onConfirm={ok} width={640} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-sheet">
        <table>
          <thead>
            <tr>
              <th />
              {data.names.map((n, c) => (
                <th key={c}>
                  <input value={n} aria-label={S.dialogs.seriesName} onChange={(e) => setData((d) => ({ ...d, names: d.names.map((x, i) => (i === c ? e.target.value : x)) }))} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.cats.map((cat, r) => (
              <tr key={r}>
                <th>
                  <input value={cat} aria-label={S.dialogs.category} onChange={(e) => setData((d) => ({ ...d, cats: d.cats.map((x, i) => (i === r ? e.target.value : x)) }))} />
                </th>
                {data.names.map((_, c) => (
                  <td key={c}>
                    <input defaultValue={data.values[c]?.[r] === null || data.values[c]?.[r] === undefined ? '' : String(data.values[c]?.[r]).replace('.', ',')} onChange={(e) => set(r, c, e.target.value)} aria-label={`${data.names[c]} ${cat}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pp-form__row">
          <Button icon="add" onClick={() => setData((d) => ({ ...d, cats: [...d.cats, S.dialogs.newCategory(d.cats.length + 1)], values: d.values.map((row) => [...row, null]) }))}>{S.dialogs.addCategory}</Button>
          <Button icon="add" onClick={() => setData((d) => ({ ...d, names: [...d.names, S.dialogs.newSeries(d.names.length + 1)], values: [...d.values, d.cats.map(() => null)] }))}>{S.dialogs.addSeries}</Button>
          <Button icon="subtract" disabled={data.cats.length < 2} onClick={() => setData((d) => ({ ...d, cats: d.cats.slice(0, -1), values: d.values.map((row) => row.slice(0, -1)) }))}>{S.dialogs.removeCategory}</Button>
          <Button icon="subtract" disabled={data.names.length < 2} onClick={() => setData((d) => ({ ...d, names: d.names.slice(0, -1), values: d.values.slice(0, -1) }))}>{S.dialogs.removeSeries}</Button>
        </div>
      </div>
    </Dialog>
  );
}

function IconsDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<IconName[]>([]);
  const q = query.trim().toLowerCase().replace(/\s+/g, '_');
  const ok = async (): Promise<void> => {
    onClose();
    for (const name of picked) await insertIcon(ed, name);
  };
  return (
    <Dialog open title={S.insert.icons} onClose={onClose} width={640} actions={[{ label: S.dialogs.insertN(picked.length), primary: true, disabled: !picked.length, onClick: () => void ok() }, { label: S.common.cancel, onClick: onClose }]}>
      <TextField icon="search" placeholder={S.dialogs.searchIcons} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <div className="pp-icons">
        {ICON_LIBRARY.map((cat) => {
          const icons = cat.icons.filter((n) => !q || n.includes(q) || cat.category.toLowerCase().includes(query.toLowerCase()));
          if (!icons.length) return null;
          return (
            <div key={cat.category}>
              <div className="pp-icons__title">{cat.category}</div>
              <div className="pp-icons__grid">
                {icons.map((name) => (
                  <button key={name} type="button" className={picked.includes(name) ? 'is-picked' : ''} title={name.replace(/_/g, ' ')} onClick={() => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]))}>
                    <Icon name={name} size={32} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}

function BackgroundDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [kind, setKind] = useState<'solid' | 'gradient' | 'picture'>('solid');
  const [color, setColor] = useState<string | null>('#FFFFFF');
  const [color2, setColor2] = useState<string | null>('#BDD7EE');
  const [angle, setAngle] = useState(90);
  const swatches = themeSwatches(ed.ctx.theme.colors);
  const fill = (): Fill =>
    kind === 'gradient'
      ? { type: 'gradient', kind: 'linear', angle, stops: [{ position: 0, color: colorFromHex(ed, color ?? '#FFFFFF') }, { position: 100, color: colorFromHex(ed, color2 ?? '#FFFFFF') }] }
      : { type: 'solid', color: colorFromHex(ed, color ?? '#FFFFFF') };
  const applyTo = async (all: boolean): Promise<void> => {
    let f = fill();
    let deck = ed.deck;
    if (kind === 'picture') {
      const file = await ed.services.openFile([{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }]);
      if (!file) return;
      const { addMedia } = await import('@forgeoffice/pptx');
      deck = { ...deck, media: { ...deck.media } };
      const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
      f = { type: 'image', mediaId: addMedia(deck, file.bytes, ext === 'jpg' ? 'jpeg' : ext), mode: 'stretch' };
    }
    if (ed.ui.view === 'master' && ed.ui.masterPage) {
      const ref = ed.ui.masterPage;
      ed.commit(editMasters(deck, (masters) => {
        const m = masters[ref.masterIndex];
        if (!m) return;
        if (ref.kind === 'master') m.background = { type: 'fill', fill: f };
        else {
          const l = m.layouts.find((x) => x.id === ref.layoutId);
          if (l) l.background = { type: 'fill', fill: f };
        }
      }));
    } else {
      const ids = all ? new Set(deck.slides.map((s) => s.id)) : new Set(ed.selectedSlides.length ? ed.selectedSlides : ed.slide ? [ed.slide.id] : []);
      ed.commit(editSlides(deck, ids, (s) => { s.background = { type: 'fill', fill: f }; }));
    }
    onClose();
  };
  const reset = (): void => {
    ed.commit(editSlides(ed.deck, new Set(ed.deck.slides.map((s) => s.id)), (s) => { delete s.background; }));
    onClose();
  };
  return (
    <Dialog open title={S.design.formatBackground} onClose={onClose} width={420} actions={[{ label: S.dialogs.resetBackground, onClick: reset }, { label: S.dialogs.applyAll, onClick: () => void applyTo(true) }, { label: S.common.ok, primary: true, onClick: () => void applyTo(false) }]}>
      <div className="pp-stack">
        <label className="pp-radio"><input type="radio" checked={kind === 'solid'} onChange={() => setKind('solid')} /> {S.dialogs.solidFill}</label>
        <label className="pp-radio"><input type="radio" checked={kind === 'gradient'} onChange={() => setKind('gradient')} /> {S.dialogs.gradientFill}</label>
        <label className="pp-radio"><input type="radio" checked={kind === 'picture'} onChange={() => setKind('picture')} /> {S.dialogs.pictureFill}</label>
        {kind !== 'picture' && <ColorPalette value={color} onPick={setColor} emptyMode="none" themeColors={swatches} />}
        {kind === 'gradient' && (
          <>
            <ColorPalette value={color2} onPick={setColor2} emptyMode="none" themeColors={swatches} />
            <div className="pp-form"><label>{S.dialogs.angle}</label><NumberField value={angle} min={0} max={359} step={15} unit="°" onChange={setAngle} label={S.dialogs.angle} /></div>
          </>
        )}
      </div>
    </Dialog>
  );
}

function CommentDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const [text, setText] = useState('');
  const author = ed.services.settings.get('powerpoint.author', S.review.defaultAuthor);
  const ok = (): void => {
    if (text.trim() && ed.slide) {
      const sel = ed.selectedShapes[0];
      const pos = sel ? ed.ctx.resolve(sel).xfrm : undefined;
      ed.commit(editSlides(ed.deck, new Set([ed.slide.id]), (s) => {
        s.comments.push({ author, initials: author.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 3).toUpperCase(), date: new Date().toISOString(), text: text.trim(), position: pos ? { x: pos.x + pos.width, y: pos.y } : { x: 10, y: 10 } });
      }));
      ed.setUi({ pane: 'comments' });
    }
    onClose();
  };
  return (
    <Dialog open title={S.review.newComment} onClose={onClose} width={420} actions={[{ label: S.review.post, primary: true, disabled: !text.trim(), onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <textarea className="pp-textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={S.review.commentPlaceholder} aria-label={S.review.newComment} />
    </Dialog>
  );
}

function FindDialog({ ed, onClose, replace }: { ed: Editor; onClose: () => void; replace: boolean }) {
  const [query, setQuery] = useState('');
  const [by, setBy] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [cursor, setCursor] = useState(0);
  const hits = useMemo(() => {
    if (!query) return [];
    const out: Array<{ slideId: number; shapeId: number; range: TextRange }> = [];
    for (const slide of ed.deck.slides) {
      for (const shape of slide.shapes) {
        if (shape.kind === 'shape' && shape.text) for (const range of findInBody(shape.text, query, matchCase)) out.push({ slideId: slide.id, shapeId: shape.id, range });
      }
    }
    return out;
  }, [ed.deck, query, matchCase]);
  const next = (): void => {
    if (!hits.length) {
      ed.notify(S.dialogs.notFound(query), 'info');
      return;
    }
    const hit = hits[cursor % hits.length];
    if (!hit) return;
    setCursor((c) => c + 1);
    ed.goto(hit.slideId);
    window.setTimeout(() => ed.setSelection({ ids: [hit.shapeId], text: { shapeId: hit.shapeId, range: hit.range } }), 0);
  };
  const replaceAll = (): void => {
    const deck = structuredClone({ ...ed.deck, media: {} });
    const count = replaceText(deck, query, by, matchCase);
    ed.commit({ ...ed.deck, slides: deck.slides });
    ed.notify(S.dialogs.replaced(count), 'success');
  };
  return (
    <Dialog
      open
      title={replace ? S.home.replace : S.home.find}
      onClose={onClose}
      width={460}
      actions={[
        { label: S.dialogs.findNext, primary: true, onClick: next },
        ...(replace ? [{ label: S.dialogs.replaceAll, onClick: replaceAll }] : []),
        { label: S.common.close, onClick: onClose },
      ]}
    >
      <div className="pp-stack">
        <TextField label={S.dialogs.findWhat} value={query} onChange={(e) => { setQuery(e.target.value); setCursor(0); }} autoFocus />
        {replace && <TextField label={S.dialogs.replaceWith} value={by} onChange={(e) => setBy(e.target.value)} />}
        <Checkbox checked={matchCase} label={S.dialogs.matchCase} onChange={setMatchCase} />
        <span className="pp-muted">{S.dialogs.matches(hits.length)}</span>
      </div>
    </Dialog>
  );
}

function RenameDialog({ ed, onClose, target }: { ed: Editor; onClose: () => void; target: { kind: 'section'; id: string; name: string } | { kind: 'layout'; name: string } }) {
  const [name, setName] = useState(target.name);
  const ok = (): void => {
    const value = name.trim();
    if (value) {
      if (target.kind === 'section') ed.commit(renameSection(ed.deck, target.id, value));
      else if (ed.ui.masterPage?.kind === 'layout') {
        const ref = ed.ui.masterPage;
        ed.commit(editMasters(ed.deck, (masters) => {
          const l = masters[ref.masterIndex]?.layouts.find((x) => x.id === ref.layoutId);
          if (l) l.name = value;
        }));
      }
    }
    onClose();
  };
  return (
    <Dialog open title={target.kind === 'section' ? S.sections.renameTitle : S.master.rename} onClose={onClose} onConfirm={ok} width={380} actions={[{ label: S.common.rename, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <TextField label={S.sections.nameLabel} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
    </Dialog>
  );
}

function CropDialog({ ed, onClose }: { ed: Editor; onClose: () => void }) {
  const pic = ed.selectedShapes.find((s) => s.kind === 'picture');
  const [crop, setCrop] = useState(pic?.kind === 'picture' ? (pic.crop ?? { left: 0, top: 0, right: 0, bottom: 0 }) : { left: 0, top: 0, right: 0, bottom: 0 });
  if (pic?.kind !== 'picture') return null;
  const ok = (): void => {
    ed.editSelected((s) => {
      if (s.kind !== 'picture' || !s.xfrm) return;
      const old = s.crop ?? { left: 0, top: 0, right: 0, bottom: 0 };
      const fullW = s.xfrm.width / Math.max(0.01, 1 - (old.left + old.right) / 100);
      const fullH = s.xfrm.height / Math.max(0.01, 1 - (old.top + old.bottom) / 100);
      s.xfrm = { ...s.xfrm, x: s.xfrm.x + ((crop.left - old.left) / 100) * fullW, y: s.xfrm.y + ((crop.top - old.top) / 100) * fullH, width: fullW * (1 - (crop.left + crop.right) / 100), height: fullH * (1 - (crop.top + crop.bottom) / 100) };
      s.crop = crop;
    }, 'crop');
    onClose();
  };
  const field = (key: 'left' | 'top' | 'right' | 'bottom') => (
    <>
      <label>{S.dialogs.cropSides[key]}</label>
      <NumberField value={crop[key]} min={0} max={95} step={1} unit="%" onChange={(v) => setCrop({ ...crop, [key]: v })} label={S.dialogs.cropSides[key]} />
    </>
  );
  return (
    <Dialog open title={S.context.crop} onClose={onClose} onConfirm={ok} width={360} actions={[{ label: S.common.ok, primary: true, onClick: ok }, { label: S.common.cancel, onClick: onClose }]}>
      <div className="pp-form">
        {field('left')}
        {field('top')}
        {field('right')}
        {field('bottom')}
      </div>
    </Dialog>
  );
}

export interface DialogsProps {
  ed: Editor;
  dialog: DialogId;
  onClose: () => void;
  section: { id: string; name: string } | null;
}

export function Dialogs({ ed, dialog, onClose, section }: DialogsProps) {
  switch (dialog) {
    case 'slideSize':
      return <SizeDialog ed={ed} onClose={onClose} />;
    case 'headerFooter':
      return <HeaderFooterDialog ed={ed} onClose={onClose} />;
    case 'link':
      return <LinkDialog ed={ed} onClose={onClose} />;
    case 'table':
      return <TableDialog ed={ed} onClose={onClose} />;
    case 'chartData':
      return <ChartDataDialog ed={ed} onClose={onClose} />;
    case 'icons':
      return <IconsDialog ed={ed} onClose={onClose} />;
    case 'background':
      return <BackgroundDialog ed={ed} onClose={onClose} />;
    case 'comment':
      return <CommentDialog ed={ed} onClose={onClose} />;
    case 'find':
    case 'replace':
      return <FindDialog ed={ed} onClose={onClose} replace={dialog === 'replace'} />;
    case 'sectionName': {
      const layout = ed.ui.masterPage?.kind === 'layout' ? ed.deck.masters[ed.ui.masterPage.masterIndex]?.layouts.find((l) => l.id === (ed.ui.masterPage as { layoutId: string }).layoutId) : undefined;
      if (section) return <RenameDialog ed={ed} onClose={onClose} target={{ kind: 'section', ...section }} />;
      return layout ? <RenameDialog ed={ed} onClose={onClose} target={{ kind: 'layout', name: layout.name }} /> : null;
    }
    case 'crop':
      return <CropDialog ed={ed} onClose={onClose} />;
    default:
      return null;
  }
}

