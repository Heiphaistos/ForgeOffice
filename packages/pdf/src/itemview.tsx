// Dessin des elements poses sur une page (SVG pour traits, formes et surlignages ; DOM pour notes, textes, tampons, champs)
// et operations geometriques sur ces elements (deplacer, redimensionner). Coordonnees normalisees dans la page (hors rotation de l'affichage).
import type { PointerEvent as ReactPointerEvent } from 'react';
import { STAMP_COLORS, type Item, type Point, type Rect } from './model.ts';
import { S } from './strings.ts';

export const pct = (v: number): string => `${v * 100}%`;
export const boxStyle = (r: Rect) => ({ left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) });

/** Adresse d'affichage d'une image de signature (une seule par tableau d'octets). */
const imageUrls = new WeakMap<Uint8Array, string>();
export function pngUrl(png: Uint8Array): string {
  let url = imageUrls.get(png);
  if (!url) {
    url = URL.createObjectURL(new Blob([png.slice()], { type: 'image/png' }));
    imageUrls.set(png, url);
  }
  return url;
}

export function moveItem(item: Item, dx: number, dy: number): Item {
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

/** Poignee de redimensionnement : coin bas droit d'un rectangle, ou extremite d'une ligne ; null si l'element ne se redimensionne pas. */
export function handleOf(item: Item): Point | null {
  switch (item.kind) {
    case 'shape': return item.shape === 'line' || item.shape === 'arrow' ? item.to : { x: item.rect.x + item.rect.w, y: item.rect.y + item.rect.h };
    case 'freetext':
    case 'stamp':
    case 'signature':
    case 'field':
    case 'textedit':
    case 'redact': return { x: item.rect.x + item.rect.w, y: item.rect.y + item.rect.h };
    default: return null;
  }
}

/** Element dont la poignee est amenee en `pt`. */
export function resizeItem(item: Item, pt: Point): Item {
  const fit = (r: Rect): Rect => ({ ...r, w: Math.max(0.01, pt.x - r.x), h: Math.max(0.01, pt.y - r.y) });
  switch (item.kind) {
    case 'shape':
      if (item.shape === 'line' || item.shape === 'arrow') return { ...item, to: pt, rect: { x: Math.min(item.from.x, pt.x), y: Math.min(item.from.y, pt.y), w: Math.abs(pt.x - item.from.x), h: Math.abs(pt.y - item.from.y) } };
      return { ...item, rect: fit(item.rect) };
    case 'freetext':
    case 'stamp':
    case 'signature':
    case 'field':
    case 'textedit':
    case 'redact': return { ...item, rect: fit(item.rect) };
    default: return item;
  }
}

export function bounds(item: Item): Rect {
  switch (item.kind) {
    case 'mark': return item.rects.reduce((a, r) => ({ x: Math.min(a.x, r.x), y: Math.min(a.y, r.y), w: Math.max(a.x + a.w, r.x + r.w) - Math.min(a.x, r.x), h: Math.max(a.y + a.h, r.y + r.h) - Math.min(a.y, r.y) }), item.rects[0] ?? { x: 0, y: 0, w: 0, h: 0 });
    case 'note': return { x: item.pos.x, y: item.pos.y, w: 0.035, h: 0.025 };
    case 'ink': {
      const xs = item.points.map((p) => p.x);
      const ys = item.points.map((p) => p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    case 'shape': return item.shape === 'line' || item.shape === 'arrow' ? { x: Math.min(item.from.x, item.to.x), y: Math.min(item.from.y, item.to.y), w: Math.abs(item.to.x - item.from.x), h: Math.abs(item.to.y - item.from.y) } : item.rect;
    default: return item.rect;
  }
}

/** Dessin SVG d'un element (coordonnees en pixels de la page). */
export function ItemSvg({ item, w, h }: { item: Item; w: number; h: number }) {
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

export interface ItemDomProps {
  item: Item;
  selected: boolean;
  scale: number;
  /** Hauteur de la page en pixels (taille du texte d'un tampon). */
  h: number;
  editing: boolean;
  onGrab(e: ReactPointerEvent, item: Item): void;
  onEdit(id: string): void;
  onStopEdit(): void;
  onChange(item: Item): void;
}

/** Element dessine en DOM (notes, textes, tampons, signature, champs, corrections, caviardage). */
export function ItemDom({ item: i, selected: sel, scale, h, editing, onGrab, onEdit, onStopEdit, onChange }: ItemDomProps) {
  const common = { onPointerDown: (e: ReactPointerEvent) => onGrab(e, i), onDoubleClick: () => onEdit(i.id), 'data-item': i.id };
  const cls = (base: string): string => `${base}${sel ? ' is-selected' : ''}`;
  switch (i.kind) {
    case 'note':
      return (
        <div className={cls('pdf-note')} style={{ left: pct(i.pos.x), top: pct(i.pos.y) }} {...common} title={i.text}>
          <span className="pdf-note__icon" />
          {(editing || (sel && i.text)) && (
            <textarea className="pdf-note__pop" autoFocus={editing} defaultValue={i.text} placeholder={S.dialogs.noteText} aria-label={S.dialogs.noteText}
              onPointerDown={(e) => e.stopPropagation()} onChange={(e) => onChange({ ...i, text: e.target.value })} onBlur={onStopEdit} />
          )}
        </div>
      );
    case 'freetext':
      return (
        <div className={cls('pdf-free')} style={{ ...boxStyle(i.rect), color: i.color, fontSize: i.size * scale }} {...common}>
          {editing
            ? <textarea autoFocus defaultValue={i.text} aria-label={S.dialogs.freeText} style={{ color: i.color, fontSize: i.size * scale }} onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => onChange({ ...i, text: e.target.value })} onBlur={onStopEdit} />
            : <span>{i.text || S.dialogs.freeText}</span>}
        </div>
      );
    case 'stamp':
      return <div className={cls('pdf-stamp')} style={{ ...boxStyle(i.rect), color: STAMP_COLORS[i.stamp], borderColor: STAMP_COLORS[i.stamp], fontSize: i.rect.h * h * 0.5 }} {...common}>{S.stamps[i.stamp].toUpperCase()}</div>;
    case 'signature':
      return <div className={cls('pdf-sign')} style={boxStyle(i.rect)} {...common}><img alt={S.kinds.signature} src={pngUrl(i.png)} draggable={false} /></div>;
    case 'field':
      return <div className={cls('pdf-newfield')} style={boxStyle(i.rect)} {...common} title={`${S.fields[i.field]} : ${i.name}`}><span>{i.name}</span></div>;
    case 'textedit':
      return <div className={cls('pdf-textedit')} style={{ ...boxStyle(i.rect), fontSize: i.size * scale }} {...common}>{i.text}</div>;
    case 'redact':
      return <div className={cls('pdf-redact')} style={boxStyle(i.rect)} {...common} title={S.kinds.redact} />;
    default:
      return sel ? <div className="pdf-selbox" style={boxStyle(bounds(i))} /> : null;
  }
}
