// Etat de l'application : publication (Deck + reglages) avec historique, page ou page maitre editee, selection,
// interface ; chaque modification recalcule la repartition des articles et fait suivre le curseur d'une zone a l'autre.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { remeasureWhenFontsReady } from '@forgeoffice/ui';
import { History, type Services } from '@forgeoffice/core';
import { backgroundShapes, deckTheme, type Deck, type Fill, type Layout, type Shape, type Slide, type Theme } from '@forgeoffice/pptx';
import { deckPageBackground, deckPageContext, EMPTY_SELECTION, locate, type CanvasSelection, type CanvasTool, type PageContext, type PageLayer } from '@forgeoffice/powerpoint/canvas';
import { chainOf, chainStarts, reflow } from '../chain.ts';
import { fromStory, toStory, type MeasureFn, type StoryPos } from '../flow.ts';
import type { PubDocument } from '../fopub.ts';
import type { BoxRef, PubSettings } from '../model.ts';
import { withWrap } from '../pagectx.ts';
import { createMeasure, deckFonts } from './measure.ts';

export type Doc = PubDocument;
export type PageRef = { kind: 'page'; id: number } | { kind: 'master'; layoutId: string };
export type DialogId = 'pageSetup' | 'guides' | 'insertPages' | 'goToPage' | 'spots' | 'catalog' | 'guidePos' | 'saveBlock' | 'mergeCheck' | 'format' | 'styles' | 'font' | 'paragraph' | 'geom' | 'renameMaster' | 'table' | 'icons' | 'merge' | 'textBox' | 'background' | 'altText' | 'find' | 'replace' | 'link' | 'pptxExport' | null;

export interface UiState {
  view: 'normal' | 'master';
  zoom: number;
  fit: 'page' | 'width' | null;
  tool: CanvasTool;
  rulers: boolean;
  /** Reperes de marge, de colonnes et de regle visibles. */
  guides: boolean;
  /** Reperes de regle verrouilles : ni deplaces ni crees a la souris. */
  guidesLocked: boolean;
  /** Repere de regle en cours de modification numerique. */
  guideEdit: { axis: 'x' | 'y'; index: number } | null;
  baselines: boolean;
  boundaries: boolean;
  pagesPane: boolean;
  twoPage: boolean;
  snapGuides: boolean;
  snapObjects: boolean;
  checker: boolean;
  dialog: DialogId;
  backstage: string | null;
  ribbonTab: string;
  masterId: string | null;
  /** Liaison de zones en cours : la zone source. */
  linking: BoxRef | null;
  /** Apercu du publipostage : indice d'enregistrement. */
  mergePreview: number | null;
  /** Rognage en cours : identifiant de l'image. */
  crop: number | null;
  /** Correcteur orthographique du navigateur dans la saisie, et langue du texte (BCP 47). */
  spell: boolean;
  lang: string;
}

const DEFAULT_UI: UiState = {
  view: 'normal', zoom: 100, fit: 'page', tool: { kind: 'select' }, rulers: true, guides: true, guidesLocked: false, guideEdit: null, baselines: false, boundaries: true, pagesPane: true, twoPage: true,
  snapGuides: true, snapObjects: true, checker: false, dialog: null, backstage: null, ribbonTab: 'home', masterId: null, linking: null, mergePreview: null, crop: null, spell: true, lang: 'fr-FR',
};

export interface FileInfo {
  name: string;
  path: string | null;
}

export interface Editor {
  services: Services;
  doc: Doc;
  deck: Deck;
  pub: PubSettings;
  file: FileInfo;
  setFile: (f: FileInfo) => void;
  /** Validation d'un nouvel etat (articles recalcules). */
  commit: (next: Doc, group?: string | null) => void;
  commitDeck: (deck: Deck, group?: string | null) => void;
  commitPub: (pub: PubSettings, group?: string | null) => void;
  reset: (next: Doc) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  modified: boolean;
  markSaved: () => void;
  revision: number;
  pageIndex: number;
  page: Slide | undefined;
  goto: (index: number) => void;
  /** Page editee : page de la publication ou page maitre. */
  ref: PageRef;
  owner: Slide | Layout | undefined;
  pageShapes: Shape[];
  ctx: PageContext;
  underlay: PageLayer[];
  background: Fill | undefined;
  selection: CanvasSelection;
  setSelection: (s: CanvasSelection) => void;
  selectedShapes: Shape[];
  editShapes: (recipe: (shapes: Shape[]) => void, group?: string, target?: PageRef) => void;
  editSelected: (recipe: (shape: Shape) => void, group?: string) => void;
  ui: UiState;
  setUi: (patch: Partial<UiState> | ((u: UiState) => Partial<UiState>)) => void;
  overflow: ReadonlySet<string>;
  notify: Services['notify'];
}

/** Rendu d'une page de la publication (vignettes, export, impression). */
export function pageProps(deck: Deck, slide: Slide, index: number, pub: PubSettings): { background: Fill; ctx: PageContext; shapes: Shape[]; underlay: PageLayer[] } {
  const ctx = withWrap(deckPageContext(deck, slide, { slideNumber: index + 1 }), slide, pub);
  return { background: deckPageBackground(deck, slide), ctx, shapes: slide.shapes, underlay: [{ shapes: backgroundShapes(deck, slide), ctx }] };
}

