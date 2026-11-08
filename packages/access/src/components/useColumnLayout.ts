// Disposition des colonnes d'une feuille de donnees, memorisee par objet : etat, largeur provisoire pendant le glissement.
import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Settings } from '@forgeoffice/core';
import { usePersistentState } from '@forgeoffice/ui';
import { EMPTY_LAYOUT, MAX_WIDTH, MIN_WIDTH, displayOrder, moveColumn, setWidth, stickyOffsets, type ColLayout } from '../logic/columns-layout.ts';

/** Largeur d'une colonne figee sans largeur choisie (le decalage des suivantes doit etre connu). */
const FROZEN_DEFAULT = 110;
/** Largeur du selecteur d'enregistrement, a gauche de la grille. */
const SELECTOR_WIDTH = 18;

export interface ColumnLayoutApi {
  layout: ColLayout;
  setLayout: (next: ColLayout) => void;
  /** Indices (dans les champs de la source) des colonnes affichees, dans l'ordre d'affichage. */
  shown: number[];
  /** Style d'une colonne : largeur choisie, et position collante si elle est figee (`pos` = rang d'affichage). */
  cellStyle: (name: string, pos: number, header?: boolean) => CSSProperties | undefined;
  /** Rang d'affichage devant lequel tomberait la colonne glissee (null hors glissement). */
  dropAt: number | null;
  /** Debut du glissement d'un en-tete pour reordonner les colonnes : a brancher sur `onPointerDown` de l'intitule. */
  startMove: (pos: number, e: PointerEvent<HTMLElement>) => void;
  /** Poignee de redimensionnement : a brancher sur `onPointerDown` du bord droit de l'en-tete. */
  startResize: (name: string, e: PointerEvent<HTMLElement>) => void;
}

export function useColumnLayout(settings: Settings | null | undefined, key: string, names: readonly string[]): ColumnLayoutApi {
  const [layout, setLayout] = usePersistentState<ColLayout>(settings, key, EMPTY_LAYOUT);
  const [drag, setDrag] = useState<{ name: string; width: number } | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const shown = useMemo(() => displayOrder(names, layout), [names, layout]);

  const offsets = useMemo(() => stickyOffsets(shown.map((i) => layout.widths[names[i] ?? ''] ?? FROZEN_DEFAULT), layout.frozen, SELECTOR_WIDTH), [shown, names, layout.widths, layout.frozen]);

  const cellStyle = useCallback((name: string, pos: number, header = false): CSSProperties | undefined => {
    const frozen = pos < layout.frozen;
    const w = drag?.name === name ? drag.width : (layout.widths[name] ?? (frozen ? FROZEN_DEFAULT : undefined));
    if (w === undefined) return undefined;
    return { width: w, minWidth: w, maxWidth: w, ...(frozen ? { position: 'sticky', left: offsets[pos], zIndex: header ? 3 : 1 } : {}) };
  }, [drag, layout.widths, layout.frozen, offsets]);

  const startMove = useCallback((pos: number, e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.currentTarget;
    const row = target.closest('tr');
    const startX = e.clientX;
    let moving = false;
    let at = pos;
    const dropFor = (x: number): number => {
      const cells = [...(row?.querySelectorAll('th') ?? [])].slice(1, 1 + shown.length);
      const hit = cells.findIndex((c) => x < c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2);
      return hit === -1 ? cells.length : hit;
    };
    target.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent): void => {
      if (!moving && Math.abs(ev.clientX - startX) < 6) return;
      moving = true;
      at = dropFor(ev.clientX);
      setDropAt(at);
    };
    const up = (): void => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      setDropAt(null);
      if (moving) setLayout(moveColumn(layoutRef.current, names, pos, at));
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }, [shown, names, setLayout]);

  const startResize = useCallback((name: string, e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = e.currentTarget.parentElement;
    const startX = e.clientX;
    const startWidth = cell?.getBoundingClientRect().width ?? MIN_WIDTH;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const clamp = (x: number): number => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + x - startX));
    const move = (ev: globalThis.PointerEvent): void => setDrag({ name, width: clamp(ev.clientX) });
    const up = (ev: globalThis.PointerEvent): void => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      setDrag(null);
      setLayout(setWidth(layoutRef.current, name, clamp(ev.clientX)));
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }, [setLayout]);

  return { layout, setLayout, shown, cellStyle, dropAt, startMove, startResize };
}
