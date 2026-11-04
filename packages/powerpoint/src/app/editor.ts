// Modele de l'application : presentation + historique, page affichee, selection, etat de l'interface, commandes de base.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Services } from '@forgeoffice/core';
import {
  addSlide as addSlideToDeck, backgroundShapes, createBlankDeck, duplicateSlide, findLayout, removeSlide,
  type Deck, type Layout, type Master, type Shape, type Slide,
} from '@forgeoffice/pptx';
import { deckPageBackground, deckPageContext, type PageContext } from '../canvas/context.ts';
import type { PageLayer } from '../canvas/PageView.tsx';
import { EMPTY_SELECTION, type CanvasSelection, type CanvasTool } from '../canvas/types.ts';
import { locate } from '../canvas/ops.ts';
import { editDeck, editPage, pageOwner, pageShapes, syncSections, type PageRef } from './deck-ops.ts';

/** Page du mode Masque : le masque ou une de ses dispositions. */
export type MasterRef = Exclude<PageRef, { kind: 'slide' }>;
import { useDeck, type DeckState } from './useDeck.ts';
import { S } from '../strings.ts';

export type ViewMode = 'normal' | 'outline' | 'sorter' | 'notesPage' | 'reading' | 'master';
export type SidePane = 'format' | 'animation' | 'comments' | 'designer' | 'selection' | 'accessibility' | null;
export type DialogId = 'slideSize' | 'headerFooter' | 'link' | 'table' | 'chartData' | 'icons' | 'background' | 'comment' | 'find' | 'replace' | 'video' | 'sectionName' | 'properties' | 'crop' | null;

export interface UiState {
  view: ViewMode;
  zoom: number;
  /** Zoom ajuste a la fenetre. */
  fit: boolean;
  tool: CanvasTool;
  ruler: boolean;
  grid: boolean;
  snapToGrid: boolean;
  guides: boolean;
  smartGuides: boolean;
  guidesX: number[];
  guidesY: number[];
  notes: boolean;
  thumbnails: boolean;
  grayscale: boolean;
  pane: SidePane;
  paneWidth: number;
  dialog: DialogId;
  backstage: string | null;
  /** Diaporama : indice de depart et mode Presentateur. */
  show: { start: number; presenter: boolean; windowed?: boolean } | null;
  /** Page du masque editee (mode Masque des diapositives). */
  masterPage: MasterRef | null;
  ribbonTab: string;
}

const DEFAULT_UI: UiState = {
  view: 'normal', zoom: 100, fit: true, tool: { kind: 'select' }, ruler: false, grid: false, snapToGrid: false, guides: false, smartGuides: true,
  guidesX: [], guidesY: [], notes: true, thumbnails: true, grayscale: false, pane: null, paneWidth: 320, dialog: null, backstage: null, show: null,
  masterPage: null, ribbonTab: 'home',
};

export interface FileInfo {
  name: string;
  path: string | null;
}

export interface Editor {
  services: Services;
  ds: DeckState;
  deck: Deck;
  file: FileInfo;
  setFile: (file: FileInfo) => void;
  /** Diapositive courante (mode normal). */
  slide: Slide | undefined;
  slideIndex: number;
  /** Page editee (diapositive, ou masque / disposition en mode Masque). */
  page: PageRef;
  pageShapes: Shape[];
  owner: Slide | Layout | Master | undefined;
  ctx: PageContext;
  underlay: PageLayer[];
  background: ReturnType<typeof deckPageBackground> | undefined;
  selection: CanvasSelection;
  setSelection: (s: CanvasSelection) => void;
  selectedSlides: number[];
  setSelectedSlides: (ids: number[]) => void;
  ui: UiState;
  setUi: (patch: Partial<UiState> | ((ui: UiState) => Partial<UiState>)) => void;
  commit: (next: Deck, group?: string | null) => void;
  /** Modifie les formes de la page courante. */
  editShapes: (recipe: (shapes: Shape[]) => void, group?: string) => void;
  /** Modifie chaque forme selectionnee (forme brute du modele). */
  editSelected: (recipe: (shape: Shape) => void, group?: string) => void;
  /** Formes selectionnees (brutes, page courante). */
  selectedShapes: Shape[];
  goto: (slideId: number) => void;
  newSlide: (layoutId?: string, after?: number) => void;
  duplicateSlides: (ids: readonly number[]) => void;
  deleteSlides: (ids: readonly number[]) => void;
  notify: Services['notify'];
}

/** Disposition proposee pour une nouvelle diapositive (comme PowerPoint : titre -> titre et contenu). */
function nextLayoutId(deck: Deck, current: Slide | undefined): string | undefined {
  const found = current && findLayout(deck, current.layoutId);
  const master = found?.master ?? deck.masters[0];
  if (!master) return undefined;
  if (found && found.layout.type !== 'title') return found.layout.id;
  return (master.layouts.find((l) => l.type === 'obj') ?? master.layouts[1] ?? master.layouts[0])?.id;
}

