// Une page du lecteur : rendu pdf.js (canevas net en haute densite), calque de texte selectionnable, liens cliquables,
// elements (annotations du fichier ou en attente, champs, corrections, caviardage) editables, champs du formulaire a remplir.
// Les elements vivent dans le repere de la page (/Rotate compris) ; la rotation de l'affichage tourne seulement le calque d'edition.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Icon, useContextMenu, type MenuItem } from '@forgeoffice/ui';
import type { MenuContext } from './contextMenus.ts';
import type { FieldInfo } from './forms.ts';
import { pageLinks, type LinkInfo, type OcConfig } from './extras.ts';
import { ItemDom, ItemSvg, boxStyle, bounds, handleOf, moveItem, pct, resizeItem } from './itemview.tsx';
import {
  INK_COLORS, MARK_COLORS, fromScreenPoint, newId, union, pressureWidth, rectFrom, restyle, snapToText, textUnder, toScreenPoint, uniqueFieldName,
  type FieldKind, type Item, type MarkKind, type Point, type Rect, type StampKind, type TextBox, type Tool,
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
  onRemove(id: string): void;
  fields: readonly { field: FieldInfo; widget: FieldInfo['widgets'][number] }[];
  values: Readonly<Record<string, string | boolean>>;
  fillForm: boolean;
  onValue(name: string, value: string | boolean): void;
  /** Clic sur un champ de signature : page et rectangle du champ. */
  onSignField(page: number, rect: Rect): void;
  hits: readonly Rect[];
  activeHit: Rect | null;
  boxes: readonly TextBox[] | undefined;
  needBoxes(index: number): void;
  onVisible(index: number): void;
  /** Mode nuit : couleurs de la page inversees. */
  night: boolean;
  /** Calques (contenu optionnel) : configuration partagee et compteur de changements. */
  layers: { config: OcConfig | null; version: number };
  onLink(link: LinkInfo): void;
  /** Menu du clic droit ; `editText` ouvre l'edition sur place d'une note ou d'une zone de texte de cette page. */
  buildMenu(ctx: MenuContext, editText: (id: string) => void): MenuItem[];
}

