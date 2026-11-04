// Operations sur la presentation (sans DOM) : copie partielle par diapositive (historique leger), pages du masque,
// creation de formes depuis l'editeur, sections, en-tete et pied, encre.
import {
  addAutoShape, addTextBox, findLayout, nextShapeId, ptToEmu,
  type AutoShape, type Connector, type Deck, type Layout, type Master, type Section, type Shape, type Slide, type Transform,
} from '@forgeoffice/pptx';
import type { CreateRequest } from '../canvas/types.ts';
import { xfrmOfBox } from '../canvas/ops.ts';
import { S } from '../strings.ts';

/** Page editee : une diapositive, ou une disposition / un masque (mode Masque des diapositives). */
export type PageRef = { kind: 'slide'; slideId: number } | { kind: 'master'; masterIndex: number } | { kind: 'layout'; masterIndex: number; layoutId: string };

/** Copie de la presentation ou seule la diapositive visee est clonee (les medias sont partages). */
export function editSlide(deck: Deck, slideId: number, recipe: (slide: Slide) => void): Deck {
  return {
    ...deck,
    slides: deck.slides.map((s) => {
      if (s.id !== slideId) return s;
      const copy = structuredClone(s);
      recipe(copy);
      return copy;
    }),
  };
}

/** Modifie plusieurs diapositives. */
export function editSlides(deck: Deck, ids: ReadonlySet<number>, recipe: (slide: Slide) => void): Deck {
  return {
    ...deck,
    slides: deck.slides.map((s) => {
      if (!ids.has(s.id)) return s;
      const copy = structuredClone(s);
      recipe(copy);
      return copy;
    }),
  };
}

/** Modifie la structure de la presentation (ordre, ajout, suppression, sections) sur une copie superficielle. */
export function editDeck(deck: Deck, recipe: (draft: Deck) => void): Deck {
  const draft: Deck = { ...deck, slides: [...deck.slides], sections: structuredClone(deck.sections), properties: { ...deck.properties } };
  recipe(draft);
  return draft;
}

export function editMasters(deck: Deck, recipe: (masters: Master[]) => void): Deck {
  const masters = structuredClone(deck.masters);
  recipe(masters);
  return { ...deck, masters };
}

/** Formes de la page visee. */
export function pageShapes(deck: Deck, ref: PageRef): Shape[] {
  if (ref.kind === 'slide') return deck.slides.find((s) => s.id === ref.slideId)?.shapes ?? [];
  const master = deck.masters[ref.masterIndex];
  if (!master) return [];
  if (ref.kind === 'master') return master.shapes;
  return master.layouts.find((l) => l.id === ref.layoutId)?.shapes ?? [];
}

/** Proprietaire de la page (diapositive, disposition, masque). */
export function pageOwner(deck: Deck, ref: PageRef): Slide | Layout | Master | undefined {
  if (ref.kind === 'slide') return deck.slides.find((s) => s.id === ref.slideId);
  const master = deck.masters[ref.masterIndex];
  if (ref.kind === 'master') return master;
  return master?.layouts.find((l) => l.id === ref.layoutId);
}

/** Applique une recette aux formes de la page visee. */
export function editPage(deck: Deck, ref: PageRef, recipe: (shapes: Shape[]) => void): Deck {
  if (ref.kind === 'slide') return editSlide(deck, ref.slideId, (s) => recipe(s.shapes));
  return editMasters(deck, (masters) => {
    const master = masters[ref.masterIndex];
    if (!master) return;
    if (ref.kind === 'master') recipe(master.shapes);
    else {
      const layout = master.layouts.find((l) => l.id === ref.layoutId);
      if (layout) recipe(layout.shapes);
    }
  });
}

