// Crochet de test (banc de conformite) : modele de la presentation et selections preparees. Appele seulement en developpement.
import type { ModuleProbe } from '@forgeoffice/core';
import type { Shape, Slide } from '@forgeoffice/pptx';
import { notesText } from '@forgeoffice/pptx';
import { groupShapes } from '../canvas/ops.ts';
import { editSlides } from './deck-ops.ts';
import { insertMedia } from './insert.ts';
import { insertSmartArt } from './insert-objects.ts';
import type { Editor } from './editor.ts';

const plain = (v: unknown): unknown => {
  if (v instanceof Map) return [...v.entries()].map(([k, x]) => [k, plain(x)]);
  if (v instanceof Uint8Array) return `bytes(${v.length})`;
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

import { probeCounters } from './probe-counters.ts';
export { probeCounters };

export function pptSnapshot(ed: Editor): unknown {
  const { deck } = ed;
  return plain({
    size: deck.size,
    firstSlideNumber: deck.firstSlideNumber,
    sections: deck.sections,
    slides: deck.slides.map((s) => ({ ...s, notes: notesText(s) })),
    media: Object.fromEntries(Object.entries(deck.media ?? {}).map(([k, v]) => [k, (v as { bytes?: Uint8Array }).bytes?.length ?? 0])),
    layouts: deck.masters.map((m) => m.layouts.map((l) => l.id)),
    theme: deck.masters[0]?.theme?.name,
    current: ed.slideIndex,
    selection: { ids: ed.selection.ids, text: ed.selection.text ?? null, cells: ed.selection.cells ?? null },
    // Etat de l'interface (outil arme, mode d'affichage, volet) : classe EFFET_UI, pas EFFET_DOCUMENT.
    ui: { view: ed.ui.view, tool: ed.ui.tool, pane: ed.ui.pane, zoom: ed.ui.zoom, fit: ed.ui.fit, ruler: ed.ui.ruler, grid: ed.ui.grid, guides: ed.ui.guides, notes: ed.ui.notes, grayscale: ed.ui.grayscale, masterPage: ed.ui.masterPage, presenter: ed.services.settings.get('powerpoint.presenter', false), timings: ed.services.settings.get('powerpoint.useTimings', true), previews: probeCounters.previews },
  });
}

const firstWith = (slides: readonly Slide[], test: (s: Shape) => boolean): { slide: Slide; shape: Shape } | null => {
  for (const slide of slides) {
    const shape = slide.shapes.find(test);
    if (shape) return { slide, shape };
  }
  return null;
};

export function pptProbe(get: () => Editor): ModuleProbe {
  return {
    presets: ['forme', 'texte', 'diapositive', 'tableau', 'image', 'graphique', 'plusieurs', 'formes', 'formeimage', 'groupeimage', 'masque', 'masquelibre', 'commentaire', 'ellipse', 'edition', 'media', 'smartart', 'masqueforme'],
    snapshot: () => pptSnapshot(get()),
    async select(preset) {
      const ed = get();
      const slides = ed.deck.slides;
      const go = async (slide: Slide, ids: number[]): Promise<boolean> => {
        ed.goto(slide.id);
        await new Promise((r) => setTimeout(r, 150));
        get().setSelection({ ids });
        return true;
      };
      switch (preset) {
        case 'diapositive': {
          const s = slides[1] ?? slides[0];
          if (!s) return false;
          ed.goto(s.id);
          get().setSelectedSlides([s.id]);
          return true;
        }
        case 'masque':
        case 'masqueforme':
        case 'masquelibre': {
          // « masquelibre » : une disposition qu'aucune diapositive n'utilise (la seule que l'on puisse supprimer).
          const used = new Set(slides.map((sl) => sl.layoutId));
          const layouts = ed.deck.masters[0]?.layouts ?? [];
          const layout = preset === 'masquelibre' ? layouts.find((l) => !used.has(l.id)) : layouts[0];
          if (!layout) return false;
          ed.setUi({ view: 'master', masterPage: { kind: 'layout', masterIndex: 0, layoutId: layout.id }, ribbonTab: 'master' });
          await new Promise((r) => setTimeout(r, 150));
          // « masqueforme » : un espace reserve de la disposition est selectionne (renommer).
          const ph = preset === 'masqueforme' ? layout.shapes[0] : undefined;
          if (preset === 'masqueforme') { if (!ph) return false; get().setSelection({ ids: [ph.id] }); }
          return true;
        }
        case 'plusieurs':
          get().setSelectedSlides(slides.slice(0, 2).map((s) => s.id));
          return slides.length > 1;
        case 'commentaire': {
          // Un commentaire sur la diapositive 2 et un sur la 4 (precedent / suivant / supprimer ont quelque chose a parcourir).
          const targets = [slides[1], slides[3]].filter((x): x is Slide => !!x);
          if (targets.length === 0) return false;
          const note = { author: 'Banc', initials: 'B', date: '2026-01-01T00:00:00.000Z', text: 'Commentaire de conformite', position: { x: 10, y: 10 } };
          ed.commit(editSlides(ed.deck, new Set(targets.map((x) => x.id)), (x) => { if (x.comments.length === 0) x.comments.push({ ...note }); }));
          await new Promise((r) => setTimeout(r, 150));
          get().goto((targets[0] as Slide).id);
          return true;
        }
        case 'media':
        case 'smartart': {
          // Objet cree a la demande (le document de test n'en contient pas) : onglets contextuels Audio/Video et SmartArt.
          const slide = slides[1] ?? slides[0];
          if (!slide) return false;
          ed.goto(slide.id);
          await new Promise((r) => setTimeout(r, 150));
          if (preset === 'smartart') insertSmartArt(get(), 'process', [{ text: 'Etape 1', level: 0 }, { text: 'Etape 2', level: 0 }, { text: 'Etape 3', level: 0 }]);
          else {
            const svc = ed.services as { openFile: unknown };
            const orig = svc.openFile;
            svc.openFile = async () => ({ name: 'banc.mp3', bytes: new Uint8Array(64) });
            try { await insertMedia(get(), 'audio'); } finally { svc.openFile = orig; }
          }
          await new Promise((r) => setTimeout(r, 200));
          return true;
        }
        case 'ellipse': {
          const f = firstWith(slides, (s) => s.kind === 'shape' && s.name.startsWith('Ellipse'));
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        case 'formes':
        case 'formeimage':
        case 'groupeimage': {
          // Plusieurs objets d'une meme diapositive (groupement, dissociation).
          const rect = firstWith(slides, (s) => s.kind === 'shape' && !s.placeholder && s.name.startsWith('Rectangle'));
          if (!rect) return false;
          const onSlide = rect.slide.shapes;
          const other = onSlide.find((s) => (preset === 'formes' ? s.kind === 'shape' && s.name.startsWith('Ellipse') : s.kind === 'picture'));
          if (!other) return false;
          if (preset !== 'groupeimage') return go(rect.slide, [rect.shape.id, other.id]);
          const ellipse = onSlide.find((s) => s.kind === 'shape' && s.name.startsWith('Ellipse'));
          if (!ellipse) return false;
          await go(rect.slide, [rect.shape.id, ellipse.id]);
          let gid: number | null = null;
          get().editShapes((shapes) => { gid = groupShapes(shapes, [rect.shape.id, ellipse.id], 'Groupe'); }, 'group');
          await new Promise((r) => setTimeout(r, 150));
          return gid === null ? false : go(rect.slide, [gid, other.id]);
        }
        case 'texte': {
          const f = firstWith(slides, (s) => s.kind === 'shape' && !!s.placeholder);
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        case 'forme': {
          const f = firstWith(slides, (s) => s.kind === 'shape' && !s.placeholder && s.name.startsWith('Rectangle'));
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        case 'tableau': {
          const f = firstWith(slides, (s) => s.kind === 'table');
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        case 'image': {
          const f = firstWith(slides, (s) => s.kind === 'picture');
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        case 'edition': {
          const f = firstWith(slides, (s) => s.kind === 'shape' && !!s.placeholder);
          if (!f) return false;
          await go(f.slide, [f.shape.id]);
          get().setSelection({ ids: [f.shape.id], text: { shapeId: f.shape.id, range: { start: { p: 0, o: 0 }, end: { p: 0, o: 0 } } } });
          return true;
        }
        case 'graphique': {
          const f = firstWith(slides, (s) => s.kind === 'chart');
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        default:
          return false;
      }
    },
  };
}
