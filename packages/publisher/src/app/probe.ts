// Crochet de test (banc de conformite) : modele de la publication et selections preparees. Appele seulement en developpement.
import type { ModuleProbe } from '@forgeoffice/core';
import type { Shape, Slide } from '@forgeoffice/pptx';
import type { Editor } from './editor.ts';

const plain = (v: unknown): unknown => {
  if (v instanceof Map) return [...v.entries()].map(([k, x]) => [k, plain(x)]);
  if (v instanceof Uint8Array) return `bytes(${v.length})`;
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

export function pubSnapshot(ed: Editor): unknown {
  return plain({
    pages: ed.deck.slides,
    size: ed.deck.size,
    pub: ed.pub,
    media: Object.keys(ed.deck.media ?? {}),
    pageIndex: ed.pageIndex,
    selection: { ids: ed.selection.ids, text: ed.selection.text ?? null },
    // Etat de l'interface (outil arme, mode d'affichage, volet) : classe EFFET_UI, pas EFFET_DOCUMENT.
    ui: { view: ed.ui.view, tool: ed.ui.tool, zoom: ed.ui.zoom, fit: ed.ui.fit, rulers: ed.ui.rulers, guides: ed.ui.guides, baselines: ed.ui.baselines, boundaries: ed.ui.boundaries, pagesPane: ed.ui.pagesPane, twoPage: ed.ui.twoPage, checker: ed.ui.checker, masterId: ed.ui.masterId, linking: ed.ui.linking, mergePreview: ed.ui.mergePreview, lang: ed.ui.lang, crop: ed.ui.crop },
  });
}

const firstWith = (slides: readonly Slide[], test: (s: Shape) => boolean): { slide: Slide; shape: Shape } | null => {
  for (const slide of slides) {
    const shape = slide.shapes.find(test);
    if (shape) return { slide, shape };
  }
  return null;
};

export function pubProbe(get: () => Editor): ModuleProbe {
  return {
    presets: ['forme', 'texte', 'image', 'page', 'tableau', 'deuxformes', 'chaine', 'chaine2'],
    snapshot: () => pubSnapshot(get()),
    async select(preset) {
      const ed = get();
      const slides = ed.deck.slides;
      const go = async (slide: Slide, ids: number[]): Promise<boolean> => {
        ed.goto(slides.indexOf(slide));
        await new Promise((r) => setTimeout(r, 150));
        get().setSelection({ ids });
        return true;
      };
      switch (preset) {
        case 'page':
          ed.goto(0);
          return true;
        case 'texte': {
          const f = firstWith(slides, (s) => s.kind === 'shape' && s.name === 'Zone essai');
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        case 'forme': {
          const f = firstWith(slides, (s) => s.kind === 'shape' && s.name === 'Rectangle essai');
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        case 'image': {
          const f = firstWith(slides, (s) => s.kind === 'picture');
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        case 'tableau': {
          const f = firstWith(slides, (s) => s.kind === 'table');
          return f ? go(f.slide, [f.shape.id]) : false;
        }
        case 'deuxformes': {
          const a = firstWith(slides, (s) => s.kind === 'shape' && s.name === 'Zone essai');
          const b = firstWith(slides, (s) => s.kind === 'shape' && s.name === 'Rectangle essai');
          return a && b ? go(a.slide, [a.shape.id, b.shape.id]) : false;
        }
        case 'chaine':
        case 'chaine2': {
          const box = get().pub.chains[0]?.boxes[preset === 'chaine' ? 0 : 1];
          const slide = box ? slides.find((s) => s.id === box.page) : undefined;
          return slide && box ? go(slide, [box.shape]) : false;
        }
        default:
          return false;
      }
    },
  };
}