/** Cree la forme demandee par l'editeur ; renvoie son identifiant. */
export function createFromRequest(shapes: Shape[], request: CreateRequest, presetName: (preset: string) => string): number | null {
  const holder = { shapes } as Slide;
  if (request.kind === 'textbox') {
    const clicked = request.clicked || request.box.width < 4;
    const xfrm: Transform = clicked ? { x: request.box.x, y: request.box.y, width: 120, height: 30 } : xfrmOfBox(request.box);
    const box = addTextBox(holder, xfrm, '', { lang: 'fr-FR', size: 18 });
    if (box.text) {
      box.text.props = { ...box.text.props, wrap: !clicked, autofit: { type: 'shape' } };
      if (request.vertical) box.text.props.vertical = 'eaVert';
    }
    return box.id;
  }
  if (request.kind === 'shape') {
    const line = ['line', 'straightConnector1', 'bentConnector3', 'curvedConnector3'].includes(request.preset);
    if (line) {
      const id = nextShapeId(shapes);
      const connector: Connector = {
        kind: 'connector',
        id,
        name: `${presetName(request.preset)} ${id - 1}`,
        xfrm: xfrmOfBox(request.box),
        geometry: { type: 'preset', preset: request.preset === 'line' ? 'straightConnector1' : request.preset },
        style: {
          line: { index: 1, color: { type: 'scheme', value: 'accent1' } },
          fill: { index: 0, color: { type: 'scheme', value: 'accent1' } },
          effect: { index: 0, color: { type: 'scheme', value: 'accent1' } },
          font: { index: 'minor', color: { type: 'scheme', value: 'tx1' } },
        },
      };
      if (request.preset === 'straightConnector1') connector.line = { tail: { type: 'triangle' } };
      if (request.start) connector.start = request.start;
      if (request.end) connector.end = request.end;
      shapes.push(connector);
      return id;
    }
    const shape = addAutoShape(holder, request.preset, xfrmOfBox(request.box), presetName(request.preset));
    return shape.id;
  }
  return null;
}

/** Trait d'encre (forme libre sans remplissage). Coordonnees en points de la page. */
export function createInk(shapes: Shape[], points: ReadonlyArray<{ x: number; y: number }>, color: string, width: number, highlighter: boolean): number {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(1, Math.max(...xs) - minX);
  const h = Math.max(1, Math.max(...ys) - minY);
  const unit = (v: number): number => ptToEmu(v);
  const id = nextShapeId(shapes);
  const ink: AutoShape = {
    kind: 'shape',
    id,
    name: `${S.canvas.inkName} ${id - 1}`,
    xfrm: { x: minX, y: minY, width: w, height: h },
    geometry: {
      type: 'custom',
      paths: [
        {
          width: unit(w),
          height: unit(h),
          fill: 'none',
          commands: points.map((pt, i) => ({ cmd: i === 0 ? 'moveTo' : 'lineTo', pt: { x: unit(pt.x - minX), y: unit(pt.y - minY) } }) as const),
        },
      ],
    },
    fill: { type: 'none' },
    line: { width, cap: 'rnd', join: 'round', fill: { type: 'solid', color: { type: 'rgb', value: color.replace('#', '').toUpperCase(), mods: highlighter ? [{ name: 'alpha', val: 45000 }] : undefined } } },
  };
  shapes.push(ink);
  return id;
}

// ---- Sections ----

const guid = (): string => `{${crypto.randomUUID().toUpperCase()}}`;

/** Section qui contient une diapositive (ou undefined si la presentation n'a pas de sections). */
export function sectionOf(deck: Deck, slideId: number): Section | undefined {
  return deck.sections.find((s) => s.slideIds.includes(slideId));
}

/** Ajoute une section qui commence a la diapositive donnee. */
export function addSection(deck: Deck, slideId: number, name: string): Deck {
  return editDeck(deck, (d) => {
    const order = d.slides.map((s) => s.id);
    if (!d.sections.length) d.sections = [{ name: S.sections.default, id: guid(), slideIds: [...order] }];
    const owner = d.sections.find((s) => s.slideIds.includes(slideId));
    if (!owner) return;
    const at = owner.slideIds.indexOf(slideId);
    if (at === 0) {
      owner.name = owner.name || name;
      return;
    }
    const moved = owner.slideIds.splice(at);
    d.sections.splice(d.sections.indexOf(owner) + 1, 0, { name, id: guid(), slideIds: moved });
  });
}

export function renameSection(deck: Deck, sectionId: string, name: string): Deck {
  return editDeck(deck, (d) => {
    const section = d.sections.find((s) => s.id === sectionId);
    if (section) section.name = name;
  });
}

