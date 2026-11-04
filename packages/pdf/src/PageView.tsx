// Une page du lecteur : rendu pdf.js (canevas net en haute densite), calque de texte selectionnable,
// elements en attente (annotations, champs, corrections, caviardage) editables, champs du formulaire a remplir.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { FieldInfo } from './apply.ts';
import {
  STAMP_COLORS, newId, rectFrom, snapToText, textUnder, uniqueFieldName, type FieldKind, type Item, type MarkKind, type Point, type Rect,
  type StampKind, type TextBox, type Tool,
} from './model.ts';
import type { PDFDocumentProxy, PDFPageProxy } from './pdfdoc.ts';
import { S } from './strings.ts';

export interface ToolOptions {
  color: string;
  markColor: string;
  width: number;
  fontSize: number;
  stamp: StampKind;
  field: FieldKind;
  signature: { png: Uint8Array; ratio: number } | null;
  author: string;
}

export interface PageViewProps {
  pdf: PDFDocumentProxy;
  index: number;
  /** Pixels CSS par point PDF. */
  scale: number;
  viewRotation: number;
  fallbackSize: { w: number; h: number };
  tool: Tool;
  editable: boolean;
  opts: ToolOptions;
  items: readonly Item[];
  selectedId: string | null;
  fieldNames: ReadonlySet<string>;
  onSelect(id: string | null): void;
  onAdd(item: Item): void;
  onChange(item: Item): void;
  fields: readonly { field: FieldInfo; widget: FieldInfo['widgets'][number] }[];
  values: Readonly<Record<string, string | boolean>>;
  fillForm: boolean;
  onValue(name: string, value: string | boolean): void;
  hits: readonly Rect[];
  activeHit: Rect | null;
  boxes: readonly TextBox[] | undefined;
  needBoxes(index: number): void;
  onVisible(index: number): void;
}

const pct = (v: number): string => `${v * 100}%`;

/** Adresse d'affichage d'une image de signature (une seule par tableau d'octets). */
const imageUrls = new WeakMap<Uint8Array, string>();
function pngUrl(png: Uint8Array): string {
  let url = imageUrls.get(png);
  if (!url) {
    url = URL.createObjectURL(new Blob([png.slice()], { type: 'image/png' }));
    imageUrls.set(png, url);
  }
  return url;
}
const boxStyle = (r: Rect) => ({ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) });

function moveItem(item: Item, dx: number, dy: number): Item {
  const mr = (r: Rect): Rect => ({ ...r, x: r.x + dx, y: r.y + dy });
  const mp = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  switch (item.kind) {
    case 'mark': return { ...item, rects: item.rects.map(mr) };
    case 'note': return { ...item, pos: mp(item.pos) };
    case 'shape': return { ...item, rect: mr(item.rect), from: mp(item.from), to: mp(item.to) };
    case 'ink': return { ...item, points: item.points.map(mp) };
    default: return { ...item, rect: mr(item.rect) };
  }
}