export function PageView(p: PageViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [visible, setVisible] = useState(false);
  const [links, setLinks] = useState<LinkInfo[]>([]);
  // Glisser en cours : refs (evenements rapproches) + etat pour le dessin de l'apercu.
  const [draft, setDraftState] = useState<{ start: Point; cur: Point; points: Point[] } | null>(null);
  const draftRef = useRef<typeof draft>(null);
  const setDraft = (v: typeof draft): void => {
    draftRef.current = v;
    setDraftState(v);
  };
  const dragRef = useRef<{ id: string; start: Point; item: Item } | null>(null);
  const resizeRef = useRef<Item | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBox, setEditBox] = useState<TextBox | null>(null);
  const { pdf, index, scale } = p;
  const menu = useContextMenu();
  const vr = ((p.viewRotation % 360) + 360) % 360;

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

  // Liens de la page (charges quand elle devient visible).
  useEffect(() => {
    if (!page || !visible) return;
    let alive = true;
    pageLinks(pdf, page).then((l) => alive && setLinks(l), () => alive && setLinks([]));
    return () => {
      alive = false;
    };
  }, [pdf, page, visible]);

  const rotation = page ? (page.rotate + vr) % 360 : 0;
  const vp = page?.getViewport({ scale: 1, rotation });
  const w = (vp?.width ?? (vr % 180 === 90 ? p.fallbackSize.h : p.fallbackSize.w)) * scale;
  const h = (vp?.height ?? (vr % 180 === 90 ? p.fallbackSize.w : p.fallbackSize.h)) * scale;
  // Dimensions du calque d'edition (repere de la page, avant rotation de l'affichage).
  const odd = vr % 180 === 90;
  const iw = odd ? h : w;
  const ih = odd ? w : h;
  const overlayStyle = vr === 0 ? undefined : { inset: 'auto', left: (w - iw) / 2, top: (h - ih) / 2, width: iw, height: ih, transform: `rotate(${vr}deg)` };

  // Rendu du canevas (annule si la page change avant la fin).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!page || !canvas || !visible) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const viewport = page.getViewport({ scale: scale * dpr, rotation });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const task = page.render({ canvas, viewport, ...(p.layers.config ? { optionalContentConfigPromise: Promise.resolve(p.layers.config) } : {}) });
    task.promise.catch(() => undefined); // rendu annule : la page sera redessinee
    return () => task.cancel();
  }, [page, visible, scale, rotation, p.layers.config, p.layers.version]);

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

  /** Point de l'ecran -> repere de la page (hors rotation de l'affichage). */
  const at = (e: { clientX: number; clientY: number }): Point => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return fromScreenPoint({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }, vr);
  };

  // Doigts poses sur la page : un deuxieme doigt (pincement) annule le trace ; un stylet recent ecarte la paume.
  const touches = useRef(new Set<number>());
  const lastPen = useRef(0);
  const pressures = useRef<number[]>([]);
  const drawing = p.editable && !['select', 'hand', 'edittext'].includes(p.tool);
  const base = { page: index, author: p.opts.author, at: Date.now() };

  const finish = (start: Point, end: Point, points: Point[], pointerType = 'mouse'): void => {
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
        if (points.length > 1) item = { ...base, id: newId(), kind: 'ink', points, color: o.color, width: pressureWidth(o.width, pressures.current, pointerType) };
        break;
      case 'stamp':
        item = { ...base, id: newId(), kind: 'stamp', stamp: o.stamp, rect: { x: end.x - 0.13, y: end.y - 0.03, w: 0.26, h: 0.06 } };
        break;
      case 'signature':
        if (o.signature) {
          const sw = 0.28;
          const sh = sw * o.signature.ratio * (iw / ih);
          item = { ...base, id: newId(), kind: 'signature', png: o.signature.png, rect: { x: end.x - sw / 2, y: end.y - sh / 2, w: sw, h: sh } };
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
    if (e.pointerType === 'pen') lastPen.current = performance.now();
    if (e.pointerType === 'touch') {
      touches.current.add(e.pointerId);
      if (touches.current.size > 1) {
        setDraft(null);
        return;
      }
      if (performance.now() - lastPen.current < 1500) return; // paume posee pendant l ecriture au stylet
    }
    if (!drawing || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = at(e);
    pressures.current = [e.pressure];
    setDraft({ start: pt, cur: pt, points: [pt] });
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (resizeRef.current) {
      p.onChange(resizeItem(resizeRef.current, at(e)));
      return;
    }
    const drag = dragRef.current;
    if (drag) {
      const pt = at(e);
      p.onChange(moveItem(drag.item, pt.x - drag.start.x, pt.y - drag.start.y));
      return;
    }
    const d = draftRef.current;
    if (!d) return;
    const pt = at(e);
    if (p.tool === 'ink') pressures.current.push(e.pressure);
    setDraft({ ...d, cur: pt, points: p.tool === 'ink' ? [...d.points, pt] : d.points });
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    touches.current.delete(e.pointerId);
    if (resizeRef.current || dragRef.current) {
      resizeRef.current = null;
      dragRef.current = null;
      return;
    }
    const d = draftRef.current;
    if (!d) return;
    const end = at(e);
    setDraft(null);
    finish(d.start, end, d.points, e.pointerType);
  };

  const grab = (e: ReactPointerEvent, item: Item): void => {
    if (p.tool !== 'select' || !p.editable) return;
    e.stopPropagation();
    p.onSelect(item.id);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: item.id, start: at(e), item };
  };

  /** Rectangles (une ligne = un rectangle) du texte selectionne sur cette page, dans le repere de la page. */
  const selectionRects = (): Rect[] => {
    const sel = window.getSelection();
    const box = wrapRef.current?.getBoundingClientRect();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !box) return [];
    const lines = new Map<number, Rect>();
    for (const cr of sel.getRangeAt(0).getClientRects()) {
      const cx = (cr.left + cr.right) / 2;
      const cy = (cr.top + cr.bottom) / 2;
      if (cr.width < 1 || cr.height < 1 || cx < box.left || cx > box.right || cy < box.top || cy > box.bottom) continue; // autre page
      const a = fromScreenPoint({ x: (cr.left - box.left) / box.width, y: (cr.top - box.top) / box.height }, vr);
      const b = fromScreenPoint({ x: (cr.right - box.left) / box.width, y: (cr.bottom - box.top) / box.height }, vr);
      const r: Rect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
      const key = Math.round((r.y + r.h / 2) * 400);
      const cur = lines.get(key);
      lines.set(key, cur ? union(cur, r) : r);
    }
    return [...lines.values()].sort((m, n) => m.y - n.y);
  };

  const onContext = (e: React.MouseEvent<HTMLDivElement>): void => {
    const t = e.target as HTMLElement;
    if (t.closest('.pdf-note__pop, .pdf-free textarea, .pdf-textbox-edit')) return; // saisie en cours : menu natif
    const itemId = t.closest('[data-item]')?.getAttribute('data-item');
    const item = itemId ? p.items.find((i) => i.id === itemId) ?? null : null;
    const fieldIdx = t.closest('[data-field]')?.getAttribute('data-field');
    const fw = fieldIdx !== null && fieldIdx !== undefined ? p.fields[Number(fieldIdx)] : undefined;
    if (item) p.onSelect(item.id);
    const ctx: MenuContext = {
      page: index, point: at(e), item,
      field: fw ? { name: fw.field.name, type: fw.field.type, signed: fw.field.signed, rect: fw.widget.rect } : null,
      selection: window.getSelection()?.toString() ?? '', selectionRects: selectionRects(),
    };
    menu.open(e, p.buildMenu(ctx, setEditing));
  };

  const draftRect = draft ? rectFrom(draft.start, draft.cur) : null;
  const svgItems = p.items.filter((i) => i.kind === 'mark' || i.kind === 'shape' || i.kind === 'ink');
  const selected = p.items.find((i) => i.id === p.selectedId) ?? null;
  const handle = selected && p.editable && p.tool === 'select' ? handleOf(selected) : null;
  const cls = `pdf-page${p.tool === 'hand' ? ' is-hand' : ''}${drawing ? ' is-drawing' : ''}${p.night ? ' is-night' : ''}`;
  const canLink = p.tool === 'select' || p.tool === 'hand';
  const swatches: readonly string[] | null = selected && restyle(selected, { color: '#000000' }) ? (selected.kind === 'mark' ? MARK_COLORS : INK_COLORS) : null;
  const barAt = selected ? toScreenPoint({ x: bounds(selected).x, y: bounds(selected).y }, vr) : null;

  return (
    <div ref={wrapRef} className={cls} style={{ width: w, height: h }} data-page={index + 1}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={(e) => touches.current.delete(e.pointerId)} onContextMenu={onContext}
      onClick={(e) => { if (p.tool === 'select' && e.target === e.currentTarget) p.onSelect(null); }}>
      <canvas ref={canvasRef} className="pdf-page__canvas" style={{ width: w, height: h }} aria-label={S.status.page(index + 1, pdf.numPages)} />
      <div ref={textRef} className="pdf-text" style={{ ['--scale-factor' as string]: scale, ['--total-scale-factor' as string]: scale }} />
      <div className="pdf-overlay" style={overlayStyle}>
        {canLink && links.map((l, k) => (
          <button key={k} type="button" className="pdf-linkarea" style={boxStyle(l.rect)} title={l.url ?? S.status.page((l.page ?? 0) + 1, pdf.numPages)} aria-label={l.url ?? S.status.page((l.page ?? 0) + 1, pdf.numPages)} onClick={() => p.onLink(l)} />
        ))}
        {p.hits.map((r, i) => <div key={i} className={`pdf-hit${p.activeHit === r ? ' is-active' : ''}`} style={boxStyle(r)} />)}
        <svg className="pdf-svg" width={iw} height={ih} viewBox={`0 0 ${iw} ${ih}`}>
          <defs>{svgItems.filter((i) => i.kind === 'shape' && i.shape === 'arrow').map((i) => (
            <marker key={i.id} id={`pdf-arrow-${i.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={i.kind === 'shape' ? i.color : '#000'} />
            </marker>
          ))}</defs>
          {svgItems.map((i) => <g key={i.id} className="pdf-svg__item" data-item={i.id} onPointerDown={(e) => grab(e, i)}><ItemSvg item={i} w={iw} h={ih} /></g>)}
          {draft && draftRect && (p.tool === 'ink'
            ? <polyline points={draft.points.map((q) => `${q.x * iw},${q.y * ih}`).join(' ')} fill="none" stroke={p.opts.color} strokeWidth={p.opts.width * (iw / 600)} strokeLinecap="round" />
            : p.tool === 'line' || p.tool === 'arrow'
              ? <line x1={draft.start.x * iw} y1={draft.start.y * ih} x2={draft.cur.x * iw} y2={draft.cur.y * ih} stroke={p.opts.color} strokeWidth={2} />
              : <rect className="pdf-draft" x={draftRect.x * iw} y={draftRect.y * ih} width={draftRect.w * iw} height={draftRect.h * ih} />)}
        </svg>
        {p.items.map((i) => (
          <ItemDom key={i.id} item={i} selected={i.id === p.selectedId} scale={scale} h={ih} editing={editing === i.id} onGrab={grab}
            onEdit={setEditing} onStopEdit={() => setEditing(null)} onChange={p.onChange} />
        ))}
        {handle && selected && (
          <div className="pdf-handle" style={{ left: pct(handle.x), top: pct(handle.y) }} role="presentation"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              resizeRef.current = selected;
            }} />
        )}
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
          const tag = { 'data-field': k };
          const v = p.values[f.name] ?? f.value;
          const style = boxStyle(widget.rect);
          const fs = Math.min(widget.rect.h * ih * 0.65, 14 * scale);
          if (f.type === 'case') return <input key={k} {...tag} type="checkbox" className="pdf-field" style={style} disabled={f.readOnly} checked={v === true} aria-label={f.name} onChange={(e) => p.onValue(f.name, e.target.checked)} />;
          if (f.type === 'radio') return <input key={k} {...tag} type="radio" className="pdf-field" style={style} disabled={f.readOnly} name={`${index}-${f.name}`} checked={v === widget.option} aria-label={`${f.name} ${widget.option ?? ''}`} onChange={() => p.onValue(f.name, widget.option ?? '')} />;
          if (f.type === 'liste') return <select key={k} {...tag} className="pdf-field" style={{ ...style, fontSize: widget.rect.h * ih * 0.6 }} disabled={f.readOnly} value={String(v)} aria-label={f.name} onChange={(e) => p.onValue(f.name, e.target.value)}>{f.options.map((o) => <option key={o}>{o}</option>)}</select>;
          if (f.type === 'texte' && f.multiline) return <textarea key={k} {...tag} className="pdf-field" style={style} disabled={f.readOnly} value={String(v)} aria-label={f.name} onChange={(e) => p.onValue(f.name, e.target.value)} />;
          if (f.type === 'texte') return <input key={k} {...tag} className="pdf-field" style={{ ...style, fontSize: fs }} disabled={f.readOnly} value={String(v)} aria-label={f.name} onChange={(e) => p.onValue(f.name, e.target.value)} />;
          if (f.type === 'signature') {
            const c = { x: widget.rect.x + widget.rect.w / 2, y: widget.rect.y + widget.rect.h / 2 };
            // Une signature dessinee deja posee dans le cadre remplace le bouton.
            if (p.items.some((i) => i.kind === 'signature' && c.x >= i.rect.x && c.x <= i.rect.x + i.rect.w && c.y >= i.rect.y && c.y <= i.rect.y + i.rect.h)) return null;
            return <button key={k} {...tag} type="button" className="pdf-field pdf-sigfield" style={{ ...style, fontSize: Math.min(fs, 13 * scale) }} disabled={f.signed || f.readOnly} aria-label={f.name}
              onClick={() => p.onSignField(index, widget.rect)}>{f.signed ? S.sign.signedField : S.sign.signField}</button>;
          }
          return null;
        })}
      </div>
      {menu.menu}
      {selected && p.editable && p.tool === 'select' && barAt && (
        <div className="pdf-floatbar" style={{ left: pct(Math.min(Math.max(barAt.x, 0), 0.7)), top: `max(0px, calc(${pct(barAt.y)} - 40px))` }} onPointerDown={(e) => e.stopPropagation()}>
          {swatches?.map((c) => (
            <button key={c} type="button" className="pdf-floatbar__swatch" style={{ background: c }} aria-label={`${S.floating.color} ${c}`} title={S.floating.color}
              onClick={() => { const next = restyle(selected, { color: c }); if (next) p.onChange(next); }} />
          ))}
          <button type="button" className="pdf-iconbtn" aria-label={S.floating.delete} title={S.floating.delete} onClick={() => { p.onRemove(selected.id); p.onSelect(null); }}><Icon name="delete" size={16} /></button>
        </div>
      )}
    </div>
  );
}