/** Supprime une section (ses diapositives rejoignent la precedente) ; `withSlides` supprime aussi les diapositives. */
export function removeSection(deck: Deck, sectionId: string, withSlides = false): Deck {
  return editDeck(deck, (d) => {
    const index = d.sections.findIndex((s) => s.id === sectionId);
    const section = d.sections[index];
    if (!section) return;
    if (withSlides) d.slides = d.slides.filter((s) => !section.slideIds.includes(s.id));
    else {
      const target = d.sections[index - 1] ?? d.sections[index + 1];
      if (target) {
        if (index > 0) target.slideIds.push(...section.slideIds);
        else target.slideIds.unshift(...section.slideIds);
      }
    }
    d.sections.splice(index, 1);
  });
}

/** Deplace une section entiere (vers le haut ou le bas). */
export function moveSection(deck: Deck, sectionId: string, delta: -1 | 1): Deck {
  return editDeck(deck, (d) => {
    const i = d.sections.findIndex((s) => s.id === sectionId);
    const j = i + delta;
    const a = d.sections[i];
    const b = d.sections[j];
    if (!a || !b) return;
    d.sections[i] = b;
    d.sections[j] = a;
    const order = d.sections.flatMap((s) => s.slideIds);
    d.slides = order.map((id) => d.slides.find((s) => s.id === id)).filter((s): s is Slide => !!s);
  });
}

/** Remet l'ordre des sections en accord avec l'ordre des diapositives (apres un glisser-deposer). */
export function syncSections(deck: Deck, slideIdsBySection?: Map<string, number[]>): Deck {
  if (!deck.sections.length) return deck;
  return editDeck(deck, (d) => {
    if (slideIdsBySection) {
      for (const section of d.sections) section.slideIds = slideIdsBySection.get(section.id) ?? section.slideIds;
      return;
    }
    const known = new Set(d.sections.flatMap((s) => s.slideIds));
    const first = d.sections[0];
    for (const slide of d.slides) if (!known.has(slide.id) && first) first.slideIds.push(slide.id);
    const live = new Set(d.slides.map((s) => s.id));
    for (const section of d.sections) section.slideIds = section.slideIds.filter((id) => live.has(id));
  });
}

/**
 * Deplace des diapositives a un indice (glisser-deposer des miniatures). Avec sections, la diapositive rejoint
 * la section de sa nouvelle voisine precedente.
 */
export function moveSlides(deck: Deck, ids: readonly number[], toIndex: number): Deck {
  return editDeck(deck, (d) => {
    const moving = d.slides.filter((s) => ids.includes(s.id));
    const before = d.slides.slice(0, toIndex).filter((s) => !ids.includes(s.id)).length;
    const rest = d.slides.filter((s) => !ids.includes(s.id));
    rest.splice(before, 0, ...moving);
    d.slides = rest;
    if (d.sections.length) {
      const prev = rest[before - 1];
      const target = (prev && d.sections.find((s) => s.slideIds.includes(prev.id))) ?? d.sections[0];
      for (const section of d.sections) section.slideIds = section.slideIds.filter((id) => !ids.includes(id));
      if (target) {
        const at = prev ? target.slideIds.indexOf(prev.id) + 1 : 0;
        target.slideIds.splice(at, 0, ...moving.map((s) => s.id));
      }
    }
  });
}

// ---- En-tete et pied de page ----

export interface HeaderFooter {
  date: boolean;
  fixedDate?: string;
  slideNumber: boolean;
  footer: boolean;
  footerText: string;
  /** Ne pas afficher sur la diapositive de titre. */
  notOnTitle: boolean;
}

