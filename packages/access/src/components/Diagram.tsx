// Boites de tables deplacables et traits de jointure/relation (createur de requetes, fenetre Relations).
import { useRef, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '@forgeoffice/ui';

export const BOX_W = 180;
const HEAD_H = 28;
const ROW_H = 20;
const MAX_ROWS = 8;
const FIELD_MIME = 'application/x-fo-field';

export interface BoxPos {
  name: string;
  x: number;
  y: number;
}

export interface FieldRef {
  table: string;
  field: string;
}

export function readFieldDrag(e: DragEvent): FieldRef | null {
  const raw = e.dataTransfer.getData(FIELD_MIME);
  if (!raw) return null;
  const v = JSON.parse(raw) as Partial<FieldRef>;
  return typeof v.table === 'string' && typeof v.field === 'string' ? { table: v.table, field: v.field } : null;
}

export function hasFieldDrag(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(FIELD_MIME);
}

function bodyHeight(count: number): number {
  return Math.min(count, MAX_ROWS) * ROW_H + 4;
}

/** Point d'accroche d'un champ sur le bord gauche ou droit d'une boite. */
function anchor(box: BoxPos, fields: readonly string[], field: string, right: boolean): { x: number; y: number } {
  const i = Math.max(0, fields.findIndex((f) => f.toLowerCase() === field.toLowerCase()));
  const y = box.y + HEAD_H + 2 + (Math.min(i, MAX_ROWS - 1) + 0.5) * ROW_H;
  return { x: right ? box.x + BOX_W : box.x, y };
}

interface TableBoxProps {
  box: BoxPos;
  fields: readonly string[];
  keys: readonly string[];
  selected?: boolean;
  onMove: (x: number, y: number) => void;
  onFieldDoubleClick?: (field: string) => void;
  onFieldDrop?: (from: FieldRef, toField: string) => void;
  onHeaderDoubleClick?: () => void;
  onContextMenu?: (e: ReactPointerEvent | React.MouseEvent) => void;
  onSelect?: () => void;
}

export function TableBox({ box, fields, keys, selected, onMove, onFieldDoubleClick, onFieldDrop, onHeaderDoubleClick, onContextMenu, onSelect }: TableBoxProps) {
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const down = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    onSelect?.();
    drag.current = { px: e.clientX, py: e.clientY, x: box.x, y: box.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (d) onMove(Math.max(0, Math.round(d.x + e.clientX - d.px)), Math.max(0, Math.round(d.y + e.clientY - d.py)));
  };
  return (
    <div className={`acc-box${selected ? ' is-selected' : ''}`} style={{ left: box.x, top: box.y, width: BOX_W }} onContextMenu={onContextMenu}>
      <div
        className="acc-box__head"
        style={{ height: HEAD_H }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onDoubleClick={onHeaderDoubleClick}
        title={box.name}
      >
        {box.name}
      </div>
      <ul className="acc-box__fields fo-scroll" style={{ height: bodyHeight(fields.length) }}>
        {fields.map((f) => (
          <li
            key={f}
            style={{ height: ROW_H }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(FIELD_MIME, JSON.stringify({ table: box.name, field: f }));
              e.dataTransfer.effectAllowed = 'link';
            }}
            onDragOver={(e) => {
              if (onFieldDrop && hasFieldDrag(e)) e.preventDefault();
            }}
            onDrop={(e) => {
              const from = readFieldDrag(e);
              if (from && onFieldDrop && from.table !== box.name) {
                e.preventDefault();
                onFieldDrop(from, f);
              }
            }}
            onDoubleClick={() => onFieldDoubleClick?.(f)}
          >
            {keys.includes(f) ? <Icon name="key" size={16} /> : <span className="acc-box__nokey" />}
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface Link {
  id: string;
  from: FieldRef;
  to: FieldRef;
  /** Etiquettes cote « from » et cote « to » (1 / ∞). */
  labels?: [string, string];
  /** Fleche de jointure externe : extremite cote « to ». */
  arrow?: boolean;
}

interface LinesProps {
  boxes: readonly BoxPos[];
  fieldsOf: (table: string) => readonly string[];
  links: readonly Link[];
  selected: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}

/** Traits entre champs : du bord le plus proche de chaque boite, avec petits ergots horizontaux. */
export function Lines({ boxes, fieldsOf, links, selected, onSelect, onOpen }: LinesProps) {
  const byName = (n: string): BoxPos | undefined => boxes.find((b) => b.name.toLowerCase() === n.toLowerCase());
  return (
    <svg className="acc-lines" aria-hidden="false">
      {links.map((l) => {
        const a = byName(l.from.table);
        const b = byName(l.to.table);
        if (!a || !b) return null;
        const aRight = a.x + BOX_W / 2 < b.x + BOX_W / 2;
        const p1 = anchor(a, fieldsOf(a.name), l.from.field, aRight);
        const p2 = anchor(b, fieldsOf(b.name), l.to.field, !aRight);
        const s1 = aRight ? 14 : -14;
        const s2 = aRight ? -14 : 14;
        const d = `M ${p1.x} ${p1.y} h ${s1} L ${p2.x + s2} ${p2.y} h ${-s2}`;
        const on = selected === l.id;
        return (
          <g key={l.id} className={`acc-line${on ? ' is-selected' : ''}`} onClick={() => onSelect(l.id)} onDoubleClick={() => onOpen(l.id)}>
            <path d={d} className="acc-line__hit" />
            <path d={d} className="acc-line__path" markerEnd={l.arrow ? 'url(#acc-arrow)' : undefined} />
            {l.labels && (
              <>
                <text x={p1.x + (aRight ? 4 : -10)} y={p1.y - 4} className="acc-line__label">{l.labels[0]}</text>
                <text x={p2.x + (aRight ? -12 : 4)} y={p2.y - 4} className="acc-line__label">{l.labels[1]}</text>
              </>
            )}
          </g>
        );
      })}
      <defs>
        <marker id="acc-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
        </marker>
      </defs>
    </svg>
  );
}