export function useEditor(services: Services, initial: () => Deck, initialFile: FileInfo): Editor {
  const onModified = useCallback((m: boolean) => services.setModified(m), [services]);
  const ds = useDeck(initial, onModified);
  const deck = ds.deck;
  const [file, setFile] = useState<FileInfo>(initialFile);
  const [slideId, setSlideId] = useState<number>(() => deck.slides[0]?.id ?? 0);
  const [selection, setSelection] = useState<CanvasSelection>(EMPTY_SELECTION);
  const [selectedSlides, setSelectedSlides] = useState<number[]>([]);
  const [ui, setUiState] = useState<UiState>(DEFAULT_UI);
  const setUi = useCallback((patch: Partial<UiState> | ((u: UiState) => Partial<UiState>)) => setUiState((u) => ({ ...u, ...(typeof patch === 'function' ? patch(u) : patch) })), []);

  // La diapositive courante disparait (suppression, annulation) : on se recale.
  const slideIndex = Math.max(0, deck.slides.findIndex((s) => s.id === slideId));
  const slide = deck.slides[slideIndex];
  useEffect(() => {
    if (slide && slide.id !== slideId) setSlideId(slide.id);
  }, [slide, slideId]);

  const page: PageRef = ui.view === 'master' && ui.masterPage ? ui.masterPage : { kind: 'slide', slideId: slide?.id ?? 0 };
  const owner = pageOwner(deck, page);
  const shapes = useMemo(() => pageShapes(deck, page), [deck, page.kind, page.kind === 'slide' ? page.slideId : page.kind === 'layout' ? page.layoutId : page.masterIndex]);
  const ctx = useMemo(() => (owner ? deckPageContext(deck, owner, { slideNumber: page.kind === 'slide' ? slideIndex + (deck.firstSlideNumber ?? 1) : undefined, prompts: true }) : deckPageContext(createBlankDeck(), createBlankDeck().masters[0] as Master)), [deck, owner, slideIndex, page.kind]);
  const underlay = useMemo<PageLayer[]>(() => {
    if (!owner) return [];
    if (page.kind === 'slide' && 'layoutId' in owner) return [{ shapes: backgroundShapes(deck, owner), ctx: deckPageContext(deck, owner) }];
    if (page.kind === 'layout') {
      const master = deck.masters[page.masterIndex];
      const layout = owner as Layout;
      return master && layout.showMasterShapes !== false ? [{ shapes: master.shapes.filter((s) => !s.placeholder), ctx: deckPageContext(deck, master) }] : [];
    }
    return [];
  }, [deck, owner, page.kind]);
  const background = owner ? deckPageBackground(deck, owner) : undefined;

  const commit = ds.commit;
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const editShapes = useCallback((recipe: (shapes: Shape[]) => void, group?: string) => commit(editPage(deckRef.current, page, recipe), group ?? null), [commit, page.kind, page.kind === 'slide' ? page.slideId : page.kind === 'layout' ? page.layoutId : page.masterIndex]);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const editSelected = useCallback(
    (recipe: (shape: Shape) => void, group?: string) =>
      editShapes((list) => {
        for (const id of selectionRef.current.ids) {
          const found = locate(list, id);
          if (found) recipe(found.shape);
        }
      }, group),
    [editShapes],
  );
  const selectedShapes = useMemo(() => selection.ids.map((id) => locate(shapes, id)?.shape).filter((s): s is Shape => !!s), [selection.ids, shapes]);

  const goto = useCallback((id: number) => {
    setSlideId(id);
    setSelection(EMPTY_SELECTION);
    setSelectedSlides([id]);
  }, []);

  const newSlide = useCallback(
    (layoutId?: string, after?: number) => {
      const d = deckRef.current;
      const current = d.slides.find((s) => s.id === (after ?? slideId));
      const index = current ? d.slides.indexOf(current) + 1 : d.slides.length;
      let created = 0;
      let next = editDeck(d, (draft) => {
        const lid = layoutId ?? nextLayoutId(draft, current);
        if (!lid) return;
        created = addSlideToDeck(draft, lid, index).id;
        if (current) {
          const section = draft.sections.find((s) => s.slideIds.includes(current.id));
          if (section) section.slideIds.splice(section.slideIds.indexOf(current.id) + 1, 0, created);
        }
      });
      next = syncSections(next);
      commit(next);
      if (created) goto(created);
    },
    [commit, goto, slideId],
  );

  const duplicateSlides = useCallback(
    (ids: readonly number[]) => {
      let last = 0;
      const next = editDeck(deckRef.current, (draft) => {
        for (const id of ids) last = duplicateSlide(draft, id)?.id ?? last;
      });
      commit(next);
      if (last) goto(last);
    },
    [commit, goto],
  );

  const deleteSlides = useCallback(
    (ids: readonly number[]) => {
      const d = deckRef.current;
      if (ids.length >= d.slides.length) {
        services.notify(S.app.lastSlide, 'warning');
        return;
      }
      const index = d.slides.findIndex((s) => s.id === ids[0]);
      const next = editDeck(d, (draft) => {
        for (const id of ids) removeSlide(draft, id);
      });
      commit(next);
      const target = next.slides[Math.min(Math.max(0, index), next.slides.length - 1)];
      if (target) goto(target.id);
    },
    [commit, goto, services],
  );

  return {
    services, ds, deck, file, setFile, slide, slideIndex, page, pageShapes: shapes, owner, ctx, underlay, background, selection, setSelection, selectedSlides, setSelectedSlides,
    ui, setUi, commit, editShapes, editSelected, selectedShapes, goto, newSlide, duplicateSlides, deleteSlides, notify: services.notify,
  };
}