/** Ajoute / retire les espaces reserves date, numero et pied sur les diapositives (d'apres la disposition). */
export function applyHeaderFooter(deck: Deck, hf: HeaderFooter, onlySlideId?: number): Deck {
  return {
    ...deck,
    slides: deck.slides.map((slide) => {
      if (onlySlideId !== undefined && slide.id !== onlySlideId) return slide;
      const found = findLayout(deck, slide.layoutId);
      const copy = structuredClone(slide);
      const isTitle = found?.layout.type === 'title';
      const wants = { dt: hf.date, sldNum: hf.slideNumber, ftr: hf.footer };
      for (const type of ['dt', 'sldNum', 'ftr'] as const) {
        copy.shapes = copy.shapes.filter((s) => s.placeholder?.type !== type);
        if (!wants[type] || (isTitle && hf.notOnTitle)) continue;
        const source = found?.layout.shapes.find((s) => s.placeholder?.type === type) ?? found?.master.shapes.find((s) => s.placeholder?.type === type);
        if (!source?.placeholder) continue;
        const id = nextShapeId(copy.shapes);
        const runs = type === 'sldNum'
          ? [{ type: 'field' as const, fieldType: 'slidenum', id: '{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}', text: '‹N°›', props: { lang: 'fr-FR' } }]
          : type === 'dt'
            ? hf.fixedDate
              ? [{ type: 'text' as const, text: hf.fixedDate, props: { lang: 'fr-FR' } }]
              : [{ type: 'field' as const, fieldType: 'datetime1', id: '{0C7F5D4C-6A1E-4E0B-9AC8-7A3F1C9B2D11}', text: new Date().toLocaleDateString('fr-FR'), props: { lang: 'fr-FR' } }]
            : hf.footerText
              ? [{ type: 'text' as const, text: hf.footerText, props: { lang: 'fr-FR' } }]
              : [];
        const placeholder = { ...source.placeholder };
        delete placeholder.hasCustomPrompt;
        copy.shapes.push({ kind: 'shape', id, name: `${S.headerFooter.names[type]} ${id - 1}`, placeholder, geometry: { type: 'preset', preset: 'rect' }, text: { props: {}, paragraphs: [{ props: {}, runs }] } });
      }
      return copy;
    }),
  };
}

/** Diapositives d'une section ou de la presentation, dans l'ordre. */
export function slidesInOrder(deck: Deck): Array<{ section?: Section; slides: Slide[] }> {
  if (!deck.sections.length) return [{ slides: deck.slides }];
  const byId = new Map(deck.slides.map((s) => [s.id, s]));
  const listed = new Set<number>();
  const groups = deck.sections.map((section) => ({
    section,
    slides: section.slideIds.map((id) => {
      listed.add(id);
      return byId.get(id);
    }).filter((s): s is Slide => !!s),
  }));
  const orphans = deck.slides.filter((s) => !listed.has(s.id));
  if (orphans.length && groups[0]) groups[0].slides.push(...orphans);
  return groups;
}

/** Change la taille des diapositives : 'fit' = ajuster (tout reste visible, centre), 'max' = agrandir. */
export function resizeDeck(deck: Deck, size: { width: number; height: number; type?: string }, mode: 'fit' | 'max'): Deck {
  const sx = size.width / deck.size.width;
  const sy = size.height / deck.size.height;
  const k = mode === 'fit' ? Math.min(sx, sy) : Math.max(sx, sy);
  const dx = (size.width - deck.size.width * k) / 2;
  const dy = (size.height - deck.size.height * k) / 2;
  const scale = (shapes: Shape[]): Shape[] =>
    shapes.map((shape) => {
      const copy = structuredClone(shape);
      if (copy.xfrm) copy.xfrm = { ...copy.xfrm, x: copy.xfrm.x * k + dx, y: copy.xfrm.y * k + dy, width: copy.xfrm.width * k, height: copy.xfrm.height * k };
      if (copy.kind === 'smartart' || copy.kind === 'raw') copy.fallback = scale(copy.fallback);
      if (copy.kind === 'table' && k !== 1) {
        copy.table.columns = copy.table.columns.map((w) => w * k);
        for (const row of copy.table.rows) row.height *= k;
      }
      return copy;
    });
  return {
    ...deck,
    size: { ...size },
    slides: deck.slides.map((s) => ({ ...s, shapes: scale(s.shapes) })),
    masters: deck.masters.map((m) => ({ ...m, shapes: scale(m.shapes), layouts: m.layouts.map((l) => ({ ...l, shapes: scale(l.shapes) })) })),
  };
}

export { findLayout };