/** Modifie les formes d'une page ou d'une page maitre (copie de la seule liste touchee). */
export function editPageShapes(deck: Deck, ref: PageRef, recipe: (shapes: Shape[]) => void): Deck {
  if (ref.kind === 'page') {
    const i = deck.slides.findIndex((s) => s.id === ref.id);
    const slide = deck.slides[i];
    if (!slide) return deck;
    const shapes = structuredClone(slide.shapes);
    recipe(shapes);
    const slides = [...deck.slides];
    slides[i] = { ...slide, shapes };
    return { ...deck, slides };
  }
  return {
    ...deck,
    masters: deck.masters.map((m, mi) =>
      mi !== 0
        ? m
        : {
            ...m,
            layouts: m.layouts.map((l) => {
              if (l.id !== ref.layoutId) return l;
              const shapes = structuredClone(l.shapes);
              recipe(shapes);
              return { ...l, shapes };
            }),
          },
    ),
  };
}

const sameRef = (a: PageRef, b: PageRef): boolean => (a.kind === 'page' && b.kind === 'page' ? a.id === b.id : a.kind === 'master' && b.kind === 'master' && a.layoutId === b.layoutId);

export function useEditor(services: Services, initial: Doc, initialFile: FileInfo): Editor {
  const measureRef = useRef<{ theme: Theme; fn: MeasureFn } | null>(null);
  const measureFor = (deck: Deck): MeasureFn => {
    const theme = deckTheme(deck);
    if (measureRef.current?.theme.fonts !== theme.fonts) measureRef.current = { theme, fn: createMeasure(theme) };
    return measureRef.current.fn;
  };
  const overflowCache = useRef(new WeakMap<Deck, Set<string>>());
  const flow = (doc: Doc): Doc => {
    const r = reflow(doc.deck, doc.pub, measureFor(doc.deck));
    overflowCache.current.set(r.deck, r.overflow);
    return r.deck === doc.deck && r.pub === doc.pub ? doc : { deck: r.deck, pub: r.pub };
  };

  const history = useRef<History<Doc> | null>(null);
  if (!history.current) history.current = new History(flow(initial), { limit: 300, mergeMs: 1000 });
  const h = history.current;
  const [doc, setDoc] = useState(h.state);
  const [revision, setRevision] = useState(0);
  const savedAt = useRef<Doc>(h.state);
  const [file, setFile] = useState(initialFile);
  const [pageId, setPageId] = useState<number>(() => h.state.deck.slides[0]?.id ?? 0);
  const [selection, setSelectionState] = useState<CanvasSelection>(EMPTY_SELECTION);
  const [ui, setUiState] = useState<UiState>(() => ({ ...DEFAULT_UI, twoPage: h.state.pub.facing, spell: services.settings.get('publisher.spell', true), lang: services.settings.get('publisher.lang', 'fr-FR') }));
  const setUi = useCallback((patch: Partial<UiState> | ((u: UiState) => Partial<UiState>)) => setUiState((u) => ({ ...u, ...(typeof patch === 'function' ? patch(u) : patch) })), []);

  const sync = useCallback(() => {
    setDoc(h.state);
    setRevision((r) => r + 1);
    services.setModified(h.state !== savedAt.current);
  }, [h, services]);

  const commit = useCallback((next: Doc, group: string | null = null) => {
    h.commit(flow(next), group);
    sync();
  }, [h, sync]);

  // Polices : la composition faite avec les polices de repli (avant le chargement des @font-face) est refaite avec les vraies largeurs.
  // Un document intact reste intact (pas de « modifie » a l'ouverture) ; sinon la recomposition est une etape annulable.
  useEffect(() => remeasureWhenFontsReady(() => {
    measureRef.current = null;
    const cur = h.state;
    const next = flow(cur);
    if (next !== cur) {
      const clean = cur === savedAt.current;
      h.commit(next, 'fonts');
      if (clean) savedAt.current = h.state;
    }
    sync();
  }, () => deckFonts(h.state.deck)), [h, sync]);

  const deck = doc.deck;
  const pub = doc.pub;
  const pageIndex = Math.max(0, deck.slides.findIndex((s) => s.id === pageId));
  const page = deck.slides[pageIndex];
  const masterLayouts = deck.masters[0]?.layouts ?? [];
  const masterId = ui.masterId && masterLayouts.some((l) => l.id === ui.masterId) ? ui.masterId : (page?.layoutId ?? masterLayouts[0]?.id ?? '');
  const ref: PageRef = ui.view === 'master' ? { kind: 'master', layoutId: masterId } : { kind: 'page', id: page?.id ?? 0 };
  const owner: Slide | Layout | undefined = ref.kind === 'page' ? page : masterLayouts.find((l) => l.id === ref.layoutId);
  const pageShapes = owner?.shapes ?? [];
  const ctx = useMemo(() => {
    const master = deck.masters[0];
    if (!owner && master) return deckPageContext(deck, master);
    if (!owner) throw new Error('Publication sans masque');
    const base = deckPageContext(deck, owner, ref.kind === 'page' ? { slideNumber: pageIndex + 1 } : {});
    return ref.kind === 'page' && page ? withWrap(base, page, pub) : base;
  }, [deck, owner, pageIndex, ref.kind, page, pub]);
  const underlay = useMemo<PageLayer[]>(() => (ref.kind === 'page' && page ? [{ shapes: backgroundShapes(deck, page), ctx }] : []), [deck, page, ref.kind, ctx]);
  const background = owner ? deckPageBackground(deck, owner) : undefined;

  const selRef = useRef(selection);
  selRef.current = selection;
  /** Correspondance du curseur entre le texte modifie (avant repartition) et le texte reparti. */
  const remap = useRef<{ ref: BoxRef; before: Array<StoryPos | null>; after: Array<StoryPos | null>; boxes: BoxRef[] } | null>(null);

  const editShapes = useCallback((recipe: (shapes: Shape[]) => void, group?: string, target?: PageRef) => {
    const current = h.state;
    const where = target ?? ref;
    const edited = editPageShapes(current.deck, where, recipe);
    const t = selRef.current.text;
    const chain = where.kind === 'page' && t ? chainOf(current.pub, { page: where.id, shape: t.shapeId }) : undefined;
    const before = chain ? chainStarts(edited, chain) : null;
    const next = flow({ deck: edited, pub: current.pub });
    h.commit(next, group ?? null);
    sync();
    if (chain && before && where.kind === 'page' && t) {
      const after = next.pub.chains.find((c) => c.id === chain.id);
      if (after) {
        remap.current = { ref: { page: where.id, shape: t.shapeId }, before, after: chainStarts(next.deck, after), boxes: after.boxes };
        setTimeout(() => {
          remap.current = null;
        }, 0);
      }
    }
  }, [h, sync, ref.kind, ref.kind === 'page' ? ref.id : ref.layoutId]);

  const setSelection = useCallback((s: CanvasSelection) => {
    const r = remap.current;
    if (r && s.text && s.text.shapeId === r.ref.shape && !s.text.cell) {
      remap.current = null;
      const box = r.boxes.findIndex((b) => b.page === r.ref.page && b.shape === r.ref.shape);
      const end = s.text.range.end;
      const story = toStory(r.before, box, end);
      const target = fromStory(r.after, story);
      const dest = r.boxes[target.box];
      if (dest && (dest.page !== r.ref.page || dest.shape !== r.ref.shape)) {
        if (dest.page !== r.ref.page) setPageId(dest.page);
        setSelectionState({ ids: [dest.shape], text: { shapeId: dest.shape, range: { start: target.pos, end: target.pos } } });
        return;
      }
    }
    setSelectionState(s);
  }, []);

  const editSelected = useCallback((recipe: (shape: Shape) => void, group?: string) => editShapes((list) => {
    for (const id of selRef.current.ids) {
      const found = locate(list, id);
      if (found) recipe(found.shape);
    }
  }, group), [editShapes]);

  const selectedShapes = useMemo(() => selection.ids.map((id) => locate(pageShapes, id)?.shape).filter((s): s is Shape => !!s), [selection.ids, pageShapes]);

  const goto = useCallback((index: number) => {
    const s = h.state.deck.slides[Math.max(0, Math.min(index, h.state.deck.slides.length - 1))];
    if (!s) return;
    setPageId(s.id);
    setSelectionState(EMPTY_SELECTION);
    setUi({ view: 'normal' });
  }, [setUi]);

  let overflow = overflowCache.current.get(deck);
  if (!overflow) {
    overflow = reflow(deck, pub, measureFor(deck)).overflow;
    overflowCache.current.set(deck, overflow);
  }

  return {
    services, doc, deck, pub, file, setFile,
    commit,
    commitDeck: (d, group = null) => commit({ deck: d, pub: h.state.pub }, group),
    commitPub: (p, group = null) => commit({ deck: h.state.deck, pub: p }, group),
    reset: (next) => {
      h.reset(flow(next));
      savedAt.current = h.state;
      setPageId(h.state.deck.slides[0]?.id ?? 0);
      setSelectionState(EMPTY_SELECTION);
      setUi({ twoPage: next.pub.facing, view: 'normal', masterId: null, linking: null, mergePreview: null });
      sync();
    },
    undo: () => { h.undo(); setSelectionState(EMPTY_SELECTION); sync(); },
    redo: () => { h.redo(); setSelectionState(EMPTY_SELECTION); sync(); },
    canUndo: h.canUndo, canRedo: h.canRedo,
    modified: doc !== savedAt.current,
    markSaved: () => { savedAt.current = h.state; services.setModified(false); setRevision((r) => r + 1); },
    revision,
    pageIndex, page, goto: (i) => goto(i),
    ref, owner, pageShapes, ctx, underlay, background,
    selection, setSelection, selectedShapes, editShapes, editSelected,
    ui, setUi, overflow, notify: services.notify,
  };
}

export { sameRef };