function bounds(item: Item): Rect {
  switch (item.kind) {
    case 'mark': return item.rects.reduce((a, r) => ({ x: Math.min(a.x, r.x), y: Math.min(a.y, r.y), w: Math.max(a.x + a.w, r.x + r.w) - Math.min(a.x, r.x), h: Math.max(a.y + a.h, r.y + r.h) - Math.min(a.y, r.y) }), item.rects[0] ?? { x: 0, y: 0, w: 0, h: 0 });
    case 'note': return { x: item.pos.x, y: item.pos.y, w: 0.035, h: 0.025 };
    case 'ink': {
      const xs = item.points.map((p) => p.x);
      const ys = item.points.map((p) => p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    default: return item.rect;
  }
}

/** Dessin SVG d'un element (coordonnees en pourcentage de la page). */
function ItemSvg({ item, w, h }: { item: Item; w: number; h: number }) {
  const X = (v: number): number => v * w;
  const Y = (v: number): number => v * h;
  switch (item.kind) {
    case 'mark':
      return <g>{item.rects.map((r, i) => item.mark === 'highlight'
        ? <rect key={i} x={X(r.x)} y={Y(r.y)} width={X(r.w)} height={Y(r.h)} fill={item.color} fillOpacity={0.45} />
        : <line key={i} x1={X(r.x)} x2={X(r.x + r.w)} y1={Y(r.y + r.h * (item.mark === 'underline' ? 0.92 : 0.55))} y2={Y(r.y + r.h * (item.mark === 'underline' ? 0.92 : 0.55))} stroke={item.color} strokeWidth={Math.max(1, Y(r.h) * 0.08)} />)}</g>;
    case 'shape': {
      const sw = item.width * (w / 600);
      if (item.shape === 'rect') return <rect x={X(item.rect.x)} y={Y(item.rect.y)} width={X(item.rect.w)} height={Y(item.rect.h)} fill="none" stroke={item.color} strokeWidth={sw} />;
      if (item.shape === 'ellipse') return <ellipse cx={X(item.rect.x + item.rect.w / 2)} cy={Y(item.rect.y + item.rect.h / 2)} rx={X(item.rect.w / 2)} ry={Y(item.rect.h / 2)} fill="none" stroke={item.color} strokeWidth={sw} />;
      return <line x1={X(item.from.x)} y1={Y(item.from.y)} x2={X(item.to.x)} y2={Y(item.to.y)} stroke={item.color} strokeWidth={sw} strokeLinecap="round" markerEnd={item.shape === 'arrow' ? `url(#pdf-arrow-${item.id})` : undefined} />;
    }
    case 'ink':
      return <polyline points={item.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke={item.color} strokeWidth={item.width * (w / 600)} strokeLinecap="round" strokeLinejoin="round" />;
    default:
      return null;
  }
}

export function PageView(p: PageViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [visible, setVisible] = useState(false);
  // Glisser en cours : refs (evenements rapproches) + etat pour le dessin de l'apercu.
  const [draft, setDraftState] = useState<{ start: Point; cur: Point; points: Point[] } | null>(null);
  const draftRef = useRef<typeof draft>(null);
  const setDraft = (v: typeof draft): void => {
    draftRef.current = v;
    setDraftState(v);
  };
  const dragRef = useRef<{ id: string; start: Point; item: Item } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBox, setEditBox] = useState<TextBox | null>(null);
  const { pdf, index, scale, viewRotation } = p;

  useEffect(() => {
    let alive = true;
    pdf.getPage(index + 1).then((pg) => alive && setPage(pg), () => undefined);
    return () => {
      alive = false;
    };
  }, [pdf, index]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      const v = Boolean(e?.isIntersecting);
      setVisible(v);
      if (v && (e?.intersectionRatio ?? 0) > 0.4) p.onVisible(index);
    }, { rootMargin: '600px 0px', threshold: [0, 0.4, 0.6] });
    io.observe(el);
    return () => io.disconnect();
  }, [index, p.onVisible]);

  const rotation = page ? (page.rotate + viewRotation) % 360 : 0;
  const vp = page?.getViewport({ scale: 1, rotation });
  const w = (vp?.width ?? p.fallbackSize.w) * scale;
  const h = (vp?.height ?? p.fallbackSize.h) * scale;

  // Rendu du canevas (annule si la page change avant la fin).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!page || !canvas || !visible) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const viewport = page.getViewport({ scale: scale * dpr, rotation });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const task = page.render({ canvas, viewport });
    task.promise.catch(() => undefined); // rendu annule : la page sera redessinee
    return () => task.cancel();
  }, [page, visible, scale, rotation]);

  // Calque de texte selectionnable (copier) en mode Selection.
  useEffect(() => {
    const el = textRef.current;
    if (!page || !el || !visible || p.tool !== 'select') return;
    el.replaceChildren();
    const layer = new TextLayer({ textContentSource: page.streamTextContent(), container: el, viewport: page.getViewport({ scale, rotation }) });
    layer.render().catch(() => undefined);
    return () => layer.cancel();
  }, [page, visible, scale, rotation, p.tool]);

  useEffect(() => {
    if (visible && (p.tool === 'highlight' || p.tool === 'underline' || p.tool === 'strike' || p.tool === 'edittext') && !p.boxes) p.needBoxes(index);
  }, [visible, p.tool, p.boxes, index]);

  const at = (e: ReactPointerEvent): Point => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const drawing = p.editable && viewRotation === 0 && !['select', 'hand', 'edittext'].includes(p.tool);
  const base = { page: index, author: p.opts.author, at: Date.now() };

  const finish = (start: Point, end: Point, points: Point[]): void => {
    const r = rectFrom(start, end);
    const tiny = r.w < 0.01 && r.h < 0.01;
    const o = p.opts;
    let item: Item | null = null;
    switch (p.tool) {
      case 'highlight':
      case 'underline':
      case 'strike': {
        const rects = snapToText(r, p.boxes ?? []);
        const color = p.tool === 'highlight' ? o.markColor : p.tool === 'underline' ? '#185ABD' : '#D13438';
        if (rects.length > 0) item = { ...base, id: newId(), kind: 'mark', mark: p.tool as MarkKind, rects, color, text: textUnder(rects, p.boxes ?? []) };
        break;
      }
      case 'note':
        item = { ...base, id: newId(), kind: 'note', pos: end, text: '', color: '#FFE500' };
        break;
      case 'freetext':
        item = { ...base, id: newId(), kind: 'freetext', rect: tiny ? { x: end.x, y: end.y, w: 0.3, h: 0.04 } : r, text: '', size: o.fontSize, color: o.color };
        break;
      case 'rect':
      case 'ellipse':
      case 'line':
      case 'arrow':
        if (!tiny) item = { ...base, id: newId(), kind: 'shape', shape: p.tool, rect: r, from: start, to: end, color: o.color, width: o.width };
        break;
      case 'ink':
        if (points.length > 1) item = { ...base, id: newId(), kind: 'ink', points, color: o.color, width: o.width };
        break;
      case 'stamp':
        item = { ...base, id: newId(), kind: 'stamp', stamp: o.stamp, rect: { x: end.x - 0.13, y: end.y - 0.03, w: 0.26, h: 0.06 } };
        break;
      case 'signature':
        if (o.signature) {
          const sw = 0.28;
          item = { ...base, id: newId(), kind: 'signature', png: o.signature.png, rect: { x: end.x - sw / 2, y: end.y - (sw * o.signature.ratio * (w / h)) / 2, w: sw, h: sw * o.signature.ratio * (w / h) } };
        }
        break;
      case 'field': {
        const fr = tiny ? { x: end.x, y: end.y, w: o.field === 'case' || o.field === 'radio' ? 0.03 : 0.3, h: o.field === 'zone_texte' || o.field === 'liste' ? 0.1 : 0.025 } : r;
        const name = uniqueFieldName(S.fieldBase[o.field], p.fieldNames);
        const options = o.field === 'liste' || o.field === 'liste_deroulante' ? ['Option 1', 'Option 2'] : [];
        item = { ...base, id: newId(), kind: 'field', field: o.field, name, rect: fr, options, value: o.field === 'radio' ? 'Choix1' : '' };
        break;
      }
      case 'redact':
        if (!tiny) item = { ...base, id: newId(), kind: 'redact', rect: r };
        break;
      default:
        break;
    }
    if (item) {
      p.onAdd(item);
      p.onSelect(item.id);
      if (item.kind === 'note' || item.kind === 'freetext') setEditing(item.id);
    }
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drawing || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = at(e);
    setDraft({ start: pt, cur: pt, points: [pt] });
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (drag) {
      const pt = at(e);
      p.onChange(moveItem(drag.item, pt.x - drag.start.x, pt.y - drag.start.y));
      return;
    }
    const d = draftRef.current;
    if (!d) return;
    const pt = at(e);
    setDraft({ ...d, cur: pt, points: p.tool === 'ink' ? [...d.points, pt] : d.points });
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragRef.current) {
      dragRef.current = null;
      return;
    }
    const d = draftRef.current;
    if (!d) return;
    const end = at(e);
    setDraft(null);
    finish(d.start, end, d.points);
  };

  const grab = (e: ReactPointerEvent, item: Item): void => {
    if (p.tool !== 'select' || !p.editable) return;
    e.stopPropagation();
    p.onSelect(item.id);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: item.id, start: at(e), item };
  };

  const draftRect = draft ? rectFrom(draft.start, draft.cur) : null;
  const svgItems = p.items.filter((i) => i.kind === 'mark' || i.kind === 'shape' || i.kind === 'ink');
  const cls = `pdf-page${p.tool === 'hand' ? ' is-hand' : ''}${drawing ? ' is-drawing' : ''}`;

  return (
    <div ref={wrapRef} className={cls} style={{ width: w, height: h }} data-page={index + 1}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      onClick={(e) => { if (p.tool === 'select' && e.target === e.currentTarget) p.onSelect(null); }}>
      <canvas ref={canvasRef} className="pdf-page__canvas" style={{ width: w, height: h }} aria-label={S.status.page(index + 1, pdf.numPages)} />
      <div ref={textRef} className="pdf-text" style={{ ['--scale-factor' as string]: scale, ['--total-scale-factor' as string]: scale }} />
      {viewRotation === 0 && (
        <div className="pdf-overlay">
          {p.hits.map((r, i) => <div key={i} className={`pdf-hit${p.activeHit === r ? ' is-active' : ''}`} style={boxStyle(r)} />)}
          <svg className="pdf-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <defs>{svgItems.filter((i) => i.kind === 'shape' && i.shape === 'arrow').map((i) => (
              <marker key={i.id} id={`pdf-arrow-${i.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={i.kind === 'shape' ? i.color : '#000'} />
              </marker>
            ))}</defs>
            {svgItems.map((i) => <g key={i.id} className="pdf-svg__item" onPointerDown={(e) => grab(e, i)}><ItemSvg item={i} w={w} h={h} /></g>)}
            {draft && draftRect && (p.tool === 'ink'
              ? <polyline points={draft.points.map((q) => `${q.x * w},${q.y * h}`).join(' ')} fill="none" stroke={p.opts.color} strokeWidth={p.opts.width * (w / 600)} strokeLinecap="round" />
              : p.tool === 'line' || p.tool === 'arrow'
                ? <line x1={draft.start.x * w} y1={draft.start.y * h} x2={draft.cur.x * w} y2={draft.cur.y * h} stroke={p.opts.color} strokeWidth={2} />
                : <rect className="pdf-draft" x={draftRect.x * w} y={draftRect.y * h} width={draftRect.w * w} height={draftRect.h * h} />)}
          </svg>
          {p.items.map((i) => {
            const sel = i.id === p.selectedId;
            const common = { onPointerDown: (e: ReactPointerEvent) => grab(e, i), onDoubleClick: () => setEditing(i.id) };
            switch (i.kind) {
              case 'note':
                return (
                  <div key={i.id} className={`pdf-note${sel ? ' is-selected' : ''}`} style={{ left: pct(i.pos.x), top: pct(i.pos.y) }} {...common} title={i.text}>
                    <span className="pdf-note__icon" />
                    {(editing === i.id || (sel && i.text)) && (
                      <textarea className="pdf-note__pop" autoFocus={editing === i.id} defaultValue={i.text} placeholder={S.dialogs.noteText} aria-label={S.dialogs.noteText}
                        onPointerDown={(e) => e.stopPropagation()} onChange={(e) => p.onChange({ ...i, text: e.target.value })} onBlur={() => setEditing(null)} />
                    )}
                  </div>
                );
              case 'freetext':
                return (
                  <div key={i.id} className={`pdf-free${sel ? ' is-selected' : ''}`} style={{ ...boxStyle(i.rect), color: i.color, fontSize: i.size * scale }} {...common}>
                    {editing === i.id
                      ? <textarea autoFocus defaultValue={i.text} aria-label={S.dialogs.freeText} style={{ color: i.color, fontSize: i.size * scale }} onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => p.onChange({ ...i, text: e.target.value })} onBlur={() => setEditing(null)} />
                      : <span>{i.text || S.dialogs.freeText}</span>}
                  </div>
                );
              case 'stamp':
                return <div key={i.id} className={`pdf-stamp${sel ? ' is-selected' : ''}`} style={{ ...boxStyle(i.rect), color: STAMP_COLORS[i.stamp], borderColor: STAMP_COLORS[i.stamp], fontSize: i.rect.h * h * 0.5 }} {...common}>{S.stamps[i.stamp].toUpperCase()}</div>;
              case 'signature':
                return <div key={i.id} className={`pdf-sign${sel ? ' is-selected' : ''}`} style={boxStyle(i.rect)} {...common}><img alt={S.kinds.signature} src={pngUrl(i.png)} draggable={false} /></div>;
              case 'field':
                return <div key={i.id} className={`pdf-newfield${sel ? ' is-selected' : ''}`} style={boxStyle(i.rect)} {...common} title={`${S.fields[i.field]} : ${i.name}`}><span>{i.name}</span></div>;
              case 'textedit':
                return <div key={i.id} className={`pdf-textedit${sel ? ' is-selected' : ''}`} style={{ ...boxStyle(i.rect), fontSize: i.size * scale }} {...common}>{i.text}</div>;
              case 'redact':
                return <div key={i.id} className={`pdf-redact${sel ? ' is-selected' : ''}`} style={boxStyle(i.rect)} {...common} title={S.kinds.redact} />;
              default:
                return sel ? <div key={i.id} className="pdf-selbox" style={boxStyle(bounds(i))} /> : null;
            }
          })}
          {p.tool === 'edittext' && p.editable && (p.boxes ?? []).map((b, k) => (
            <button key={k} type="button" className="pdf-textbox" style={boxStyle(b.rect)} title={b.str} onClick={() => setEditBox(b)} />
          ))}
          {editBox && (
            <textarea className="pdf-textbox-edit" autoFocus defaultValue={editBox.str} aria-label={S.dialogs.editText}
              style={{ ...boxStyle({ ...editBox.rect, w: Math.max(editBox.rect.w, 0.2) }), fontSize: editBox.size * scale }}
              onKeyDown={(e) => { if (e.key === 'Escape') setEditBox(null); if (e.key === 'Enter' && !e.shiftKey) e.currentTarget.blur(); }}
              onBlur={(e) => {
                const text = e.target.value;
                if (text !== editBox.str) p.onAdd({ ...base, id: newId(), kind: 'textedit', rect: editBox.rect, text, size: editBox.size });
                setEditBox(null);
              }} />
          )}
          {p.fillForm && p.fields.map(({ field: f, widget }, k) => {
            const v = p.values[f.name] ?? f.value;
            const style = boxStyle(widget.rect);
            if (f.type === 'case') return <input key={k} type="checkbox" className="pdf-field" style={style} disabled={f.readOnly} checked={v === true} aria-label={f.name} onChange={(e) => p.onValue(f.name, e.target.checked)} />;
            if (f.type === 'radio') return <input key={k} type="radio" className="pdf-field" style={style} disabled={f.readOnly} name={`${index}-${f.name}`} checked={v === widget.option} aria-label={`${f.name} ${widget.option ?? ''}`} onChange={() => p.onValue(f.name, widget.option ?? '')} />;
            if (f.type === 'liste') return <select key={k} className="pdf-field" style={{ ...style, fontSize: widget.rect.h * h * 0.6 }} disabled={f.readOnly} value={String(v)} aria-label={f.name} onChange={(e) => p.onValue(f.name, e.target.value)}>{f.options.map((o) => <option key={o}>{o}</option>)}</select>;
            if (f.type === 'texte' && f.multiline) return <textarea key={k} className="pdf-field" style={style} disabled={f.readOnly} value={String(v)} aria-label={f.name} onChange={(e) => p.onValue(f.name, e.target.value)} />;
            if (f.type === 'texte') return <input key={k} className="pdf-field" style={{ ...style, fontSize: Math.min(widget.rect.h * h * 0.65, 14 * scale) }} disabled={f.readOnly} value={String(v)} aria-label={f.name} onChange={(e) => p.onValue(f.name, e.target.value)} />;
            return null;
          })}
        </div>
      )}
    </div>
  );
}
