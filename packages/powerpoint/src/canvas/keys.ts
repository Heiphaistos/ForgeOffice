// Clavier de l'editeur de page : deplacement et rotation aux fleches, suppression, tabulation entre formes, groupes, doublons, frappe directe.
import type { KeyboardEvent, MutableRefObject } from 'react';
import type { GroupShape, Shape, TextBody } from '@forgeoffice/pptx';
import { deleteShapes, duplicateShapes, groupShapes, locate, moveShapes, rotateShapes, ungroup } from './ops.ts';
import { isLineShape } from './Overlay.tsx';
import { endPos } from './text.ts';
import type { CanvasSelection, TextTarget } from './types.ts';
import { S } from '../strings.ts';

/** La forme accepte-t-elle du texte ? */
export const isTextCapable = (s: Shape): boolean => (s.kind === 'shape' && !isLineShape(s)) || s.kind === 'table';

export interface KeyItem {
  id: number;
  raw: Shape;
  ancestors: GroupShape[];
}

export interface CanvasKeyDeps<T extends KeyItem> {
  ids: number[];
  items: readonly T[];
  byId: ReadonlyMap<number, T>;
  apply: (op: (draft: Shape[]) => void, group?: string) => void;
  materialize: (draft: Shape[], ids: readonly number[]) => void;
  onSelectionChange: (selection: CanvasSelection) => void;
  startEditing: (item: T, client: null, mode: 'end') => void;
  bodyOf: (shape: Shape, cell: TextTarget['cell']) => TextBody | null;
  pendingCaret: MutableRefObject<{ x: number; y: number; mode: 'caret' | 'word' | 'end' } | null>;
}

export function handleCanvasKey<T extends KeyItem>(e: KeyboardEvent<HTMLDivElement>, deps: CanvasKeyDeps<T>): void {
  const { ids, items, byId, apply, materialize, onSelectionChange, startEditing, bodyOf, pendingCaret } = deps;
  const ctrl = e.ctrlKey || e.metaKey;
  const nudge = (dx: number, dy: number): void => {
    e.preventDefault();
    if (!ids.length) return;
    apply((draftShapes) => {
      materialize(draftShapes, ids);
      moveShapes(draftShapes, ids, dx, dy);
    }, 'nudge');
  };
  const step = ctrl ? 1 : 6;
  switch (e.key) {
    case 'ArrowLeft':
      if (e.altKey) {
        e.preventDefault();
        apply((d) => rotateShapes(d, ids, -15), 'rotate');
      } else nudge(-step, 0);
      return;
    case 'ArrowRight':
      if (e.altKey) {
        e.preventDefault();
        apply((d) => rotateShapes(d, ids, 15), 'rotate');
      } else nudge(step, 0);
      return;
    case 'ArrowUp':
      nudge(0, -step);
      return;
    case 'ArrowDown':
      nudge(0, step);
      return;
    case 'Delete':
    case 'Backspace':
      if (!ids.length) return;
      e.preventDefault();
      apply((d) => deleteShapes(d, ids), 'delete');
      onSelectionChange({ ids: [], text: null });
      return;
    case 'Escape': {
      const first = byId.get(ids[0] ?? -1);
      onSelectionChange({ ids: first?.ancestors[0] ? [first.ancestors[first.ancestors.length - 1]?.id ?? first.ancestors[0].id] : [], text: null });
      return;
    }
    case 'Tab': {
      e.preventDefault();
      const top = items.filter((i) => i.ancestors.length === 0);
      if (!top.length) return;
      const at = top.findIndex((i) => i.id === ids[0]);
      const next = top[(at + (e.shiftKey ? -1 : 1) + top.length) % top.length];
      if (next) onSelectionChange({ ids: [next.id], text: null });
      return;
    }
    case 'Enter':
    case 'F2': {
      const item = byId.get(ids[0] ?? -1);
      if (item && ids.length === 1 && isTextCapable(item.raw)) {
        e.preventDefault();
        startEditing(item, null, 'end');
      }
      return;
    }
    default:
      break;
  }
  if (ctrl && !e.altKey) {
    const key = e.key.toLowerCase();
    if (key === 'a') {
      e.preventDefault();
      onSelectionChange({ ids: items.filter((i) => i.ancestors.length === 0).map((i) => i.id), text: null });
    } else if (key === 'd' && ids.length) {
      e.preventDefault();
      let created: number[] = [];
      apply((d) => {
        materialize(d, ids);
        created = duplicateShapes(d, ids, { x: 12, y: 12 });
      }, 'duplicate');
      onSelectionChange({ ids: created, text: null });
    } else if (key === 'g' && !e.shiftKey && ids.length > 1) {
      e.preventDefault();
      let id: number | null = null;
      apply((d) => {
        materialize(d, ids);
        id = groupShapes(d, ids, S.canvas.groupName);
      }, 'group');
      if (id !== null) onSelectionChange({ ids: [id], text: null });
    } else if (key === 'g' && e.shiftKey && ids.length === 1) {
      e.preventDefault();
      let children: number[] = [];
      apply((d) => {
        children = ungroup(d, ids[0] as number);
      }, 'ungroup');
      onSelectionChange({ ids: children, text: null });
    }
    return;
  }
  // Frappe directe sur une forme selectionnee : edition du texte a la fin.
  const item = ids.length === 1 ? byId.get(ids[0] as number) : undefined;
  if (item && isTextCapable(item.raw) && item.raw.kind === 'shape' && e.key.length === 1 && !e.altKey) {
    e.preventDefault();
    const char = e.key;
    onSelectionChange({ ids: [item.id], text: { shapeId: item.id, range: { start: { p: 0, o: 0 }, end: { p: 0, o: 0 } } } });
    apply((d) => {
      const found = locate(d, item.id);
      const body = found && bodyOf(found.shape, undefined);
      if (!body) return;
      const end = endPos(body);
      body.paragraphs.length ? body.paragraphs : body.paragraphs.push({ props: {}, runs: [] });
      const p = body.paragraphs[end.p];
      if (p) p.runs.push({ type: 'text', text: char, props: { ...(p.runs[p.runs.length - 1]?.props ?? p.endProps ?? {}) } });
    }, `typing:${item.id}`);
    pendingCaret.current = { x: 0, y: 0, mode: 'end' };
  }
}
